# 🚀 Backend Deployment Guide - Step by Step

Follow these steps to deploy your Flask backend so your mobile app works!

## Step 1: Deploy Backend to Render

### 1.1 Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up (free tier available)
3. Connect your GitHub account

### 1.2 Create New Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: `Darshika482/youtube-subtitles`
3. Select the repository

### 1.3 Configure the Service

**Basic Settings:**
- **Name:** `youtube-subtitles-backend` (or any name you like)
- **Region:** Choose closest to you
- **Branch:** `main`
- **Root Directory:** Leave empty (or `./` if needed)

**Build & Deploy:**
- **Environment:** `Python 3`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `gunicorn app:app --bind 0.0.0.0:$PORT --timeout 600 --workers 2`

> **Note:** Node.js is NOT required. Transcript extraction uses `youtube-transcript-api` (pure Python).

**Advanced Settings (Optional but Recommended):**
- **Auto-Deploy:** `Yes` (deploys on every push to main)
- **Health Check Path:** `/health`

### 1.4 Deploy
1. Click **"Create Web Service"**
2. Wait for deployment (5-10 minutes)
3. Copy your service URL (e.g., `https://youtube-subtitles-backend.onrender.com`)

### 1.5 Test Your Backend
Open in browser: `https://your-backend-url.onrender.com/health`

You should see:
```json
{"status": "ok", "message": "Server is running"}
```

---

## Step 2: Configure Vercel Environment Variable

### 2.1 Go to Vercel Dashboard
1. Go to [vercel.com](https://vercel.com)
2. Sign in and select your project

### 2.2 Add Environment Variable
1. Go to **Settings** → **Environment Variables**
2. Click **"Add New"**
3. Enter:
   - **Key:** `NEXT_PUBLIC_API_BASE_URL`
   - **Value:** `https://your-backend-url.onrender.com` (use the URL from Step 1.4)
   - **Environment:** Select all (Production, Preview, Development)
4. Click **"Save"**

### 2.3 Redeploy
1. Go to **Deployments** tab
2. Click **"..."** on latest deployment → **"Redeploy"**
3. Or push a new commit to trigger auto-deploy

---

## Step 3: Test on Mobile

### 3.1 Open Your Vercel Site
- Open `https://your-vercel-app.vercel.app` on your phone

### 3.2 Test Transcript Extraction
1. Enter a YouTube playlist URL
2. Click "Extract Transcripts"
3. Should work! ✅

### 3.3 Troubleshooting
If it doesn't work:
- Check browser console for errors
- Verify backend URL is correct in Vercel env vars
- Check Render logs for backend errors
- Make sure backend is running (check `/health` endpoint)

---

## Alternative: Deploy to Railway (Easier Setup)

If Render is too slow or complex, try Railway:

### Railway Setup:
1. Go to [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub**
3. Select your repo
4. Railway auto-detects Python and runs `app.py`
5. Add environment variable: `PORT=5000` (if needed)
6. Get your Railway URL
7. Update Vercel env var with Railway URL

---

## Quick Checklist

- [ ] Backend deployed to Render/Railway
- [ ] Backend URL copied (e.g., `https://xxx.onrender.com`)
- [ ] `NEXT_PUBLIC_API_BASE_URL` set in Vercel
- [ ] Vercel app redeployed
- [ ] Tested `/health` endpoint works
- [ ] Tested on mobile device
- [ ] Transcript extraction works ✅

---

## Common Issues

### Issue: Backend times out
**Solution:** Render free tier spins down after 15 min inactivity. First request may take 30-60 seconds to wake up.

### Issue: CORS errors
**Solution:** Your backend already has CORS enabled. If issues persist, check Render logs.

### Issue: yt-dlp not found
**Solution:** Make sure `requirements.txt` includes `yt-dlp>=2024.1.0` (it does!)

### Issue: Environment variable not working
**Solution:** 
- Make sure variable name is exactly `NEXT_PUBLIC_API_BASE_URL`
- Redeploy after adding the variable
- Check it's set for all environments (Production, Preview, Development)

---

## Need Help?

If you get stuck:
1. Check Render deployment logs
2. Check Vercel deployment logs
3. Test backend directly: `curl https://your-backend.onrender.com/health`
4. Check browser console on mobile for specific errors
