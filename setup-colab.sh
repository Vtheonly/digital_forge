#!/usr/bin/env bash
# setup-colab.sh — One-shot setup script for Google Colab
#
# Run from a Colab cell with:
#   !bash setup-colab.sh
#
# Installs Node 20, Chromium, ffmpeg, Python deps, Playwright browser,
# and (if GPU runtime) verifies NVENC availability.

set -e

echo "=== Digital Forge Reel — Colab Setup ==="

# 1. Install Node.js 20
if ! command -v node &>/dev/null; then
  echo "→ Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node --version

# 2. System packages (Chromium, fonts, ffmpeg)
echo "→ Installing system packages (Chromium, fonts, ffmpeg)..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  chromium-browser \
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
  ffmpeg 2>/dev/null

# 3. Python deps for music generation
echo "→ Installing Python deps (numpy, scipy)..."
pip3 install -q numpy scipy

# 4. Node deps + Playwright browser
echo "→ Installing Node deps + Playwright Chromium..."
npm install --no-audit --no-fund
npx playwright install chromium

# 5. GPU check
echo ""
echo "=== GPU Detection ==="
if command -v nvidia-smi &>/dev/null; then
  nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader
  if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q h264_nvenc; then
    echo "✓ NVENC available — GPU encoding will be ~10x faster"
  else
    echo "⚠ NVIDIA GPU detected but ffmpeg lacks h264_nvenc. Will fall back to CPU encoding."
  fi
else
  echo "ℹ No NVIDIA GPU detected. Will use CPU encoding (slower but works)."
  echo "  For GPU: Runtime → Change runtime type → T4 GPU, then re-run this script."
fi

# 6. Verify Chromium
echo ""
echo "=== Verification ==="
which chromium-browser && echo "✓ Chromium found"
which ffmpeg && ffmpeg -version | head -1
python3 -c "import numpy, scipy; print('✓ numpy + scipy ready')"
node -e "require('playwright'); console.log('✓ Playwright ready')"

echo ""
echo "=== Setup complete! ==="
echo "Next steps:"
echo "  node bin/forge-render scenes/digital-forge-reel-en.html --output output/en.mp4 --music audio/forge_theme.wav --gpu --encoder auto"
