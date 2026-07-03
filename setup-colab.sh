#!/usr/bin/env bash
# setup-colab.sh — One-shot setup script for Google Colab
#
# Run from a Colab cell with:
#   !bash setup-colab.sh
#
# IMPORTANT: We do NOT use `apt install chromium-browser` on Colab because
# on Ubuntu 22+ that package is a snap stub that doesn't work in containers.
# Instead, we install Playwright's own bundled Chromium binary which is
# a real, working Chromium.
#
# Installs:
#   - Node.js 20
#   - System libs Chromium needs (libnss3, libgbm1, etc.)
#   - Fonts (Noto, DejaVu, Liberation)
#   - ffmpeg
#   - Python deps (numpy, scipy for music generation)
#   - Playwright Node module + bundled Chromium binary

set -e

echo "=== Digital Forge Reel — Colab Setup ==="

# 1. Install Node.js 20
if ! command -v node &>/dev/null; then
  echo "→ Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node --version

# 2. System packages — fonts, ffmpeg, and Chromium runtime libs.
# NOTE: We deliberately do NOT install 'chromium-browser' here because on
# Ubuntu 22+ it's a snap stub. Playwright will install its own real Chromium.
echo "→ Installing system packages (fonts, ffmpeg, Chromium libs)..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
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

# 4. Node deps
echo "→ Installing Node dependencies (Playwright)..."
cd /content/digital-forge-reel 2>/dev/null || cd "$(dirname "$0")"
npm install --no-audit --no-fund

# 5. Install Playwright's real Chromium binary (NOT the snap stub)
echo "→ Installing Playwright Chromium binary (~150MB download)..."
npx playwright install chromium
echo "→ Installing Playwright system deps (libnss3 etc., may already be present)..."
npx playwright install-deps chromium || echo "  (install-deps failed, may already be installed)"

# 6. GPU check
echo ""
echo "=== GPU Detection ==="
if command -v nvidia-smi &>/dev/null; then
  nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader
  if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q h264_nvenc; then
    echo "✓ NVENC available — GPU encoding will be ~10x faster"
  else
    echo "⚠ NVIDIA GPU detected but ffmpeg lacks h264_nvenc. Will fall back to CPU encoding."
    echo "  Fix: sudo apt install ffmpeg (the Ubuntu build includes NVENC)"
  fi
else
  echo "ℹ No NVIDIA GPU detected. Will use CPU encoding (slower but works)."
  echo "  For GPU: Runtime → Change runtime type → T4 GPU, then re-run this script."
fi

# 7. Verify everything
echo ""
echo "=== Verification ==="
which chromium-browser 2>/dev/null && echo "(note: /usr/bin/chromium-browser may be a snap stub — we use Playwright's Chromium instead)"
node -e "
const env = require('./src/utils/environment');
const path = env.findChromium();
if (path) {
  console.log('✓ Playwright Chromium found:', path);
} else {
  console.error('✗ Chromium NOT found. Try: npx playwright install chromium');
  process.exit(1);
}
"
which ffmpeg && ffmpeg -version | head -1
python3 -c "import numpy, scipy; print('✓ numpy + scipy ready')"
node -e "require('playwright'); console.log('✓ Playwright ready')"

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps — render the videos:"
echo "  node bin/forge-render scenes/digital-forge-reel-en.html \\"
echo "    --output output/en.mp4 --music audio/forge_theme.wav \\"
echo "    --gpu --encoder auto --fps 30 --target-fps 60"
echo ""
echo "  node bin/forge-render scenes/digital-forge-reel-ar.html \\"
echo "    --output output/ar.mp4 --music audio/forge_theme.wav \\"
echo "    --gpu --encoder auto --fps 30 --target-fps 60"
