# Live Public Link Rule

Whenever the user asks: **"provide me Live Public Link"** (or similar queries for the live/public URL):

1. **Verify Local Servers**:
   - Backend on `http://localhost:4000` (`npm run dev` in `mystic-lotus-ai-studio/backend`).
   - Frontend on `http://localhost:5173` (`npm run dev` in `mystic-lotus-ai-studio/frontend`).
2. **Cloudflare Tunnel**:
   - Check if the tunnel task (`.\cloudflared.exe tunnel --url http://localhost:5173`) is active.
   - If not running, start it using `run_command` with `IsDaemon: true` and read the active `*.trycloudflare.com` URL from its log.
   - If running, read the active tunnel URL from the task log.
3. **Provide Active Working Link**:
   - Immediately provide the active `https://*.trycloudflare.com` link to the user.
   - Remind them that it provides full residential-IP YouTube caption extraction and complete app functionality without passwords.
