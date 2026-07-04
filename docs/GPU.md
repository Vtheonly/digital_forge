# GPU Acceleration

The project supports two independent GPU optimizations:

1. **GPU rasterization in Chrome** — faster page compositing during capture
2. **GPU video encoding** — faster H.264 encoding (NVENC/VAAPI/QSV/VideoToolbox)

You can use either, both, or neither. They're independent.

## 1. GPU rasterization in Chrome (capture)

Add `--gpu` flag:

```bash
node bin/forge-render scene.html --gpu --output output.mp4
```

What it does:
- Removes `--disable-gpu` from Chrome launch args
- Adds `--enable-gpu-rasterization`, `--ignore-gpu-blocklist`, `--use-gl=egl`
- Chrome uses the GPU for compositing layers (faster for complex CSS)

When to use:
- ✅ Colab GPU runtime (T4/P100)
- ✅ Local machine with discrete GPU (NVIDIA/AMD)
- ❌ Colab CPU runtime (no GPU available — Chrome will crash or fall back)
- ❌ Headless servers without GPU

The renderer auto-detects: if `--gpu` is set but no NVIDIA GPU is present, it still tries (Chrome may fall back to SwiftShader software rasterizer).

## 2. GPU video encoding

### Auto-selection (recommended)

```bash
node bin/forge-render scene.html --encoder auto
```

Auto-selection logic:
- NVIDIA GPU present → `nvenc`
- macOS → `videotoolbox`
- Intel/AMD GPU (VAAPI device exists) → `vaapi`
- Otherwise → `cpu` (libx264)

### Manual selection

```bash
--encoder nvenc          # NVIDIA
--encoder vaapi          # Intel/AMD on Linux
--encoder qsv            # Intel QuickSync
--encoder videotoolbox   # macOS
--encoder cpu            # libx264 (universal fallback)
```

## Encoder comparison

| Encoder | Platform | Speed vs CPU | Quality at same bitrate | Notes |
|---------|----------|--------------|------------------------|-------|
| `cpu` (libx264) | All | 1x (baseline) | Best | Universal, slowest |
| `nvenc` | NVIDIA GPU | 5-20x | ~95% as good | Best speed/quality |
| `videotoolbox` | macOS | 3-10x | ~90% as good | Native Mac |
| `vaapi` | Intel/AMD Linux | 3-10x | ~90% as good | Server-friendly |
| `qsv` | Intel (Win/Mac) | 3-10x | ~90% as good | Older Intel iGPUs |

## NVENC (NVIDIA)

### Requirements
- NVIDIA GPU (any modern one: T4, V100, A100, RTX 20-series+, GTX 10-series+)
- NVIDIA drivers (`nvidia-smi` works)
- ffmpeg built with NVENC (most distro builds have it)

### Colab setup
On Colab GPU runtime, NVENC is already available — `--encoder auto` picks it automatically.

### Local setup
```bash
# Verify
nvidia-smi
ffmpeg -encoders | grep h264_nvenc

# If missing, install ffmpeg with NVENC:
# Ubuntu: apt install ffmpeg  (usually has NVENC)
# Or build from source: https://trac.ffmpeg.org/wiki/HWAccelIntro#NVENC
```

### Quality settings
NVENC uses CQ (constant quality) mode. The project maps `--crf` to `--cq` automatically:
- `--crf 18` (default) → CQ 20 (visually lossless)
- `--crf 23` → CQ 25 (high quality, smaller files)
- `--crf 28` → CQ 30 (acceptable for social media)

### Troubleshooting
**"No capable devices found"**
- GPU is in use by another process. Close other GPU apps.
- On Colab, restart runtime (Runtime → Restart)
- Driver issue: `nvidia-smi` should work; if not, reinstall drivers

**"h264_nvenc not found"**
- ffmpeg built without NVENC. Install proper ffmpeg:
  ```bash
  sudo apt install ffmpeg  # usually has NVENC on Ubuntu
  ```

**"CUDA error"**
- Driver/runtime version mismatch. Reinstall NVIDIA driver.

## VAAPI (Intel/AMD on Linux)

### Requirements
- Intel iGPU (Broadwell+) or AMD GPU with VAAPI support
- `/dev/dri/renderD128` device node
- ffmpeg built with `--enable-vaapi`
- User has permission to access `/dev/dri/renderD128`

### Setup
```bash
# Verify device exists
ls -la /dev/dri/renderD128

# Verify ffmpeg has VAAPI
ffmpeg -encoders | grep h264_vaapi

# Install if missing
sudo apt install ffmpeg mesa-va-drivers
```

### Usage
```bash
node bin/forge-render scene.html --encoder vaapi --output output.mp4
```

### Common on
- Intel NUCs
- Laptops with Iris Xe graphics
- AWS/GCP Intel GPU instances
- **NOT on Colab** (Colab uses NVIDIA T4)

## QSV (Intel QuickSync)

### Requirements
- Intel CPU with integrated graphics (Sandy Bridge+)
- Intel Media SDK (libmfx)
- ffmpeg built with `--enable-libmfx` or `--enable-qsv`

### Setup
- **Windows:** Use the [gyan.dev ffmpeg build](https://www.gyan.dev/ffmpeg/builds/) — includes QSV
- **Linux:** Build ffmpeg with `--enable-libmfx`
- **macOS:** Use `videotoolbox` instead (QSV not available on Mac)

```bash
node bin/forge-render scene.html --encoder qsv --output output.mp4
```

## VideoToolbox (macOS)

### Requirements
- macOS (any Mac since 2011)
- ffmpeg installed via Homebrew (`brew install ffmpeg`)

### Usage
```bash
node bin/forge-render scene.html --encoder videotoolbox --output output.mp4
```

Auto-selected on macOS — no flag needed.

## Combining GPU capture + GPU encode

For maximum speed:

```bash
node bin/forge-render scene.html \
    --gpu \                  # GPU rasterization in Chrome
    --encoder nvenc \        # GPU encoding
    --fps 30 \               # 30fps capture (smooth enough)
    --target-fps 60 \        # Output 60fps
    --interpolate dup \      # Fast frame duplication
    --output output.mp4
```

On Colab T4 GPU, this renders a 30s reel in ~5-8 minutes (vs 30-60 min CPU-only).

## Verifying GPU is actually used

```bash
# During render, in another terminal:
nvidia-smi -l 1   # refresh every 1 second
```

You should see `ffmpeg` and/or `chrome` processes using GPU memory + utilization spikes during encode.

On Colab:
```bash
!nvidia-smi
```
Run during render to see GPU usage.
