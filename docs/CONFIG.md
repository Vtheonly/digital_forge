# Configuration Reference

All options can be set via:
1. **CLI flags** (highest priority) — `--fps 30`
2. **Environment variables** — `FORGE_FPS=30`
3. **Defaults** (lowest priority)

## Rendering options

| Flag | Env var | Default | Description |
|------|---------|---------|-------------|
| `--html-path <path>` | `FORGE_HTML_PATH` | — | **Required.** Path to scene HTML. |
| `--output, -o <path>` | `FORGE_OUTPUT_PATH` | `./output/video.mp4` | Output MP4 path. |
| `--frames-dir <path>` | `FORGE_FRAMES_DIR` | `./output/frames` | Intermediate frames directory. |
| `--fps <n>` | `FORGE_FPS` | `15` | Source capture fps. |
| `--target-fps <n>` | `FORGE_TARGET_FPS` | `60` | Output fps (after interpolation). |
| `--width <n>` | `FORGE_WIDTH` | `1080` | Final video width (px). |
| `--height <n>` | `FORGE_HEIGHT` | `1920` | Final video height (px). |
| `--scale <0.1-4>` | `FORGE_CAPTURE_SCALE` | `1.0` | Capture scale. `0.5` = half-res capture, `2.0` = 4K capture. |
| `--start <n>` | `FORGE_START_FRAME` | `0` | Start frame (for resumable rendering). |
| `--max-frames <n>` | `FORGE_MAX_FRAMES` | `Infinity` | Max frames per run. |
| `--frame-format <jpeg\|png>` | `FORGE_FRAME_FORMAT` | `jpeg` | Frame image format. |
| `--jpeg-quality <n>` | `FORGE_JPEG_QUALITY` | `92` | JPEG quality (1-100). |
| `--no-resume` | `FORGE_RESUME_FROM_DISK=0` | `true` | Re-capture existing frames. |

## Encoder options

| Flag | Env var | Default | Description |
|------|---------|---------|-------------|
| `--encoder <auto\|cpu\|nvenc\|vaapi\|qsv\|videotoolbox>` | `FORGE_ENCODER` | `auto` | Video encoder. |
| `--crf <0-51>` | `FORGE_CRF` | `18` | Quality (lower = better). 18 = visually lossless. |
| `--preset <name>` | `FORGE_PRESET` | `medium` | x264 preset: `ultrafast`..`veryslow`. |
| `--interpolate <dup\|mi>` | `FORGE_INTERPOLATE` | `duplicate` | Frame interpolation. `mi` = minterpolate (smoother but slow). |
| `--scale-filter <lanczos\|bicubic\|bilinear\|spline>` | `FORGE_SCALE_FILTER` | `lanczos` | Upscaler filter. |
| `--keep-frames` | `FORGE_CLEAN_FRAMES_AFTER_ENCODE=0` | `true` | Don't delete frames after encoding. |

## Audio options

| Flag | Env var | Default | Description |
|------|---------|---------|-------------|
| `--music <path>` | `FORGE_MUSIC_PATH` | — | Background music WAV/MP3. |
| `--generate-music` | `FORGE_GENERATE_MUSIC=1` | `false` | Auto-generate music if `--music` not given. |

## GPU options

| Flag | Env var | Default | Description |
|------|---------|---------|-------------|
| `--gpu` | `FORGE_USE_GPU=1` | `false` | Enable GPU rasterization in Chrome. |
| — | `FORGE_GPU_RENDERER` | — | Override Chrome `--use-gl` flag. |

## Behavior options

| Flag | Env var | Default | Description |
|------|---------|---------|-------------|
| `--log-level <debug\|info\|warn\|error\|fatal>` | `FORGE_LOG_LEVEL` | `info` | Log verbosity. |
| `--log-file <path>` | `FORGE_LOG_FILE` | — | Write logs to file. |
| `--setup` | — | `false` | Run setup before rendering. |
| — | `FORGE_FAST_MODE=0` | `1` | Disable CSS perf optimizations (slower but pixel-perfect). |
| — | `FORGE_TIMEOUT` | `600000` | Operation timeout (ms). |

## Browser options

| Flag | Env var | Default | Description |
|------|---------|---------|-------------|
| `--browser-args <json>` | `FORGE_BROWSER_ARGS` | auto | Override Chromium launch args (JSON array). |
| `--executable-path <path>` | `FORGE_EXECUTABLE_PATH` | auto | Override Chromium binary path. |

## Examples

### Full quality GPU render (Colab T4)
```bash
node bin/forge-render scenes/digital-forge-reel-en.html \
    --output output/en.mp4 \
    --music audio/forge_theme.wav \
    --gpu \
    --encoder auto \
    --fps 30 \
    --target-fps 60 \
    --scale 1.0 \
    --crf 18 \
    --log-level info
```

### Fast CPU preview (half-res, low fps)
```bash
node bin/forge-render scenes/digital-forge-reel-en.html \
    --output output/preview.mp4 \
    --music audio/forge_theme.wav \
    --scale 0.5 \
    --fps 10 \
    --target-fps 30 \
    --crf 28
```

### True 60fps capture (best quality, slow)
```bash
node bin/forge-render scenes/digital-forge-reel-en.html \
    --output output/60fps.mp4 \
    --music audio/forge_theme.wav \
    --fps 60 \
    --target-fps 60 \
    --scale 1.0 \
    --encoder cpu \
    --crf 16 \
    --preset slow
```

### Resumable batch render (split across runs)
```bash
# Run 1
node bin/forge-render scene.html --start 0 --max-frames 100 --output out.mp4
# Run 2 (picks up at frame 100)
node bin/forge-render scene.html --start 100 --max-frames 100 --output out.mp4
# Final: encode all
node bin/forge-render scene.html --output out.mp4 --no-resume
```

### Environment-variable-only config
```bash
FORGE_HTML_PATH=scenes/en.html \
FORGE_OUTPUT_PATH=output/en.mp4 \
FORGE_FPS=30 \
FORGE_TARGET_FPS=60 \
FORGE_ENCODER=nvenc \
FORGE_USE_GPU=1 \
FORGE_CRF=18 \
node bin/forge-render
```
