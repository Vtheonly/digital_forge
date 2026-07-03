# Troubleshooting

## Common issues

### "Chromium not found"

**Cause:** Playwright's Chromium binary isn't installed.

**Fix:**
```bash
node bin/forge-setup        # auto-installs everything
# OR
npx playwright install chromium
# OR (Colab/Linux)
sudo apt install -y chromium-browser
```

### "ffmpeg not found"

**Fix:**
```bash
# Ubuntu / Colab
sudo apt install -y ffmpeg

# macOS
brew install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

### "ffmpeg lacks h264_nvenc"

**Cause:** Your ffmpeg wasn't built with NVIDIA support.

**Fix:**
```bash
# Ubuntu / Colab — distro ffmpeg usually has NVENC
sudo apt install -y ffmpeg

# Verify
ffmpeg -encoders | grep h264_nvenc

# If still missing, either build ffmpeg from source with --enable-nvenc,
# or fall back to CPU encoding:
node bin/forge-render scene.html --encoder cpu --output out.mp4
```

### Video is offset / has black bars on one side

**Status:** Fixed in current version. The renderer now aligns the viewport to the stage size exactly.

**If you still see this:**
1. Make sure you're using the latest project version
2. Check that your scene's `#stageWrap` doesn't have a `transform` that conflicts
3. Try `--scale 1.0` (native res — no scaling involved)

### Render is very slow

**Diagnostics:**
1. Are you using GPU? `nvidia-smi` should show activity during render
2. What's your fps? `--fps 15` is 2x faster than `--fps 30`
3. What's your scale? `--scale 0.5` is 4x faster than `--scale 1.0`

**Speed-up options (in order of impact):**
```bash
# 1. Use GPU encoder (5-20x faster encode)
--encoder nvenc

# 2. Use GPU rasterization (faster capture)
--gpu

# 3. Capture at half resolution
--scale 0.5

# 4. Capture fewer source frames
--fps 15

# 5. Use frame duplication (not minterpolate)
--interpolate dup

# All combined:
node bin/forge-render scene.html \
    --gpu --encoder nvenc \
    --scale 0.5 --fps 15 \
    --interpolate dup \
    --output output/fast.mp4
```

### Render crashes with "Out of memory"

**Cause:** Capturing at high resolution + high fps uses lots of RAM.

**Fix:**
```bash
# Reduce memory usage
node bin/forge-render scene.html \
    --scale 0.5 \         # Half-res
    --fps 15 \            # Fewer frames in flight
    --max-frames 100      # Cap per run, run multiple times
```

If still OOM, the scene HTML itself may be too complex (too many DOM nodes, expensive CSS filters). Simplify the scene or use `FORGE_FAST_MODE=0` to disable the perf optimizations (paradoxically, sometimes the optimizations themselves can cause issues — but usually they help).

### "Page JS error" during render

**Cause:** The scene HTML has a JavaScript error.

**Fix:**
1. Open the scene in a browser: `file:///path/to/scene.html#live`
2. Open DevTools → Console
3. Fix any errors shown
4. Re-run render

Common causes:
- GSAP CDN failed to load (use a different CDN or download locally)
- Scene references a DOM element that doesn't exist
- `window.renderAtTime` is missing or throws

### Audio out of sync

**Cause:** Music duration ≠ video duration.

**Fix:**
- Check music length: `ffprobe audio/forge_theme.wav`
- Check video length: `ffprobe output/video.mp4`
- If music is shorter, ffmpeg uses `-shortest` to match (video ends when audio ends)
- If music is longer, video gets cut at the end of frames

To generate music of exact length:
```bash
# 30s at 128 BPM = ~16 bars (15.94s per 4 bars)
# 32s = ~17 bars
node bin/forge-music --bars 17 --bpm 128 --out audio/32s.wav
```

### Frames look fine individually but video stutters

**Cause:** Frame interpolation issue.

**Fix:**
- Try `--interpolate dup` (default, fast, sharp)
- If motion is choppy, try `--interpolate mi` (minterpolate, smoother but slower and may blur text)
- Make sure `--fps` (source) and `--target-fps` (output) are set correctly

### Colab disconnects mid-render

**Cause:** Colab free tier has session limits.

**Fix:**
1. Use `--start` and `--max-frames` to render in chunks
2. Save frames to Google Drive so they persist:

```python
from google.colab import drive
drive.mount('/content/drive')

!node bin/forge-render scene.html \
    --frames-dir /content/drive/MyDrive/frames \
    --output /content/drive/MyDrive/output.mp4 \
    --max-frames 100
```

3. Re-run after reconnect — resume picks up where it left off

### "Permission denied" on /dev/dri/renderD128 (VAAPI)

**Fix:**
```bash
sudo chmod 660 /dev/dri/renderD128
sudo usermod -aG video $USER
# Log out and back in
```

Or just use `--encoder cpu` instead.

### Blank/empty video

**Diagnostics:**
1. Check if frames were captured: `ls output/frames/`
2. If no frames → scene HTML issue (check browser console)
3. If frames exist but MP4 is empty → ffmpeg issue (check `--log-level debug`)

**Fix:**
```bash
# Re-render with verbose logs
node bin/forge-render scene.html --log-level debug --output out.mp4 2>&1 | tee render.log

# Check a single frame
open output/frames/frame_00000.jpg
```

## Getting more help

1. Check the logs: `--log-level debug --log-file debug.log`
2. Read the architecture docs: `docs/ARCHITECTURE.md`
3. Open an issue with: full log, scene HTML, ffmpeg version, OS, GPU info

## Debug mode

For maximum verbosity:

```bash
FORGE_FAST_MODE=0 node bin/forge-render scene.html \
    --log-level debug \
    --log-file debug.log \
    --output output.mp4
```

- `FORGE_FAST_MODE=0` keeps all CSS effects on (slower but matches live preview)
- `--log-level debug` shows every frame capture + ffmpeg stderr
- `--log-file` writes everything to a file for sharing
