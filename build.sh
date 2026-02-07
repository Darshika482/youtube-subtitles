#!/bin/bash
# Build script for Render deployment
# Installs Node.js and Python dependencies

set -e

echo "🔧 Installing Node.js..."
# Install Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs || {
    # Fallback: try alternative installation method
    curl -fsSL https://nodejs.org/dist/v20.11.0/node-v20.11.0-linux-x64.tar.xz | tar -xJ
    export PATH=$PATH:$(pwd)/node-v20.11.0-linux-x64/bin
}

echo "✅ Node.js version:"
node --version || echo "⚠️ Node.js installation failed, continuing without it..."

echo "🔧 Installing Python dependencies..."
pip install -r requirements.txt

echo "✅ Build complete!"
