import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { createRequire } from 'module';

let pdfParse: any = null;
try {
  const req = typeof require !== 'undefined'
    ? require
    : (typeof import.meta !== 'undefined' && typeof import.meta.url === 'string' ? createRequire(import.meta.url) : null);
  if (req) {
    pdfParse = req('pdf-parse');
  }
} catch (err) {
  console.warn('pdf-parse dynamic load notice:', err);
}


export interface ParsedSegment {
  sequenceNumber: number;
  startSeconds: number | null;
  endSeconds: number | null;
  speakerReference: string | null;
  text: string;
}

export interface ParseResult {
  segments: ParsedSegment[];
  hasTimestamps: boolean;
  warnings: string[];
  totalSegments: number;
}

// Convert "HH:MM:SS.mmm" or "MM:SS" or "HH:MM:SS,mmm" to seconds
export function timeStringToSeconds(timeStr: string): number | null {
  if (!timeStr) return null;
  const cleaned = timeStr.trim().replace(',', '.');
  const parts = cleaned.split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    if (isNaN(minutes) || isNaN(seconds)) return null;
    return minutes * 60 + seconds;
  }
  return null;
}

// Format seconds into HH:MM:SS or MM:SS
export function secondsToTimeString(totalSeconds: number | null): string {
  if (totalSeconds === null || isNaN(totalSeconds)) return '--:--';
  const sec = Math.floor(totalSeconds);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function parseVTT(content: string): ParseResult {
  const lines = content.split(/\r?\n/);
  const segments: ParsedSegment[] = [];
  const warnings: string[] = [];

  let seq = 1;
  let i = 0;

  // Skip WEBVTT header
  while (i < lines.length && (lines[i].startsWith('WEBVTT') || lines[i].startsWith('NOTE') || lines[i].trim() === '')) {
    i++;
  }

  const timeRegex = /((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{3})/;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    // Check if line is timestamp or identifier before timestamp
    let timeMatch = line.match(timeRegex);
    if (!timeMatch && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      timeMatch = nextLine.match(timeRegex);
      if (timeMatch) {
        i++; // advance past identifier
      }
    }

    if (timeMatch) {
      const startSec = timeStringToSeconds(timeMatch[1]);
      const endSec = timeStringToSeconds(timeMatch[2]);
      i++;

      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].trim());
        i++;
      }

      let rawText = textLines.join(' ');
      let speaker: string | null = null;

      // Extract <v Speaker> or Speaker: prefix
      const voiceTag = rawText.match(/<v\s+([^>]+)>(.*?)<\/v>/i) || rawText.match(/<v\s+([^>]+)>(.*)/i);
      if (voiceTag) {
        speaker = voiceTag[1].trim();
        rawText = voiceTag[2].replace(/<\/v>/gi, '').trim();
      } else {
        const colonSpeaker = rawText.match(/^([A-Z][a-zA-Z0-9\s_]{1,30}):\s*(.*)$/);
        if (colonSpeaker) {
          speaker = colonSpeaker[1].trim();
          rawText = colonSpeaker[2].trim();
        }
      }

      // Clean HTML tags
      rawText = rawText.replace(/<[^>]+>/g, '').trim();

      if (rawText) {
        segments.push({
          sequenceNumber: seq++,
          startSeconds: startSec,
          endSeconds: endSec,
          speakerReference: speaker,
          text: rawText
        });
      }
    } else {
      i++;
    }
  }

  return {
    segments,
    hasTimestamps: segments.length > 0 && segments.some(s => s.startSeconds !== null),
    warnings,
    totalSegments: segments.length
  };
}

export function parseSRT(content: string): ParseResult {
  // SRT is very similar to VTT with timestamp format 00:00:00,000 --> 00:00:00,000
  return parseVTT(content);
}

