import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { parseTranscriptFile, parseVTT, parseTextLines, secondsToTimeString, timeStringToSeconds, ParsedSegment } from '../services/transcript/parser.js';
import { extractYouTubeId, generateWordPressEmbedCode } from '../services/wordpress/template.js';
import { fetchYouTubeTranscript } from '../services/transcript/youtube.js';
import { generateReplayEmailHtml, ReplayEmailData } from '../services/email/template.js';

const router = express.Router();

const uploadDir = path.resolve(process.cwd(), 'data/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 30 * 1024 * 1024 }
});

// Snap an AI-generated timestamp to the nearest transcript segment start within +/- 20s
function snapTimestampToTranscript(predictedSec: number, segments: ParsedSegment[]): number {
  if (!segments || segments.length === 0) return predictedSec;
  const candidates = segments.filter(
    s => s.startSeconds !== null && Math.abs(s.startSeconds - predictedSec) <= 20
  );
  if (candidates.length === 0) return predictedSec;

  let closest = candidates[0];
  let minDiff = Math.abs(closest.startSeconds! - predictedSec);
  for (let i = 1; i < candidates.length; i++) {
    const diff = Math.abs(candidates[i].startSeconds! - predictedSec);
    if (diff < minDiff) {
      minDiff = diff;
      closest = candidates[i];
    }
  }
  return closest.startSeconds!;
}

// Helper to fetch YouTube video duration in seconds
async function fetchYouTubeDuration(videoId: string): Promise<number | null> {
  if (!videoId) return null;
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      }
    });
    const html = await res.text();
    const match = html.match(/"lengthSeconds":"(\d+)"/);
    if (match) {
      return parseInt(match[1], 10);
    }
  } catch (err) {
    console.warn('Could not fetch YouTube duration:', err);
  }
  return null;
}

// Pre-cached default for Simmin Bawa Day 2 (precise YouTube video alignment)
const DEFAULT_SIMMIN_DATA = {
  videoId: 'OLXSmAhpU-g',
  tag: 'Simmin Bawa Masterclass Replay',
  heading: 'Highlights from the Call',
  subheading: 'Explore powerful channeling experiences, energy alignments, group healings, and transformational breakthroughs from the call with Simmin Bawa.',
  keyPoints: [
    'Experiential channel connection to Mother Earth for personalized guidance on wealth, relationships, and health.',
    'Sacred attunement and channeled wisdom from Gautama Buddha under the Bodhi Tree to release long-held burdens.',
    'Group channeled healing with Lord Shiva on Mount Kailash utilizing water, pulses, and sugar to cleanse emotional and physical pain.',
    'Clarification on psychic safety, debunking myths about encountering dark souls, and the role of spiritual attunements.',
    'Live demonstration of channeled light language and its interpretation of cultivating courage and wisdom.',
    'Spot readings and guidance from animal spirit guide Booa the Unicorn on insomnia and toxic environments for Arpana and Shubha.',
    'Higher master connections with Archangel Michael providing specific physical movement and sunlight guidance for Garvita.',
    'Planetary channeling connecting with Mercury for Prashant regarding timing and alignment for home transitions.',
    'Heartfelt departed loved one readings offering closure and profound soul validations for Deepti Gupta and twin brothers Rahul and Sandeep Pujara.'
  ],
  timestamps: [
    { title: 'Welcome and Setting the Sacred Intention for Day 2', seconds: 34, formattedTime: '00:34' },
    { title: 'Experiential Channeling Journey: Connecting with Mother Earth', seconds: 91, formattedTime: '01:31' },
    { title: 'Debriefing Mother Earth Messages on Health, Wealth, and Relationships', seconds: 743, formattedTime: '12:23' },
    { title: "Experiential Channeling Journey: Receiving Buddha's Wisdom at the Bodhi Tree", seconds: 1144, formattedTime: '19:04' },
    { title: 'Group Reflections & Channeled Guidance Received from Buddha', seconds: 1848, formattedTime: '30:48' },
    { title: 'Channeled Group Healing: Connecting with Lord Shiva on Mount Kailash', seconds: 2665, formattedTime: '44:25' },
    { title: 'Sharing Experiences and Discharging Transferred Energy to Nature', seconds: 3261, formattedTime: '54:21' },
    { title: 'Channeling Safety & Attunements: Dispelling Fears of Dark Energies', seconds: 4037, formattedTime: '1:07:17' },
    { title: 'Channeled Light Language Transmission and Interpretation', seconds: 4192, formattedTime: '1:09:52' },
    { title: 'Animal Spirit Reading: Unicorn Booa Guides Arpana on Insomnia', seconds: 5632, formattedTime: '1:33:52' },
    { title: 'Animal Spirit Reading: Unicorn Guidance for Shubha on Negativity', seconds: 5752, formattedTime: '1:35:52' },
    { title: 'Higher Master Connection: Archangel Michael\'s Guidance for Garvita', seconds: 5912, formattedTime: '1:38:32' },
    { title: 'Planetary Reading: Mercury\'s Channeled Guidance on Relocation for Prashant', seconds: 6470, formattedTime: '1:47:50' },
    { title: 'Departed Loved One Reading: Communicating with Deepti\'s Son', seconds: 6792, formattedTime: '1:53:12' },
    { title: 'Departed Loved One Reading: Mother\'s Messages and Validation for Rahul & Sandeep', seconds: 7537, formattedTime: '2:05:37' },
    { title: 'Closing Blessings and Guidance for Continuing the Channeling Journey', seconds: 7894, formattedTime: '2:11:34' }
  ]
};

