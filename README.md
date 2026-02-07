# YouTube Playlist Transcript App

A **Progressive Web App (PWA)** to extract transcripts from YouTube playlists and download videos. Built with **Next.js** (frontend) and **Flask** (backend).

## ✨ Features

- 📱 **Installable on your phone** - Works like a native app
- 🚀 **Fast & Responsive** - Optimized for mobile devices
- 📝 **Transcript Extraction** - Extract clean transcripts from YouTube playlists
- ⬇️ **Video Downloader** - Download videos, audio, or subtitles
- 🌐 **Works Anywhere** - Deployed on Vercel (frontend) + Render (backend)

## 🚀 Quick Start (Local Development)

### Frontend (Next.js)

```bash
# Install dependencies
npm install

# Run development server
npm run dev
# Opens on http://localhost:3000
```

### Backend (Flask)

```bash
# Install Python dependencies
pip install -r requirements.txt

# Run Flask server
python app.py
# Opens on http://localhost:5000
```

### Configure API Connection

Create `.env.local` in the root directory:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

## 📦 Deployment

### Step 1: Deploy Backend to Render

1. Go to [render.com](https://render.com) and create an account
2. Create a new **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app --bind 0.0.0.0:$PORT --timeout 600 --workers 2`
   - **Environment:** Python 3
5. Copy your backend URL (e.g., `https://your-app.onrender.com`)

### Step 2: Deploy Frontend to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Set environment variable in Vercel Dashboard:**
   - Go to Project → Settings → Environment Variables
   - Add: `NEXT_PUBLIC_API_BASE_URL` = `https://your-app.onrender.com`

4. **Redeploy:**
   ```bash
   vercel --prod
   ```

### Step 3: Add PWA Icons (Optional but Recommended)

Create two icon files:
- `public/icon-192.png` (192x192 pixels)
- `public/icon-512.png` (512x512 pixels)

You can use any image editor or online tool to create these.

## 📱 Install on Your Phone

Once deployed to Vercel:

1. **Open the Vercel URL** on your phone's browser
2. **iOS Safari:** Tap Share → Add to Home Screen
3. **Android Chrome:** Tap Menu → Add to Home Screen / Install App
4. **The app will appear on your home screen** and work like a native app!

## 🏗️ Project Structure

```
├── app/                    # Next.js app directory
│   ├── layout.tsx          # Root layout with PWA config
│   ├── page.tsx            # Main page
│   └── globals.css         # Global styles
├── components/             # React components
│   ├── TranscriptExtractor.tsx
│   └── VideoDownloader.tsx
├── lib/                    # Utilities
│   └── api.ts             # API client
├── public/                 # Static files
│   └── manifest.json      # PWA manifest
├── app.py                  # Flask backend
├── requirements.txt       # Python dependencies
└── package.json           # Node dependencies
```

## 🔧 Configuration

- **Local Development:** Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000` in `.env.local`
- **Production:** Set `NEXT_PUBLIC_API_BASE_URL` in Vercel environment variables

## ⚠️ Important Notes

- **Flask backend** must be deployed separately (Render, Railway, etc.) - Vercel cannot run long-running Python servers
- **Frontend and backend** communicate via API calls
- The app is **mobile-optimized** with responsive design
- **PWA features** work best when deployed (not in localhost)

## 📝 License

MIT
