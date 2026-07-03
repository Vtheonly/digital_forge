# Google Colab Guide

Colab is the **recommended way to render** — free T4 GPU gives you NVENC encoding (~10x faster than CPU) and the environment is reproducible.

## Quick start

### Option A: Use the notebook (easiest)

1. Upload `digital-forge-reel.zip` to Colab
2. Open `colab-render.ipynb` from the project root
3. Run all cells

### Option B: Manual setup

In a Colab cell:

```python
# Install Node.js 20
!curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
!sudo apt install -y nodejs

# Unzip project
!unzip -o digital-forge-reel.zip -d /content/
%cd /content/digital-forge-reel

# Install everything (Chromium, fonts, ffmpeg, Playwright, Python deps)
!bash setup-colab.sh

# Render
!node bin/forge-render scenes/digital-forge-reel-en.html \
    --output output/en.mp4 \
    --music audio/forge_theme.wav \
    --gpu --encoder auto
```

## Choosing a runtime

### GPU runtime (recommended)
- Runtime → Change runtime type → T4 GPU
- Enables NVENC encoding (5-20x faster)
- Enables GPU rasterization in Chrome (`--gpu` flag works)

### CPU runtime (fallback)
- Slower (~30-60 min for a 30s reel)
- Works fine, just slower
- Drop `--gpu` flag (Chrome can't use GPU)

### TPU runtime
- Not useful here (TPU is for ML training, not video encoding)
- Use GPU or CPU runtime instead

## Recommended render command (GPU runtime)

```bash
node bin/forge-render scenes/digital-forge-reel-en.html \
    --output output/en.mp4 \
    --music audio/forge_theme.wav \
    --gpu \
    --encoder auto \
    --fps 30 \
    --target-fps 60 \
    --scale 1.0 \
    --interpolate dup \
    --crf 18 \
    --log-level info
```

Expected runtime: ~5-8 minutes for a 30s reel on T4 GPU.

## Recommended render command (CPU runtime)

```bash
node bin/forge-render scenes/digital-forge-reel-en.html \
    --output output/en.mp4 \
    --music audio/forge_theme.wav \
    --scale 0.5 \
    --fps 15 \
    --target-fps 60 \
    --interpolate dup
```

Expected runtime: ~20-30 minutes for a 30s reel on CPU.

## Saving output

### To Google Drive (persistent)

```python
from google.colab import drive
drive.mount('/content/drive')
!mkdir -p /content/drive/MyDrive/digital-forge-reel
!cp output/*.mp4 /content/drive/MyDrive/digital-forge-reel/
```

### To your machine (direct download)

```python
from google.colab import files
files.download('output/en.mp4')
```

## Common Colab issues

### "Chromium not found"

Run `!bash setup-colab.sh` again. If that fails:

```bash
!sudo apt install -y chromium-browser
!npx playwright install chromium
```

### "ffmpeg lacks h264_nvenc"

Make sure you're on a GPU runtime (Runtime → Change runtime type → T4 GPU). Then:

```bash
!sudo apt install -y ffmpeg
!ffmpeg -encoders | grep h264_nvenc
```

If still missing, the distro ffmpeg doesn't have NVENC. Workaround: use `--encoder cpu` (slower but works).

### Session disconnects during long render

Colab free tier disconnects after ~12 hours of inactivity. For long renders:
- Use `--start` and `--max-frames` to split into chunks
- Save progress to Google Drive (frames persist if you mount Drive as the `framesDir`)
- Re-run after reconnect — resume picks up where it left off

### Out of memory

```bash
# Reduce memory usage
node bin/forge-render scene.html \
    --scale 0.5 \    # half-res capture
    --fps 15 \       # fewer frames
    --max-frames 100 # cap per run
```

### "ffmpeg: error while loading shared libraries: libva.so.2"

Ignore — this is a VAAPI warning, not an error. NVENC encoding will work fine.

## Pro tip: persist frames to Drive for resume

```bash
# Mount Drive
from google.colab import drive
drive.mount('/content/drive')

# Set framesDir to Drive so frames survive disconnects
!node bin/forge-render scene.html \
    --output /content/drive/MyDrive/output.mp4 \
    --frames-dir /content/drive/MyDrive/frames \
    --music audio/forge_theme.wav
```

If Colab disconnects, just re-run the same command — it skips already-captured frames automatically.

## Free vs Pro Colab

| Feature | Free | Pro ($10/mo) |
|---------|------|--------------|
| GPU | T4 (sometimes) | T4 / V100 / A100 |
| Session length | ~12h | ~24h |
| Disconnect frequency | Higher | Lower |
| Disk space | ~100GB | ~225GB |

For occasional renders, free tier is fine. For batch renders, Pro saves time.
