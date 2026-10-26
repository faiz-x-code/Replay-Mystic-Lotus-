import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const deployDir = path.join(rootDir, 'hostinger-deploy');

console.log('🚀 Preparing Hostinger deployment package...');

// 1. Build frontend & backend
console.log('📦 Building frontend...');
execSync('npm run build', { cwd: path.join(rootDir, 'frontend'), stdio: 'inherit' });

console.log('📦 Building backend...');
execSync('npm run build', { cwd: path.join(rootDir, 'backend'), stdio: 'inherit' });

// 2. Prepare clean directory
if (fs.existsSync(deployDir)) {
  fs.rmSync(deployDir, { recursive: true, force: true });
}
fs.mkdirSync(deployDir, { recursive: true });
fs.mkdirSync(path.join(deployDir, 'backend'), { recursive: true });

// 3. Copy files
console.log('📂 Copying files to hostinger-deploy/...');

// Copy backend dist
fs.cpSync(path.join(rootDir, 'backend/dist'), path.join(deployDir, 'backend/dist'), { recursive: true });

// Copy frontend dist as public
fs.cpSync(path.join(rootDir, 'frontend/dist'), path.join(deployDir, 'public'), { recursive: true });

// Copy server.js
fs.copyFileSync(path.join(rootDir, 'server.js'), path.join(deployDir, 'server.js'));

// Create production package.json for Hostinger
const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const deployPkg = {
  name: rootPkg.name,
  version: rootPkg.version,
  private: true,
  type: 'module',
  main: 'server.js',
  scripts: {
    start: 'node server.js'
  },
  dependencies: rootPkg.dependencies
};
fs.writeFileSync(path.join(deployDir, 'package.json'), JSON.stringify(deployPkg, null, 2));

// Create .env.example
const envContent = `# Hostinger Environment Variables
PORT=4000
NODE_ENV=production
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
`;
fs.writeFileSync(path.join(deployDir, '.env.example'), envContent);

// Also copy existing backend .env if it has GEMINI_API_KEY
const backendEnvPath = path.join(rootDir, 'backend/.env');
if (fs.existsSync(backendEnvPath)) {
  fs.copyFileSync(backendEnvPath, path.join(deployDir, '.env'));
} else {
  fs.writeFileSync(path.join(deployDir, '.env'), envContent);
}

// 4. Create README for Hostinger
const guide = `# Hostinger Deployment Guide

This package contains everything needed to run the Mystic Lotus Replay Code Generator on Hostinger.

## Option A: Hostinger Cloud / Business Hosting (hPanel Node.js)
1. In Hostinger hPanel, go to **Websites** -> Manage -> search for **Node.js**.
2. Click **Create Application**:
   - **Node.js version**: 20.x or 18.x
   - **Application root**: \`public_html\` (or your domain root folder)
   - **Application startup file**: \`server.js\`
3. Upload all files from this \`hostinger-deploy\` folder to that folder via Hostinger **File Manager** (or FTP).
4. In hPanel Node.js panel:
   - Click **Run NPM Install** (or install dependencies).
   - In Environment Variables, ensure \`GEMINI_API_KEY\` is set.
5. Click **Start Application**.
6. Visit your domain! Both the React UI and the AI backend are running together seamlessly.

---

## Option B: Hostinger VPS (Ubuntu/Debian)
1. Connect via SSH to your VPS.
2. Upload this \`hostinger-deploy\` folder.
3. In the directory, run:
   \`\`\`bash
   npm install --omit=dev
   pm2 start server.js --name "mystic-lotus"
   pm2 save
   \`\`\`
4. Point Nginx reverse proxy to \`http://127.0.0.1:4000\`.
`;

fs.writeFileSync(path.join(deployDir, 'HOSTINGER-GUIDE.md'), guide);

console.log('✅ Hostinger deployment package ready in: ' + deployDir);
