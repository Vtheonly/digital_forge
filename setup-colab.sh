#!/usr/bin/env bash
# setup-colab.sh — One-shot setup script for Google Colab with Google Chrome Stable

set -e

echo "=== Digital Forge Reel — Colab Setup ==="

# 1. Install Node.js 20
if ! command -v node &>/dev/null; then
  echo "→ Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node --version

# 2. Add Google Chrome Stable Repos & Signing Keys (Engages Native GPU Rasterization on Colab)
echo "→ Registering Google Chrome signing keys..."
sudo mkdir -p /usr/share/keyrings
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor --yes -o /usr/share/keyrings/googlechrome-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list

# 3. System Packages, Google Chrome, and Vulkan Loaders
echo "→ Installing Chrome Stable, fonts, Vulkan ICD and loaders..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  google-chrome-stable \
  fonts-noto-color-emoji \
  fonts-noto-core \
  fonts-noto-cjk \
  fonts-noto-cjk-extra \
  fonts-noto-ui-core \
  fonts-dejavu-core \
  fonts-liberation \
  libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libasound2 libatspi2.0-0 libpangocairo-1.0-0 \
  libpango-1.0-0 libcairo2 libgdk-pixbuf-2.0-0 \
  libvulkan1 \
  vulkan-tools \
  xvfb \
  ffmpeg 2>/dev/null

# Install NVIDIA GL Libraries
if ! dpkg -l libnvidia-gl-525 &>/dev/null; then
  echo "→ Installing NVIDIA GL libraries..."
  sudo apt-get install -y -qq libnvidia-gl-525 2>/dev/null || \
  sudo apt-get install -y -qq libnvidia-gl-535 2>/dev/null || \
  sudo apt-get install -y -qq libnvidia-gl-550 2>/dev/null || \
  echo "  ⚠ Could not install libnvidia-gl — Chrome may fall back to SwiftShader."
fi

# 4. Python dependencies for background music synthesis
echo "→ Installing Python dependencies (numpy, scipy)..."
pip3 install -q numpy scipy

# 5. Node dependencies
echo "→ Installing Node dependencies..."
cd /content/digital-forge-reel 2>/dev/null || cd "$(dirname "$0")"
npm install --no-audit --no-fund

# 6. Setup local offline scripts
echo "→ Triggering local file fallbacks..."
node -e "
const { Setup } = require('./src/core/Setup');
const s = new Setup();
s.ensureLocalGsap().then(() => console.log('✓ GSAP downloaded')).catch(err => console.error(err));
"

# 7. GPU diagnostics
echo ""
echo "=== GPU Verification ==="
if command -v nvidia-smi &>/dev/null; then
  nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader
  if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q h264_nvenc; then
    echo "✓ NVENC active"
  else
    echo "⚠ h264_nvenc missing in ffmpeg"
  fi
else
  echo "ℹ GPU not found on local runtime"
fi

echo ""
echo "=== Setup complete! ==="