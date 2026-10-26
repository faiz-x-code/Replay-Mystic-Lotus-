import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { parseVTT, parseTextLines } from '../src/services/transcript/parser.js';

describe('1. Health Check', () => {
  it('should return health status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('mystic-lotus-replay-generator');
  });
});

describe('2. Transcript Parser', () => {
  it('should accurately parse VTT cues with timestamps and speakers', () => {
    const sampleVtt = `WEBVTT

00:00:15.000 --> 00:00:20.000
<v Riashi>Welcome everyone to our sacred session.</v>

00:00:25.000 --> 00:00:30.000
Sarah: I felt an immediate shift in frequency.
`;
    const parsed = parseVTT(sampleVtt);
    expect(parsed.totalSegments).toBe(2);
    expect(parsed.hasTimestamps).toBe(true);
    expect(parsed.segments[0].startSeconds).toBe(15);
    expect(parsed.segments[0].speakerReference).toBe('Riashi');
    expect(parsed.segments[1].startSeconds).toBe(25);
    expect(parsed.segments[1].speakerReference).toBe('Sarah');
  });

  it('should parse text lines without fabricating timestamps', () => {
    const sampleTxt = `First paragraph of teachings on sacred resonance.
Second paragraph explaining energetic alignment and grace.`;
    const parsed = parseTextLines(sampleTxt);
    expect(parsed.totalSegments).toBe(2);
    expect(parsed.hasTimestamps).toBe(false);
    expect(parsed.segments[0].startSeconds).toBe(null);
  });
});

describe('3. Replay Code Generator API', () => {
  it('should return default replay data with ytplayer1', async () => {
    const res = await request(app).get('/api/simple/default');
    expect(res.status).toBe(200);
    expect(res.body.videoId).toBe('OLXSmAhpU-g');
    expect(res.body.wordpressHtml).toContain('ytplayer1');
    expect(res.body.timestamps.length).toBeGreaterThan(0);
  });

  it('should generate replay code for Player 2 (ytplayer2 and jumpTo2)', async () => {
    const res = await request(app)
      .post('/api/simple/generate')
      .send({
        masterclassName: 'Simmin Bawa Masterclass - Day 2',
        youtubeUrl: 'https://www.youtube.com/watch?v=OLXSmAhpU-g',
        playerNumber: '2'
      });
    expect(res.status).toBe(200);
    expect(res.body.wordpressHtml).toContain('ytplayer2');
    expect(res.body.wordpressHtml).toContain('jumpTo2(');
  });

  it('should generate replay code for Player 1 (ytplayer1 and jumpTo1)', async () => {
    const res = await request(app)
      .post('/api/simple/generate')
      .send({
        masterclassName: 'Simmin Bawa Masterclass - Day 1',
        youtubeUrl: 'https://www.youtube.com/watch?v=OLXSmAhpU-g',
        playerNumber: '1'
      });
    expect(res.status).toBe(200);
    expect(res.body.wordpressHtml).toContain('ytplayer1');
    expect(res.body.wordpressHtml).toContain('jumpTo1(');
  });
});