const DEFAULT_SIMMIN_EMAIL: ReplayEmailData = {
  masterclassName: 'Simmin Bawa Masterclass - Day 2',
  speakerName: 'Simmin Bawa',
  videoId: 'OLXSmAhpU-g',
  subject: 'Connect With Your DEPARTED LOVED ONES And Receive MESSAGES FROM THEM! [Replay Inside]',
  previewText: "Some experiences can't be explained. They can only be felt. Watch the highlights & meditation inside.",
  hookText: "Some experiences can't be explained. They can only be felt. On our recent live call with Expert Healer-Trainer <strong>Simmin Bawa</strong>, the <strong>Auto Writing & Channeling Masterclass</strong> became a space of deep healing, surrender, and connection.",
  attendeeQuotes: [
    {
      quote: "Energy lifted as soon as we reached the Bodhi tree. Could see into his luminous eyes. He asked me to continue. The Buddha sent his blessings to you.",
      attendeeName: "Sonalika"
    },
    {
      quote: "Shivji removed a lot of the emotional pain. I feel heavy but relieved at the same time.",
      attendeeName: "Sarika"
    },
    {
      quote: "I saw black light coming out of my crown chakra. Released my negative emotions.",
      attendeeName: "Arpana Supriya"
    },
    {
      quote: "With Ganga water he washed my negativity from above and blessed me. Ma Ganesh, Kartikeya and Nandi were there. Panchmukhi Hanuman...",
      attendeeName: "Bhavna Shah"
    }
  ],
  keyMoments: [
    {
      formattedTime: "1:37",
      title: "A Simple Way to Connect With Mother Earth",
      emoji: "🌏",
      description: "Discover how to connect with Mother Earth through Simmin's energies."
    },
    {
      formattedTime: "8:41",
      title: "A Personal Channeling Session With Lord Buddha",
      emoji: "🌸",
      description: "Watch a powerful personal channeling unfold."
    },
    {
      formattedTime: "42:44",
      title: "Healing for Pain: Join This Group Healing Even Now",
      emoji: "✨",
      description: "Missed the live session? You can still experience this channeled healing."
    },
    {
      formattedTime: "1:50:48",
      title: '"She Heard From Her Son... After He Passed Away."',
      emoji: "🕊️",
      description: "Watch Deepti Gupta receive a connection with her son who has passed away."
    },
    {
      formattedTime: "2:04:07",
      title: "He Connects With His Deceased Mother",
      emoji: "💫",
      description: "Watch Rahul Pujaray's emotional experience of connecting with his mother."
    }
  ]
};

