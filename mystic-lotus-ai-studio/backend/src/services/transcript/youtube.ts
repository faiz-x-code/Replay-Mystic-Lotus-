import { YoutubeTranscript } from 'youtube-transcript';
import { ParsedSegment } from './parser.js';

export interface YouTubeTranscriptResult {
  videoId: string;
  totalCues: number;
  segments: ParsedSegment[];
  transcriptText: string;
}

interface RawCue {
  text: string;
  offset: number; // in milliseconds
  duration: number; // in milliseconds
}

/**
 * Decode common HTML entities from subtitle text
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/\n/g, ' ')
    .trim();
}

/**
 * Parse caption XML supporting both srv3 format (<p t="ms" d="ms">)
 * and classic format (<text start="s" dur="s">)
 */
function parseTranscriptXml(xml: string): RawCue[] {
  const results: RawCue[] = [];

  // 1. Try srv3 format: <p t="ms" d="ms"><s>word</s>...</p>
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let match: RegExpExecArray | null;
  while ((match = pRegex.exec(xml)) !== null) {
    const startMs = parseInt(match[1], 10);
    const durMs = parseInt(match[2], 10);
    const inner = match[3];
    let text = '';
    const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
    let sMatch: RegExpExecArray | null;
    while ((sMatch = sRegex.exec(inner)) !== null) {
      text += sMatch[1];
    }
    if (!text) {
      text = inner.replace(/<[^>]+>/g, '');
    }
    text = decodeHtmlEntities(text);
    if (text) {
      results.push({
        text,
        offset: startMs,
        duration: durMs
      });
    }
  }

  if (results.length > 0) return results;

  // 2. Try classic format: <text start="s" dur="s">content</text>
  const classicRegex = /<text\s+start="([\d.]+)"\s+dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  while ((match = classicRegex.exec(xml)) !== null) {
    const startSec = parseFloat(match[1]);
    const durSec = parseFloat(match[2]);
    const text = decodeHtmlEntities(match[3].replace(/<[^>]+>/g, ''));
    if (text) {
      results.push({
        text,
        offset: Math.round(startSec * 1000),
        duration: Math.round(durSec * 1000)
      });
    }
  }

  return results;
}

async function fetchVisitorData(): Promise<string | null> {
  try {
    const res = await fetch('https://www.youtube.com/sw.js_data', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    const text = await res.text();
    const clean = text.replace(/^\)\]\}'\s*/, '');
    const data = JSON.parse(clean);
    const visitor = data?.[0]?.[2]?.[0]?.[0]?.[13];
    if (typeof visitor === 'string' && visitor.length > 20) {
      return visitor;
    }
  } catch {}
  return null;
}

/**
 * Fetch raw caption cues directly using YouTube InnerTube API
 */
async function fetchViaInnerTube(videoId: string): Promise<RawCue[] | null> {
  const visitorData = await fetchVisitorData();

  const clients = [
    {
      name: 'ANDROID',
      version: '20.10.38',
      ua: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)'
    },
    {
      name: 'IOS',
      version: '19.29.1',
      ua: 'com.google.ios.youtube/19.29.1 (iPhone14,2; U; CPU OS 17_5_1 like Mac OS X)'
    },
    {
      name: 'WEB',
      version: '2.20240313.01.00',
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  ];

  for (const client of clients) {
    try {
      const resp = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': client.ua,
          ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {})
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: client.name,
              clientVersion: client.version,
              ...(visitorData ? { visitorData } : {}),
              hl: 'en',
              gl: 'US'
            }
          },
          videoId
        })
      });


      if (!resp.ok) continue;
      const data: any = await resp.json();
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (Array.isArray(tracks) && tracks.length > 0) {
        // Prefer English tracks first, else take the primary track
        const track = tracks.find((t: any) => (t.languageCode || '').toLowerCase().startsWith('en')) || tracks[0];
        let baseUrl: string = track.baseUrl;
        if (!baseUrl.includes('fmt=')) {
          baseUrl += '&fmt=srv3';
        }

        const capResp = await fetch(baseUrl, {
          headers: { 'User-Agent': client.ua }
        });
        if (capResp.ok) {
          const xml = await capResp.text();
          const cues = parseTranscriptXml(xml);
          if (cues.length > 0) {
            console.log(`[YouTube InnerTube ${client.name}] Fetched ${cues.length} cues for video ${videoId}`);
            return cues;
          }
        }
      }
    } catch (err: any) {
      console.warn(`[InnerTube ${client.name}] attempt notice:`, err.message);
    }
  }
  return null;
}

