import 'dotenv/config';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenAI } from '@google/genai';

async function run() {
  console.log('1. Fetching YouTube transcript for mLDuHGy_Nsc...');
  const raw = await YoutubeTranscript.fetchTranscript('mLDuHGy_Nsc');
  console.log('Got raw cues:', raw.length);

  const segments = [];
  let current = { startSec: Math.floor(raw[0].offset / 1000), text: '' };
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    current.text += (current.text ? ' ' : '') + item.text;
    if (i % 8 === 0 || i === raw.length - 1) {
      segments.push({ startSec: current.startSec, text: current.text });
      if (i < raw.length - 1) current = { startSec: Math.floor(raw[i + 1].offset / 1000), text: '' };
    }
  }

  const transcriptText = segments.map(s => {
    const m = Math.floor(s.startSec / 60);
    const sec = s.startSec % 60;
    const timeStr = m >= 60 ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') + ':' + String(sec).padStart(2, '0') : m + ':' + String(sec).padStart(2, '0');
    return '[' + timeStr + ']: ' + s.text;
  }).join('\n');

  console.log('2. Calling Gemini with prompt...');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `
You are an expert copywriter and editor for "The Mystic Lotus and Dragonflies" spiritual masterclasses.
Masterclass: BNC Masterclass - Day 1
Video URL: https://www.youtube.com/watch?v=mLDuHGy_Nsc

Carefully read this actual masterclass transcript.

TASKS:
1. TIMESTAMPS: Select 14 to 18 of the most engaging, chronological timestamps spanning the entire call.
   - For every timestamp, pinpoint the EXACT second where that specific topic, demonstration, live healing, or volunteer interaction starts.
   - Use compelling, descriptive, transformation-focused titles (e.g. "Live Demonstration: Releasing Chronic Back Pain in Minutes", "Charu Shares the 3 Core Pillars of the Miracle Method", "Volunteer Hotseat: Clearing Money Anxiety for Priya").
   - Include attendee names whenever Brenda or Charu work with an attendee!

2. EMAIL REPLAY CONTENT:
   - "subject": Ultra-compelling subject line with high curiosity and urgency (e.g. "Instant Relief from Pain in 5 Mins? Watch Day 1 Replay! 🕊️")
   - "previewText": Compelling teaser under 85 characters.
   - "speakerName": "Brenda Ganwani and Charu"
   - "hookText": 2-3 passionate sentences describing what happened on the call.
   - "attendeeQuotes": 3 to 4 real, authentic attendee feedback quotes directly mentioned or submitted in the call.
   - "keyMoments": 5 must-watch moments with formattedTime, punchy title, relevant emoji, and 1-sentence teaser.

Return pure JSON matching:
{
  "tag": "BNC Masterclass Replay",
  "heading": "Highlights from Day 1 with Brenda and Charu",
  "subheading": "Discover how the B&C Miracle Method releases chronic pain, shifts emotional patterns, and creates miraculous healings.",
  "keyPoints": ["..."],
  "timestamps": [
    { "title": "...", "seconds": 123, "formattedTime": "MM:SS or H:MM:SS" }
  ],
  "email": {
    "subject": "...",
    "previewText": "...",
    "speakerName": "Brenda Ganwani and Charu",
    "hookText": "...",
    "attendeeQuotes": [
      { "quote": "...", "attendeeName": "..." }
    ],
    "keyMoments": [
      { "formattedTime": "...", "title": "...", "emoji": "✨", "description": "..." }
    ]
  }
}

Transcript:
${transcriptText.slice(0, 75000)}
`;

  const res = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });

  const data = JSON.parse(res.text);
  console.log('✅ Generated successfully!');
  console.log('Timestamps count:', data.timestamps.length);
  console.log('Timestamps sample:', JSON.stringify(data.timestamps.slice(0, 5), null, 2));
  console.log('Email subject:', data.email.subject);
  console.log('Email previewText:', data.email.previewText);
  console.log('Email quotes count:', data.email.attendeeQuotes?.length);
  console.log('Email quotes sample:', JSON.stringify(data.email.attendeeQuotes?.slice(0, 2), null, 2));
  console.log('Email moments count:', data.email.keyMoments?.length);
  console.log('Email moments sample:', JSON.stringify(data.email.keyMoments?.slice(0, 3), null, 2));
}

run().catch(console.error);