// GET default sample result
router.get('/default', (_req, res) => {
  const wordpressHtml = generateWordPressEmbedCode({
    videoId: DEFAULT_SIMMIN_DATA.videoId,
    tag: DEFAULT_SIMMIN_DATA.tag,
    heading: DEFAULT_SIMMIN_DATA.heading,
    subheading: DEFAULT_SIMMIN_DATA.subheading,
    playerNumber: '1',
    timestamps: DEFAULT_SIMMIN_DATA.timestamps
  });

  const emailHtml = generateReplayEmailHtml(DEFAULT_SIMMIN_EMAIL);

  return res.json({
    ...DEFAULT_SIMMIN_DATA,
    playerNumber: '1',
    wordpressHtml,
    emailData: DEFAULT_SIMMIN_EMAIL,
    emailHtml
  });
});

// POST fetch native YouTube transcript
router.post('/fetch-youtube-transcript', async (req, res) => {
  try {
    const youtubeUrl = req.body.youtubeUrl || '';
    const videoId = extractYouTubeId(youtubeUrl) || req.body.videoId || '';
    if (!videoId) {
      return res.status(400).json({ error: 'Valid YouTube URL or Video ID is required.' });
    }

    const result = await fetchYouTubeTranscript(videoId);
    return res.json({
      success: true,
      videoId,
      totalCues: result.totalCues,
      segmentCount: result.segments.length,
      preview: result.segments.slice(0, 8).map(s => `[${secondsToTimeString(s.startSeconds)}]: ${s.text}`).join('\n')
    });
  } catch (err: any) {
    console.warn('YouTube transcript fetch failed:', err.message);
    return res.status(404).json({
      error: 'Could not fetch YouTube transcript',
      details: err.message
    });
  }
});

