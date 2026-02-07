# Deployment Guide - Mobile-Ready YouTube Tools

This app is now a **Next.js Progressive Web App (PWA)** that can be installed on your phone and used anywhere!

## 🚀 Quick Deploy to Vercel (Frontend)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set environment variable:**
   - Create `.env.local` file:
   ```
   NEXT_PUBLIC_API_BASE_URL=https://your-backend.onrender.com
   ```
   - Or set it in Vercel dashboard after deployment

3. **Deploy to Vercel:**
   ```bash
   npm i -g vercel
   vercel
   ```

4. **After deployment, set environment variable in Vercel:**
   - Go to your project → Settings → Environment Variables
   - Add: `NEXT_PUBLIC_API_BASE_URL` = your backend URL

## 🔧 Deploy Backend to Render

1. **Go to [render.com](https://render.com)** and sign up
2. **Create a new Web Service:**
   - Connect your GitHub repo
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app --bind 0.0.0.0:$PORT --timeout 600 --workers 2`
   - **Environment:** Python 3
3. **Copy your backend URL** (e.g., `https://your-app.onrender.com`)
4. **Update frontend** with this URL (see step 2 above)

## 📱 Install on Your Phone

Once deployed:

1. **Open the Vercel URL on your phone's browser**
2. **On iOS Safari:** Tap Share → Add to Home Screen
3. **On Android Chrome:** Tap Menu → Add to Home Screen / Install App
4. **The app will work offline** (cached) and look like a native app!

## 🎯 Why This Setup?

- ✅ **Next.js on Vercel** = Fast, global CDN, perfect for mobile
- ✅ **PWA** = Installable on phone, works offline
- ✅ **Flask on Render** = Handles heavy yt-dlp processing
- ✅ **Mobile-optimized** = Responsive design, touch-friendly

## 🔄 Local Development

```bash
# Frontend (Next.js)
npm run dev
# Opens on http://localhost:3000

# Backend (Flask) - in separate terminal
python app.py
# Opens on http://localhost:5000

# Set API URL for local dev
# Create .env.local:
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

## 📝 Notes

- The frontend and backend are now **separate** - this is intentional!
- Frontend = Fast, static, on Vercel
- Backend = Heavy processing, on Render
- They communicate via API calls
