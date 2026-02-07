# 🔧 Fix for Render Deployment - Node.js Installation

## Problem
Videos are being skipped on Render because Node.js (JavaScript runtime) is not available. yt-dlp requires Node.js for modern YouTube extraction.

## Solution

### Option 1: Install Node.js in Build Command (Recommended)

1. Go to your Render dashboard
2. Select your backend service
3. Go to **Settings** → **Build & Deploy**
4. Update the **Build Command** to:
   ```bash
   pip install -r requirements.txt && curl -fsSL https://nodejs.org/dist/v20.11.0/node-v20.11.0-linux-x64.tar.xz -o /tmp/node.tar.xz && cd /tmp && tar -xf node.tar.xz && export PATH=$PATH:/tmp/node-v20.11.0-linux-x64/bin && node --version
   ```

5. Update the **Start Command** to:
   ```bash
   export PATH=$PATH:/tmp/node-v20.11.0-linux-x64/bin:$PATH && gunicorn app:app --bind 0.0.0.0:$PORT --timeout 600 --workers 2
   ```

6. Click **Save Changes**
7. Go to **Manual Deploy** → **Deploy latest commit**

### Option 2: Use Environment Variable (Alternative)

If Option 1 doesn't work, you can set Node.js path via environment variable:

1. Go to **Environment** tab in Render
2. Add environment variable:
   - **Key:** `NODE_PATH`
   - **Value:** `/tmp/node-v20.11.0-linux-x64/bin`
3. Update **Start Command** to:
   ```bash
   export PATH=$PATH:$NODE_PATH:$PATH && gunicorn app:app --bind 0.0.0.0:$PORT --timeout 600 --workers 2
   ```

### Option 3: Use Render's Native Node.js Support

If the above don't work, consider deploying to a service that supports both Python and Node.js, or use Railway/Render's Docker option.

## Verification

After deployment, check the logs. You should see:
```
Detected Node.js: v20.11.0
Using JavaScript runtime: node
```

If you see:
```
WARNING: No JavaScript runtime found. Trying without JS runtime...
```

Then Node.js installation failed, and you need to try a different approach.

## Testing

1. Test the `/health` endpoint
2. Try extracting transcripts from a small playlist (2-3 videos)
3. Check Render logs for any errors
4. If videos still skip, check the error messages in the logs

## Notes

- The app will still work without Node.js, but may skip more videos
- Android/iOS client strategies are prioritized when JS runtime is not available
- Some videos may still fail if they require JavaScript for extraction
