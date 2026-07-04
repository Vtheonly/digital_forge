# Installation

## Requirements

- **Node.js** 16+ (20+ recommended)
- **Python 3** with `pip` (for music generation)
- **ffmpeg** 4.4+ (with NVENC if you want GPU encoding)
- **Chromium** (Playwright will install its own copy if missing)

## One-shot setup

```bash
node bin/forge-setup
```

This script:
- Detects your platform (Linux / Mac / Windows / Colab / Docker)
- Installs Chromium + fonts + ffmpeg via apt (Linux/Colab)
- Runs `npm install` (installs Playwright)
- Installs Python deps (numpy, scipy)
- Installs Playwright's bundled Chromium as fallback
- Verifies GPU encoder availability if NVIDIA detected

## Platform-specific notes

### Ubuntu / Debian / Colab

```bash
sudo apt install -y chromium-browser ffmpeg fonts-noto fonts-noto-cjk
```

Then `node bin/forge-setup` handles the rest.

### macOS

```bash
brew install node python ffmpeg
```

Chromium is installed by Playwright automatically. VideoToolbox (macOS native GPU encoder) is auto-selected.

### Windows

Install [Node.js](https://nodejs.org/), [Python](https://python.org/), and [ffmpeg](https://ffmpeg.org/download.html). Run in PowerShell:

```powershell
node bin\forge-setup
```

For GPU encoding on Windows, use `--encoder qsv` (Intel iGPU) or `--encoder nvenc` (NVIDIA GPU).

### Google Colab

Easiest path: open `colab-render.ipynb` in Colab and run all cells.

Manual:
```bash
!curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
!sudo apt install -y nodejs
!bash setup-colab.sh
```

## Verifying install

```bash
node bin/forge-setup --verbose
```

You should see ✓ for: Chromium, ffmpeg, Python, Playwright.

## Verifying GPU

```bash
nvidia-smi       # NVIDIA driver works?
ffmpeg -encoders | grep h264_nvenc   # NVENC encoder available?
```

If both succeed, `--encoder auto` will pick NVENC automatically on NVIDIA machines.
