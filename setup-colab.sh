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
#
# GPU SUPPORT (Chrome 131+ compatible):
#   - libnvidia-gl-525: NVIDIA EGL + OpenGL libraries (provides libEGL_nvidia.so)
#   - libvulkan1: Vulkan loader (Chrome uses Vulkan via ANGLE on Linux+NVIDIA)
#   - vulkan-tools: provides `vulkaninfo` for diagnostics
#   Without these, Chrome silently falls back to SwiftShader (CPU rasterization)
#   and the GPU sits idle during render. See docs/GPU_FIX.md for details.
echo "→ Installing system packages (fonts, ffmpeg, Chromium libs, Vulkan ICD)..."
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
  libvulkan1 \
  vulkan-tools \
  xvfb \
  ffmpeg 2>/dev/null

# Install NVIDIA GL libraries (version matches the driver — try 525 first, fall back to others)
if ! dpkg -l libnvidia-gl-525 &>/dev/null; then
  echo "→ Installing NVIDIA GL libraries (for Chrome GPU rasterization)..."
  sudo apt-get install -y -qq libnvidia-gl-525 2>/dev/null || \
  sudo apt-get install -y -qq libnvidia-gl-535 2>/dev/null || \
  sudo apt-get install -y -qq libnvidia-gl-550 2>/dev/null || \
  echo "  ⚠ Could not install libnvidia-gl — Chrome may fall back to SwiftShader. See docs/GPU_FIX.md."
fi

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
  if command -v vulkaninfo &>/dev/null; then
    if vulkaninfo --summary 2>/dev/null | grep -q Tesla; then
      echo "✓ Vulkan ICD detected Tesla GPU — Chrome GPU rasterization will work"
    else
      echo "⚠ Vulkan available but Tesla GPU not detected. Chrome may fall back to SwiftShader."
      echo "  Fix: sudo apt install -y libnvidia-gl-525 libvulkan1"
    fi
  else
    echo "⚠ vulkaninfo not available — install with: sudo apt install -y vulkan-tools"
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
echo "Next steps — verify GPU is actually working:"
echo "  node bin/forge-gpu-check --scene scenes/digital-forge-reel-en.html"
echo ""
echo "Then run the benchmark (CPU vs GPU comparison):"
echo "  node bin/forge-benchmark scenes/digital-forge-reel-en.html --frames 30"
echo ""
echo "Then render the videos (full GPU pipeline):"
echo "  node bin/forge-render scenes/digital-forge-reel-en.html \\"
echo "    --output output/en.mp4 --music audio/forge_theme.wav \\"
echo "    --gpu --encoder nvenc --workers 4 --fps 30 --target-fps 60"
echo ""
echo "  node bin/forge-render scenes/digital-forge-reel-ar.html \\"
echo "    --output output/ar.mp4 --music audio/forge_theme.wav \\"
echo "    --gpu --encoder nvenc --workers 4 --fps 30 --target-fps 60"
echo ""
echo "See docs/GPU_FIX.md for the full explanation of the GPU pipeline fix."