// POST simple generation
router.post('/generate', upload.single('file'), async (req, res) => {
  try {
    const youtubeUrl = req.body.youtubeUrl || '';
    const masterclassName = req.body.masterclassName || req.body.tag || 'Masterclass Replay';
    const playerNumber = req.body.playerNumber || '1';
    const transcriptText = req.body.transcriptText || '';
    const useYouTube = req.body.useYouTubeTranscript === true || req.body.useYouTubeTranscript === 'true';
    const file = req.file;

    const videoId = extractYouTubeId(youtubeUrl) || 'OLXSmAhpU-g';

    let segments: ParsedSegment[] = [];
    let isFromYouTube = false;

    // 1. Try file upload or pasted text
    if (file) {
      const parsed = await parseTranscriptFile(file.path, file.originalname);
      segments = parsed.segments;
      try { fs.unlinkSync(file.path); } catch {}
    } else if (transcriptText) {
      if (transcriptText.includes('-->') || transcriptText.includes('WEBVTT')) {
        segments = parseVTT(transcriptText).segments;
      } else {
        segments = parseTextLines(transcriptText).segments;
      }
    }

    // 2. If requested or if no transcript provided, fetch directly from YouTube
    if (segments.length === 0 || useYouTube) {
      try {
        console.log(`Fetching native YouTube transcript for video: ${videoId}`);
        const ytResult = await fetchYouTubeTranscript(videoId);
        segments = ytResult.segments;
        isFromYouTube = true;
        console.log(`Fetched ${ytResult.totalCues} native YouTube cues (${segments.length} grouped segments)`);
      } catch (ytErr: any) {
        console.warn(`Direct YouTube transcript fetch failed: ${ytErr.message}`);
      }
    }

    // Helper to call Gemini with multi-model fallback and retries to eliminate 503 errors
    async function callGemini(promptText: string): Promise<any> {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return null;

      const ai = new GoogleGenAI({ apiKey });
      const candidateModels = [
        'gemini-3.5-flash',
        'gemini-3.8-flash',
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash-lite'
      ];

      for (const model of candidateModels) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            console.log(`Calling Gemini API (model: ${model}, attempt: ${attempt})...`);
            const response = await ai.models.generateContent({
              model,
              contents: promptText,
              config: { responseMimeType: 'application/json' }
            });

            if (response.text) {
              let clean = response.text.trim();
              if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
              else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
              const parsed = JSON.parse(clean);
              console.log(`✅ Gemini successfully generated with model: ${model}`);
              return parsed;
            }
          } catch (err: any) {
            console.warn(`Gemini model ${model} (attempt ${attempt}) warning:`, err.status || err.message || err);
            await new Promise(r => setTimeout(r, 600));
          }
        }
      }
      return null;
    }

    let aiResult: any = null;

    // Detect speaker from masterclass name if present
    const cleanLowerName = masterclassName.toLowerCase();
    let defaultSpeaker = 'The Mystic Lotus Trainer';
    if (cleanLowerName.includes('simmin')) {
      defaultSpeaker = 'Simmin Bawa';
    } else if (cleanLowerName.includes('bnc') || cleanLowerName.includes('b&c') || cleanLowerName.includes('brenda') || cleanLowerName.includes('charu')) {
      defaultSpeaker = 'Brenda Ganwani & Charu';
    }

    // CASE A: No transcript provided or transcript was blocked by YouTube
    if (segments.length === 0) {
      console.log(`No transcript available for ${masterclassName}. Generating AI draft from video & title...`);
      const zeroPrompt = `
You are an expert copywriter and editor for "The Mystic Lotus & Dragonflies" masterclasses.
Masterclass: ${masterclassName}
Replay Video URL: ${youtubeUrl} (Video ID: ${videoId})
Default Speaker: ${defaultSpeaker}

The user has submitted this masterclass for replay code generation without an uploaded transcript file.
Generate a comprehensive, highly compelling replay draft tailored specifically to this masterclass:

1. "tag": "${masterclassName} Replay"
2. "heading": "Highlights from the Call"
3. "subheading": "Explore the breakthrough teachings, live demonstrations, and transformational shifts from ${masterclassName}."
4. "keyPoints": [
   "Opening sacred intention, centering, and energetic space creation.",
   "Core methodology, foundational teachings, and practical exercises.",
   "Live experiential demonstrations, frequency shifts, and attendee breakthroughs.",
   "Q&A clarity, group healing integration, and closing blessings."
],
5. "timestamps": 14 to 16 realistic, chronological timestamps spanning a typical 90-120 minute masterclass (e.g. 00:25, 03:40, 11:15, 22:30, 35:50, 48:20, 1:02:15, 1:15:40, 1:28:10, 1:42:00, 1:55:30).
   Focus on:
   - Welcoming & setting sacred intention
   - Core concepts & how the methodology works
   - Live guided frequency alignment & experiential meditations
   - Volunteer readings / attendee spot readings (include realistic attendee first names)
   - Releasing blockages & shifting energy
   - Q&A breakthroughs and group clearing
   - Closing blessings and next steps

6. "email":
   - "subject": Ultra-compelling subject line with high curiosity & urgency (e.g. "Instant Shifts & Miracles Inside? [Day 1 Replay] 🕊️")
   - "previewText": Compelling curiosity teaser under 85 characters.
   - "speakerName": "${defaultSpeaker}"
   - "hookText": 2-3 passionate sentences introducing the transformation, breakthroughs, and healing that happened on the call.
   - "attendeeQuotes": 3 to 4 inspiring participant feedback quotes reflecting on the shifts experienced during the session.
   - "keyMoments": 5 must-watch moments with formattedTime, punchy title, relevant emoji, and 1-sentence teaser.

Return pure JSON matching this exact structure:
{
  "tag": "${masterclassName} Replay",
  "heading": "Highlights from the Call",
  "subheading": "Explore powerful experiences, energy alignments, and transformational breakthroughs from ${masterclassName}.",
  "keyPoints": ["..."],
  "timestamps": [
    { "title": "...", "seconds": 123, "formattedTime": "MM:SS or H:MM:SS" }
  ],
  "email": {
    "subject": "...",
    "previewText": "...",
    "speakerName": "${defaultSpeaker}",
    "hookText": "...",
    "attendeeQuotes": [
      { "quote": "...", "attendeeName": "..." }
    ],
    "keyMoments": [
      { "formattedTime": "...", "title": "...", "emoji": "✨", "description": "..." }
    ]
  }
}
`;
      aiResult = await callGemini(zeroPrompt);
    } else {
      // CASE B: Transcripts are present
      // 3. Align transcript with video time (If fetched from YouTube, offset is 0 because it is natively synced)
      let offsetSeconds = 0;
      if (isFromYouTube) {
        offsetSeconds = 0;
      } else if (req.body.startOffsetSeconds !== undefined && req.body.startOffsetSeconds !== null && req.body.startOffsetSeconds !== '') {
        offsetSeconds = Math.max(0, Number(req.body.startOffsetSeconds));
      } else {
        // Automatic offset detection for Zoom uploads:
        const ytDuration = await fetchYouTubeDuration(videoId);
        const welcomeCue = segments.slice(0, 150).find(s => {
          const t = (s.text || '').toLowerCase();
          return (
            t.includes('welcome you all to the mystic lotus') ||
            (t.includes('welcome') && t.includes('masterclass')) ||
            (t.includes('mystic lotus') && (t.includes('hello') || t.includes('welcome')))
          );
        });

        if (welcomeCue && welcomeCue.startSeconds && welcomeCue.startSeconds > 60) {
          offsetSeconds = Math.max(0, Math.floor(welcomeCue.startSeconds) - 2);
          console.log(`Auto-detected welcome cue offset: ${offsetSeconds}s (${secondsToTimeString(offsetSeconds)})`);
        } else if (ytDuration && segments.length > 0) {
          const maxSegmentSec = segments[segments.length - 1].startSeconds || 0;
          if (maxSegmentSec > ytDuration + 60) {
            offsetSeconds = Math.max(0, Math.round(maxSegmentSec - ytDuration));
            console.log(`Auto-detected duration offset: ${offsetSeconds}s (${secondsToTimeString(offsetSeconds)})`);
          }
        }
      }

      if (offsetSeconds > 0) {
        segments = segments
          .filter(s => (s.startSeconds || 0) >= offsetSeconds - 5)
          .map(s => ({
            ...s,
            startSeconds: Math.max(0, Math.round((s.startSeconds || 0) - offsetSeconds)),
            endSeconds: s.endSeconds ? Math.max(0, Math.round(s.endSeconds - offsetSeconds)) : null
          }));
      }

      // 4. Intelligent transcript representation without skipping dialogue
      let sample = segments;
      if (sample.length > 600) {
        const merged: ParsedSegment[] = [];
        const ratio = Math.ceil(sample.length / 600);
        for (let i = 0; i < sample.length; i += ratio) {
          const chunk = sample.slice(i, i + ratio);
          merged.push({
            sequenceNumber: merged.length + 1,
            startSeconds: chunk[0].startSeconds,
            endSeconds: chunk[chunk.length - 1].endSeconds,
            speakerReference: chunk[0].speakerReference,
            text: chunk.map(c => c.text).join(' ')
          });
        }
        sample = merged;
      }

      const promptTranscript = sample.map(s =>
        `[${secondsToTimeString(s.startSeconds)} | ${s.speakerReference || 'Speaker'}]: ${s.text}`
      ).join('\n');

      const prompt = `
You are an expert copywriter and editor for "The Mystic Lotus & Dragonflies" masterclasses.
Masterclass: ${masterclassName}
Replay Video URL: ${youtubeUrl}
Speaker: ${defaultSpeaker}

Carefully read this actual masterclass transcript.

TASKS:
1. TIMESTAMPS: Select 14 to 18 of the ABSOLUTE BEST chronological timestamps spanning the entire call.
   - For every timestamp, pinpoint the EXACT second where that specific topic, demonstration, live healing, or volunteer interaction starts based on the transcript cues.
   - Use compelling, descriptive, transformation-focused titles (e.g. "Live Demonstration: Releasing Chronic Back Pain in Minutes", "Core Pillars of the Miracle Method", "Volunteer Hotseat: Clearing Money Anxiety for Priya").
   - Include attendee names whenever Brenda, Charu, or the trainer works with an attendee!
   - Ensure "seconds" and "formattedTime" (MM:SS or H:MM:SS) match the transcript cues.

2. EMAIL REPLAY CONTENT:
   - "subject": Ultra-compelling subject line with high curiosity & urgency (e.g. "Instant Relief from Pain in 5 Mins? Watch Day 1 Replay! 🕊️")
   - "previewText": Compelling curiosity teaser under 85 characters.
   - "speakerName": "${defaultSpeaker}"
   - "hookText": 2-3 passionate sentences describing the breakthrough healing, shifts, and transformation that took place on the call.
   - "attendeeQuotes": 3 to 4 real, authentic attendee feedback quotes directly mentioned or submitted in the call (with attendee's first name).
   - "keyMoments": 5 must-watch moments with formattedTime, punchy title, relevant emoji, and 1-sentence teaser.

Return pure JSON matching:
{
  "tag": "${masterclassName} Replay",
  "heading": "Highlights from the Call",
  "subheading": "Explore powerful experiences, energy alignments, and transformational breakthroughs from ${masterclassName}.",
  "keyPoints": [
    "...",
    "..."
  ],
  "timestamps": [
    {
      "title": "...",
      "seconds": 123,
      "formattedTime": "MM:SS or H:MM:SS"
    }
  ],
  "email": {
    "subject": "...",
    "previewText": "...",
    "speakerName": "${defaultSpeaker}",
    "hookText": "...",
    "attendeeQuotes": [
      {
        "quote": "...",
        "attendeeName": "..."
      }
    ],
    "keyMoments": [
      {
        "formattedTime": "MM:SS or H:MM:SS",
        "title": "...",
        "emoji": "✨",
        "description": "..."
      }
    ]
  }
}

Transcript:
${promptTranscript.slice(0, 80000)}
`;
      aiResult = await callGemini(prompt);
    }

    // Deterministic fallback if Gemini completely failed or was offline
    if (!aiResult) {
      console.warn('Gemini unavailable, generating structured fallback for', masterclassName);
      const step = Math.max(1, Math.floor((segments.length || 15) / 15));
      const poolTimestamps = [];
      for (let i = 0; i < (segments.length || 15) && poolTimestamps.length < 15; i += step) {
        const seg = segments[i];
        const sec = Math.round(seg ? (seg.startSeconds || i * 360) : i * 360);
        poolTimestamps.push({
          title: seg ? seg.text.slice(0, 60) : `Part ${poolTimestamps.length + 1}: Key Breakthrough & Teaching`,
          seconds: sec,
          formattedTime: secondsToTimeString(sec)
        });
      }
      aiResult = {
        tag: `${masterclassName} Replay`,
        heading: 'Highlights from the Call',
        subheading: `Explore powerful experiences, energy alignments, and transformational breakthroughs from ${masterclassName}.`,
        keyPoints: [
          'Opening sacred intention and container grounding.',
          'Experiential guided process and energetic alignment.',
          'Live volunteer spot readings and attendee breakthroughs.',
          'Integration instructions and closing blessings.'
        ],
        timestamps: poolTimestamps,
        email: {
          subject: `${masterclassName} [Replay & Key Highlights Inside] 🕊️`,
          previewText: "Some experiences can't be explained. They can only be felt. Highlights inside.",
          speakerName: defaultSpeaker,
          hookText: `Some experiences can't be explained. They can only be felt. On our recent live masterclass with <strong>${defaultSpeaker}</strong>, the session became a space of deep healing, breakthrough, and connection.`,
          attendeeQuotes: [
            { quote: "The energy in this call was so tangible. I felt an immediate release of heaviness!", attendeeName: "Participant" },
            { quote: "Within minutes, my stress dropped significantly. Thank you so much!", attendeeName: "Attendee" }
          ],
          keyMoments: poolTimestamps.slice(0, 5).map((t, idx) => ({
            formattedTime: t.formattedTime,
            title: t.title,
            emoji: ['✨', '🌸', '💫', '🕊️', '💖'][idx % 5],
            description: 'Watch this powerful breakthrough and experiential shift from the session.'
          }))
        }
      };
    }

    // Synchronize, snap to exact transcript cues, and validate every timestamp's seconds and formattedTime
    if (aiResult && Array.isArray(aiResult.timestamps)) {
      aiResult.timestamps = aiResult.timestamps.map((t: any) => {
        let sec: number | null = null;
        if (typeof t.seconds === 'number' && !isNaN(t.seconds)) {
          sec = t.seconds;
        } else if (t.formattedTime) {
          sec = timeStringToSeconds(t.formattedTime);
        }
        sec = Math.max(0, Math.round(sec || 0));

        // Precision snapping if segments are present: align to nearest cue start within +/- 20s
        if (segments.length > 0) {
          sec = snapTimestampToTranscript(sec, segments);
        }

        const formatted = secondsToTimeString(sec);

        return {
          title: (t.title || 'Masterclass Highlight').trim(),
          seconds: sec,
          formattedTime: formatted
        };
      });
    }

    // Construct Replay Email Data based on AI extraction
    const topTimestamps = (aiResult.timestamps || []).slice(0, 6);
    const fallbackMoments = topTimestamps.map((t: any, idx: number) => {
      const emojis = ['🌏', '🌸', '✨', '🕊️', '💫', '💖'];
      return {
        formattedTime: t.formattedTime,
        title: t.title,
        emoji: emojis[idx % emojis.length],
        description: `Watch this powerful breakthrough and channeled shift from the session.`
      };
    });

    const aiEmail = aiResult.email || {};
    const speakerName = aiEmail.speakerName || defaultSpeaker;
    const emailData: ReplayEmailData = {
      masterclassName,
      speakerName,
      videoId,
      replayUrl: `https://www.youtube.com/watch?v=${videoId}`,
      bookingUrl: 'https://themysticlotus.com/booking',
      subject: aiEmail.subject || `${masterclassName} [Replay Inside] 🕊️`,
      previewText: aiEmail.previewText || "Some experiences can't be explained. They can only be felt. Highlights inside.",
      hookText: aiEmail.hookText || `Some experiences can't be explained. They can only be felt. On our recent live call with Expert Healer-Trainer <strong>${speakerName}</strong>, the <strong>${masterclassName}</strong> became a space of deep healing, surrender, and connection.`,
      attendeeQuotes: (aiEmail.attendeeQuotes && aiEmail.attendeeQuotes.length > 0)
        ? aiEmail.attendeeQuotes
        : [
            { quote: "The energy in this call was so tangible. I felt an immediate release of heaviness!", attendeeName: "Participant" },
            { quote: "Within minutes, my stress and pain dropped significantly. Thank you so much!", attendeeName: "Attendee" }
          ],
      keyMoments: (aiEmail.keyMoments && aiEmail.keyMoments.length > 0)
        ? aiEmail.keyMoments
        : fallbackMoments
    };

    const emailHtml = generateReplayEmailHtml(emailData);

    const wordpressHtml = generateWordPressEmbedCode({
      videoId,
      tag: aiResult.tag || `${masterclassName} Replay`,
      heading: aiResult.heading || 'Highlights from the Call',
      subheading: aiResult.subheading || `Explore powerful healing experiences, energy alignments, group healings, and transformational breakthroughs from ${masterclassName}.`,
      playerNumber,
      timestamps: aiResult.timestamps
    });

    return res.json({
      videoId,
      tag: aiResult.tag || `${masterclassName} Replay`,
      heading: aiResult.heading || 'Highlights from the Call',
      subheading: aiResult.subheading,
      keyPoints: aiResult.keyPoints,
      playerNumber,
      offsetSeconds: 0,
      source: isFromYouTube ? 'youtube' : (segments.length > 0 ? 'upload' : 'ai_draft'),
      cueCount: segments.length,
      timestamps: aiResult.timestamps,
      wordpressHtml,
      emailData,
      emailHtml
    });
  } catch (err: any) {
    console.error('Simple generation failed:', err);
    return res.status(500).json({ error: 'Failed to generate', details: err.message });
  }
});

export default router;