export function parseTextLines(text: string): ParseResult {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const segments: ParsedSegment[] = [];
  const warnings: string[] = [];

  let seq = 1;
  let foundTimestamps = false;

  // Supports: "0:05", "00:05", "1:15:20", "[01:23:45]", "(12:34)", "00:01:23,450", etc.
  const standaloneTimeRegex = /^(?:\[|\()?((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[\.,]\d{1,3})?)(?:\]|\))?$/;
  const inlineTimeRegex = /^(?:\[|\()?((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[\.,]\d{1,3})?)(?:\]|\))?\s*[-:]?\s*(?:([A-Z][a-zA-Z0-9\s_]{1,25}):)?\s*(.+)$/;

  let pendingStartSec: number | null = null;
  let pendingSpeaker: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Case 1: Line is JUST a timestamp (e.g. YouTube transcript sidebar copy: "0:05", or Zoom "00:01:23")
    const standaloneMatch = line.match(standaloneTimeRegex);
    if (standaloneMatch) {
      const parsedSec = timeStringToSeconds(standaloneMatch[1]);
      if (parsedSec !== null) {
        foundTimestamps = true;
        pendingStartSec = parsedSec;
        continue;
      }
    }

    // Case 2: Line is timestamp + text (e.g. "0:05 Hello everyone, I'm Shiraz")
    const inlineMatch = line.match(inlineTimeRegex);
    if (inlineMatch) {
      const parsedSec = timeStringToSeconds(inlineMatch[1]);
      if (parsedSec !== null) {
        foundTimestamps = true;
        segments.push({
          sequenceNumber: seq++,
          startSeconds: parsedSec,
          endSeconds: null,
          speakerReference: inlineMatch[2]?.trim() || null,
          text: inlineMatch[3]?.trim() || line
        });
        pendingStartSec = null;
        pendingSpeaker = null;
        continue;
      }
    }

    // Case 3: If we have a pending timestamp from previous line
    if (pendingStartSec !== null) {
      // Check if this line is "Speaker Name" or "Speaker: text"
      const speakerWithText = line.match(/^([A-Z][a-zA-Z0-9\s_]{1,25}):\s*(.+)$/);
      if (speakerWithText) {
        segments.push({
          sequenceNumber: seq++,
          startSeconds: pendingStartSec,
          endSeconds: null,
          speakerReference: speakerWithText[1].trim(),
          text: speakerWithText[2].trim()
        });
        pendingStartSec = null;
        continue;
      }

      // Check if line is just a speaker name (Zoom TXT: "00:01:23" on line 1, "Speaker Name" on line 2, text on line 3)
      if (i + 1 < lines.length && /^[A-Z][a-zA-Z0-9\s_]{1,25}$/.test(line) && !line.includes('.') && !line.includes(',')) {
        pendingSpeaker = line.trim();
        continue;
      }

      segments.push({
        sequenceNumber: seq++,
        startSeconds: pendingStartSec,
        endSeconds: null,
        speakerReference: pendingSpeaker,
        text: line
      });
      pendingStartSec = null;
      pendingSpeaker = null;
      continue;
    }

    // Case 4: Line has "Speaker: text" without timestamp
    const speakerMatch = line.match(/^([A-Z][a-zA-Z0-9\s_]{1,30}):\s*(.*)$/);
    if (speakerMatch) {
      segments.push({
        sequenceNumber: seq++,
        startSeconds: null,
        endSeconds: null,
        speakerReference: speakerMatch[1].trim(),
        text: speakerMatch[2].trim()
      });
    } else {
      // Paragraph segment
      segments.push({
        sequenceNumber: seq++,
        startSeconds: null,
        endSeconds: null,
        speakerReference: null,
        text: line
      });
    }
  }

  if (!foundTimestamps) {
    warnings.push('No explicit timestamp offsets detected in document. Timestamps marked as unverified/unknown.');
  }

  return {
    segments,
    hasTimestamps: foundTimestamps,
    warnings,
    totalSegments: segments.length
  };
}

export async function parseTranscriptFile(filePath: string, originalFilename: string): Promise<ParseResult> {
  const ext = path.extname(originalFilename).toLowerCase();

  let textContent = '';
  if (ext === '.vtt' || ext === '.srt' || ext === '.txt') {
    textContent = fs.readFileSync(filePath, 'utf8');
  } else if (ext === '.docx') {
    const buffer = fs.readFileSync(filePath);
    const { value } = await mammoth.extractRawText({ buffer });
    textContent = value;
  } else if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    textContent = data.text;
  } else {
    throw new Error(`Unsupported file type: ${ext}. Supported types: .vtt, .srt, .txt, .docx, .pdf`);
  }

  // Auto-detect WebVTT / SRT cue formatting regardless of file extension
  if (textContent.trim().startsWith('WEBVTT') || /((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{3})/.test(textContent)) {
    return parseVTT(textContent);
  }

  // Fallback to line-by-line / paragraph parsing
  return parseTextLines(textContent);
}
