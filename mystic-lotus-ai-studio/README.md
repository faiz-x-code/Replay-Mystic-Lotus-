# Mystic Lotus Replay Code Generator

A streamlined web application for **The Mystic Lotus & Dragonflies** to convert YouTube masterclass replay links and Zoom transcripts into ready-to-paste WordPress embed code with clickable video timestamps.

---

## 🌟 Key Features

- **Direct Inputs**:
  - Masterclass Name (e.g. `Simmin Bawa Masterclass - Day 2` or `B&C Miracle Method Day 1`)
  - YouTube Video Link
  - Player ID Number Selector (`Player 1`, `Player 2`, `Player 3`, or custom)
  - Transcript Upload (`.txt`, `.vtt`, `.srt`, `.docx`, `.pdf`, or paste directly)
- **AI Selection**: Automatically selects 12–18 of the best chronological timestamps and key highlights spanning the entire session using Gemini 3.8 Flash.
- **Clickable Live Preview**: Test video seeking directly in the browser—clicking any timestamp button immediately seeks the embedded video and plays.
- **WordPress Ready**: Generates the exact WordPress replay card HTML, responsive CSS, and YouTube iframe player API script configured for the selected player ID.
- **1-Click Copy**: Copy the entire embed code to paste directly into any WordPress Custom HTML block.

---

## 🚀 Quickstart

### 1. Start the Backend API
```bash
cd backend
npm install
npm run dev
```
Backend runs on `http://localhost:4000`.

### 2. Start the Frontend App
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.