/**
 * Fetch captions via HTML watch page parsing
 */
async function fetchViaWebPageScrape(videoId: string): Promise<RawCue[] | null> {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const match = html.match(/"captionTracks":(\[.*?\])/);
    if (!match) return null;
    const tracks = JSON.parse(match[1]);
    if (Array.isArray(tracks) && tracks.length > 0) {
      const track = tracks.find((t: any) => (t.languageCode || '').toLowerCase().startsWith('en')) || tracks[0];
      let baseUrl = track.baseUrl;
      if (!baseUrl.includes('fmt=')) {
        baseUrl += '&fmt=srv3';
      }
      const capResp = await fetch(baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (capResp.ok) {
        const xml = await capResp.text();
        const cues = parseTranscriptXml(xml);
        if (cues.length > 0) {
          console.log(`[YouTube Web Scraping] Fetched ${cues.length} cues for video ${videoId}`);
          return cues;
        }
      }
    }
  } catch (err: any) {
    console.warn('[YouTube Web Scraping] notice:', err.message);
  }
  return null;
}

/**
 * Fetch official/auto-generated transcripts directly from YouTube
 * and group into coherent narrative blocks with precise start times.
 */
export async function fetchYouTubeTranscript(videoId: string): Promise<YouTubeTranscriptResult> {
  if (!videoId) {
    throw new Error('No YouTube Video ID provided');
  }

  let rawCues: RawCue[] | null = null;

  // 1. Try InnerTube (Android, iOS, Web)
  rawCues = await fetchViaInnerTube(videoId);

  // 2. Try HTML watch page scrape
  if (!rawCues || rawCues.length === 0) {
    rawCues = await fetchViaWebPageScrape(videoId);
  }

  // 3. Fallback to youtube-transcript npm package
  if (!rawCues || rawCues.length === 0) {
    try {
      const pkgResult: any[] = await YoutubeTranscript.fetchTranscript(videoId);
      if (Array.isArray(pkgResult) && pkgResult.length > 0) {
        rawCues = pkgResult.map(item => ({
          text: decodeHtmlEntities(item.text),
          offset: item.offset,
          duration: item.duration
        }));
      }
    } catch (err: any) {
      console.warn('Fallback youtube-transcript package notice:', err.message);
    }
  }

  if (!rawCues || rawCues.length === 0) {
    throw new Error(`YouTube has not generated or published captions for video "${videoId}". You can upload your masterclass/Zoom transcript file directly or let AI draft the timestamps.`);
  }

  const segments: ParsedSegment[] = [];
  let currentBlock = {
    startSeconds: Math.floor(rawCues[0].offset / 1000),
    text: '',
    endSeconds: Math.floor((rawCues[0].offset + rawCues[0].duration) / 1000)
  };

  let seq = 1;

  for (let i = 0; i < rawCues.length; i++) {
    const item = rawCues[i];
    const itemStartSec = Math.floor(item.offset / 1000);
    const itemEndSec = Math.floor((item.offset + item.duration) / 1000);
    const cleanText = item.text.trim();

    if (cleanText) {
      currentBlock.text += (currentBlock.text ? ' ' : '') + cleanText;
      currentBlock.endSeconds = itemEndSec;
    }

    const duration = itemStartSec - currentBlock.startSeconds;
    const endsWithSentence = /[.!?]$/.test(cleanText);

    // Group into logical blocks of 15-25 seconds or at punctuation boundaries
    if (duration >= 20 || (duration >= 10 && endsWithSentence) || i === rawCues.length - 1) {
      if (currentBlock.text.trim()) {
        segments.push({
          sequenceNumber: seq++,
          startSeconds: currentBlock.startSeconds,
          endSeconds: currentBlock.endSeconds,
          speakerReference: null,
          text: currentBlock.text.trim()
        });
      }

      if (i < rawCues.length - 1) {
        const next = rawCues[i + 1];
        currentBlock = {
          startSeconds: Math.floor(next.offset / 1000),
          text: '',
          endSeconds: Math.floor((next.offset + next.duration) / 1000)
        };
      }
    }
  }

  const transcriptText = segments
    .map(s => `[${s.startSeconds}s]: ${s.text}`)
    .join('\n');

  return {
    videoId,
    totalCues: rawCues.length,
    segments,
    transcriptText
  };
}

