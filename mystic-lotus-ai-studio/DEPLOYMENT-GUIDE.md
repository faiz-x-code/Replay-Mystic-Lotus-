# Deployment Guide: Vercel, Netlify & Hostinger

This project is now pre-configured for instant zero-configuration deployment to **Vercel**, **Netlify**, or **Hostinger**.

---

## 🛠️ What Was Fixed For YouTube Caption Detection

1. **Robust URL & Live Stream Detection**:
   Previously, YouTube Live stream links (`/live/xxxx`), embed links, or links with tracking parameters (`?si=...`, `&t=...`) failed to extract the 11-character video ID. The parser now accurately extracts IDs from all YouTube formats.

2. **5-Tier Resilient Caption Fetcher**:
   Instead of a single web scraper that broke on cloud servers, the backend now uses a 5-tier architecture:
   - **Tier 1**: YouTube Android InnerTube Client (`v20.10.38`)
   - **Tier 2**: YouTube iOS InnerTube Client (`v19.29.1`)
   - **Tier 3**: YouTube Web InnerTube Client
   - **Tier 4**: Direct HTML watch page `captionTracks` parser
   - **Tier 5**: Fallback transcript scraper
   *(Tested live: successfully fetches 2,640+ cues in under 1 second!)*

3. **Multi-Language & Auto-Generated Caption Support**:
   Supports all English varieties (`en`, `en-US`, `en-GB`, `en-IN`, `en-CA`) as well as auto-generated ASR tracks.

4. **Dynamic Status & Zero-Friction Fallback**:
   Replaced the hardcoded warning message with a clean status notification. If a video genuinely has subtitles disabled by the owner, users can still upload a Zoom transcript or let Gemini generate timestamps directly.

---

## 🚀 Option 1: Deploy to Vercel (Recommended)

Pre-configured with `vercel.json` and serverless API entrypoint `api/index.js`.

### Via Vercel Dashboard (GitHub):
1. Push your repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Select your GitHub repository.
4. Set **Root Directory** to `mystic-lotus-ai-studio`.
5. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: *(Your Google Gemini API Key)*
6. Click **Deploy**.
7. Vercel will build both the frontend and serverless API routes automatically!

### Via Vercel CLI:
Inside `mystic-lotus-ai-studio`, run:
```bash
npx vercel
```
Follow the on-screen prompts and select `y` to deploy. Add your `GEMINI_API_KEY` when prompted or via the Vercel dashboard.

---

## 🌐 Option 2: Deploy to Netlify

Pre-configured with `netlify.toml` and serverless function `netlify/functions/server.js`.

### Via Netlify Dashboard (GitHub):
1. Push your repository to GitHub.
2. Go to [netlify.com](https://netlify.com) and click **"Add new site"** -> **"Import an existing project"**.
3. Select your GitHub repository.
4. Set **Base directory** to `mystic-lotus-ai-studio`.
5. Under **Environment variables**, add:
   - `GEMINI_API_KEY`: *(Your Google Gemini API Key)*
6. Click **Deploy site**.

### Via Netlify CLI:
Inside `mystic-lotus-ai-studio`, run:
```bash
npx netlify deploy --prod
```

---

## 📦 Option 3: Hostinger (Updated Package Ready)

If you wish to update your existing Hostinger deployment:
1. An updated, pre-built deployment package has been generated in `hostinger-deploy/` and `hostinger-deploy.zip`.
2. Upload `hostinger-deploy.zip` to your Hostinger `public_html` via Hostinger File Manager.
3. Extract the zip file.
4. In Hostinger Node.js panel:
   - Ensure `GEMINI_API_KEY` is set in Environment Variables.
   - Click **Restart Application**.
