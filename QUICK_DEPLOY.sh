#!/bin/bash
# Quick deployment checklist script
# Run this to verify your setup

echo "🚀 YouTube Playlist Transcript App - Deployment Checklist"
echo "=========================================================="
echo ""

# Check if backend URL is set
if [ -z "$NEXT_PUBLIC_API_BASE_URL" ]; then
    echo "❌ NEXT_PUBLIC_API_BASE_URL is not set"
    echo "   Set it in Vercel: Settings → Environment Variables"
    echo "   Value should be: https://your-backend.onrender.com"
else
    echo "✅ NEXT_PUBLIC_API_BASE_URL is set: $NEXT_PUBLIC_API_BASE_URL"
fi

echo ""
echo "📋 Deployment Steps:"
echo "1. Deploy backend to Render: https://render.com"
echo "2. Copy backend URL (e.g., https://xxx.onrender.com)"
echo "3. Set NEXT_PUBLIC_API_BASE_URL in Vercel"
echo "4. Redeploy Vercel app"
echo "5. Test on mobile!"
echo ""
echo "📖 Full guide: See DEPLOY_BACKEND.md"
