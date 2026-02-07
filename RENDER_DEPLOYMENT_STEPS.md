# 🎯 Quick Render Deployment (Copy-Paste Guide)

## Step-by-Step Instructions

### 1️⃣ Go to Render
Visit: https://render.com and sign up/login

### 2️⃣ Create New Web Service
1. Click **"New +"** button (top right)
2. Select **"Web Service"**
3. Connect GitHub if not already connected
4. Find and select: **`Darshika482/youtube-subtitles`**

### 3️⃣ Configure (Copy These Settings)

**Name:**
```
youtube-subtitles-backend
```

**Region:**
```
Choose closest to you (e.g., Oregon, Frankfurt)
```

**Branch:**
```
main
```

**Root Directory:**
```
(leave empty)
```

**Runtime:**
```
Python 3
```

**Build Command:**
```
pip install -r requirements.txt
```

**Start Command:**
```
gunicorn app:app --bind 0.0.0.0:$PORT --timeout 600 --workers 2
```

> ✅ **No Node.js needed!** Transcript extraction now uses `youtube-transcript-api` (pure Python, works everywhere).

### 4️⃣ Advanced Settings (Optional)
- **Health Check Path:** `/health`
- **Auto-Deploy:** `Yes`

### 5️⃣ Create & Wait
1. Click **"Create Web Service"**
2. ⏳ Wait 5-10 minutes for first deployment
3. 📋 **Copy your service URL** (looks like: `https://youtube-subtitles-backend-xxxx.onrender.com`)

### 6️⃣ Test Backend
Open in browser: `https://your-url.onrender.com/health`

Should show:
```json
{"status": "ok", "message": "Server is running"}
```

---

## ✅ Next: Configure Vercel

1. Go to **Vercel Dashboard** → Your Project
2. **Settings** → **Environment Variables**
3. Add:
   - **Name:** `NEXT_PUBLIC_API_BASE_URL`
   - **Value:** `https://your-url.onrender.com` (from step 5)
4. **Save** and **Redeploy**

---

## 🎉 Done!

Your mobile app should now work! Test it on your phone.
