const API_BASE = '/api';

export interface EmailQuote {
  quote: string;
  attendeeName: string;
}

export interface EmailMoment {
  formattedTime: string;
  title: string;
  emoji?: string;
  description: string;
}

export interface ReplayEmailData {
  masterclassName: string;
  speakerName?: string;
  videoId: string;
  replayUrl?: string;
  bookingUrl?: string;
  subject?: string;
  previewText?: string;
  hookText?: string;
  attendeeQuotes?: EmailQuote[];
  keyMoments?: EmailMoment[];
  whatsappNumber?: string;
  supportEmail?: string;
  supportPhone?: string;
}

export interface SimpleReplayResponse {
  videoId: string;
  tag: string;
  heading: string;
  subheading: string;
  keyPoints: string[];
  playerNumber: string;
  timestamps: Array<{
    title: string;
    seconds: number;
    formattedTime: string;
  }>;
  offsetSeconds?: number;
  source?: 'youtube' | 'upload';
  cueCount?: number;
  wordpressHtml: string;
  emailData?: ReplayEmailData;
  emailHtml?: string;
}

export interface YouTubeTranscriptInfo {
  success: boolean;
  videoId: string;
  totalCues: number;
  segmentCount: number;
  preview: string;
}

export const api = {
  async getSimpleDefault(): Promise<SimpleReplayResponse> {
    const res = await fetch(`${API_BASE}/simple/default`);
    if (!res.ok) {
      throw new Error('Failed to load default data');
    }
    return res.json();
  },

  async fetchYouTubeTranscript(youtubeUrl: string): Promise<YouTubeTranscriptInfo> {
    const res = await fetch(`${API_BASE}/simple/fetch-youtube-transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ youtubeUrl })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch YouTube transcript' }));
      throw new Error(err.details || err.error || 'Failed to fetch transcript from YouTube');
    }
    return res.json();
  },

  async generateSimpleWordPress(data: FormData): Promise<SimpleReplayResponse> {
    const res = await fetch(`${API_BASE}/simple/generate`, {
      method: 'POST',
      body: data
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Failed to generate code');
    }
    return res.json();
  }
};
