# Digital Forge Reel

> Render HTML/CSS/JS scenes into vertical social-media videos (Instagram Reels / TikTok / YouTube Shorts) — at true 60fps, with GPU acceleration.

## What this is

A complete, modular rendering pipeline that takes a self-contained HTML "scene" (your animated design with GSAP timeline) and turns it into a polished 1080×1920 MP4 video ready to post.

Built around three principles:

1. **Treat HTML like a film studio.** The scene is the set, GSAP is the director, the renderer is the camera, the encoder is the lab. Clean separation of concerns.
2. **Deterministic frame capture.** Every frame is rendered by seeking the GSAP timeline to a specific timestamp — no real-time recording, no dropped frames, no jitter. Pause it, resume it, re-render a single frame — all reproducible.
3. **GPU everywhere it helps.** Optional GPU rasterization in Chrome (faster compositing) + GPU-accelerated H.264 encoding (NVENC / VAAPI / QSV / VideoToolbox). 5-20x faster than pure CPU.

## What's inside

```
digital-forge-reel/
├── bin/                          # CLI entry points
│   ├── forge-render              # main render command
│   ├── forge-setup               # install all deps (Colab-aware)
│   ├── forge-music               # generate background music
│   ├── forge-new                 # scaffold a new video project (scene + theme)
│   └── forge-fix-chromium        # one-shot fix for Colab snap-stub issue
├── scenes/                       # self-contained HTML scenes
│   ├── digital-forge-reel-en.html   # English version (Digital Forge reel)
│   ├── digital-forge-reel-ar.html   # Algerian Darija version (RTL Arabic)
│   └── podcast-promo.html           # Example: a different format (3-scene editorial)
├── themes/                       # theme-aware visual identities
│   ├── ForgeTheme.js                # dark + fiery (default)
│   ├── PodcastTheme.js              # cream + burgundy (editorial)
│   └── MinimalTheme.js              # bare bones (testing)
├── templates/
│   └── scene-template.html       # theme-aware skeleton — copy to start a new scene
├── src/
│   ├── core/                     # engine — abstractions + orchestration
│   │   ├── Logger.js             # structured, leveled logging
│   │   ├── Renderer.js           # abstract renderer interface
│   │   ├── Encoder.js            # abstract encoder interface
│   │   ├── Pipeline.js           # orchestrates capture → encode → cleanup
│   │   ├── Setup.js              # env bootstrap (Colab / Linux / Mac)
│   │   ├── Theme.js              # theme validation + CSS/JS serialization
│   │   ├── ThemeLoader.js        # loads theme files (.js or .json)
│   │   ├── rendererFactory.js
│   │   └── encoderFactory.js
│   ├── renderers/
│   │   └── PlaywrightRenderer.js # frame-by-frame Chromium capture
│   ├── encoders/
│   │   ├── FFmpegEncoder.js      # CPU (libx264)
│   │   ├── NVENCEncoder.js       # NVIDIA GPU
│   │   ├── VAAPIEncoder.js       # Intel/AMD GPU
│   │   ├── QSVEncoder.js         # Intel QuickSync
│   │   └── VideoToolboxEncoder.js # macOS
│   ├── audio/
│   │   ├── generate_music.py     # procedural music synth
│   │   └── MusicGenerator.js     # Node wrapper
│   ├── config/
│   │   └── Config.js             # validated, env-aware config
│   └── utils/
│       ├── errors.js             # typed error hierarchy
│       ├── fs.js                 # fs helpers
│       ├── exec.js               # promise-wrapped child_process
│       └── environment.js        # detect Colab/GPU/Docker
├── audio/
│   └── forge_theme.wav           # pre-generated 32s track
├── output/                       # rendered videos land here
├── docs/                         # full documentation
│   ├── INSTALL.md
│   ├── ARCHITECTURE.md
│   ├── RENDERING.md
│   ├── GPU.md
│   ├── COLAB.md
│   ├── CUSTOMIZATION.md
│   └── TROUBLESHOOTING.md
├── tests/
│   └── test-pipeline.js
├── examples/
│   └── minimal-scene.html        # minimal scene to learn from
├── colab-render.ipynb            # one-click Colab notebook
├── setup-colab.sh                # one-shot Colab setup
├── package.json
├── requirements.txt
└── .gitignore
```

## Quick start (local)

```bash
# 1. Install deps
node bin/forge-setup

# 2. Render the English reel
node bin/forge-render scenes/digital-forge-reel-en.html \
    --output output/en.mp4 \
    --music audio/forge_theme.wav

# 3. Render the Arabic (Algerian Darija) reel
node bin/forge-render scenes/digital-forge-reel-ar.html \
    --output output/ar.mp4 \
    --music audio/forge_theme.wav
```

## Hit "chromium snap" error on Colab?

```bash
node bin/forge-fix-chromium   # one-shot fix for the snap stub issue
```

## Quick start (Google Colab — recommended for free GPU)

1. Upload `digital-forge-reel.zip` to Colab
2. Open `colab-render.ipynb` (or run `!bash setup-colab.sh`)
3. Run all cells → videos download automatically

See **[docs/COLAB.md](docs/COLAB.md)** for the full guide.

## GPU acceleration

If you have an NVIDIA GPU (Colab T4, local RTX, etc.), render 5-20x faster:

```bash
node bin/forge-render scenes/digital-forge-reel-en.html \
    --gpu --encoder nvenc --workers 4 \
    --output output/en-gpu.mp4 \
    --music audio/forge_theme.wav
```

- `--gpu` → enables GPU rasterization in Chrome (faster page compositing)
- `--encoder nvenc` → uses NVIDIA's hardware H.264 encoder
- `--workers 4` → 4 parallel Chrome processes for capture (matches Colab's 4 vCPUs)

### ⚠️ Important: Verify GPU is actually being used

If you see `0% GPU utilization` in `nvidia-smi` during render, Chrome silently
fell back to SwiftShader (CPU rasterization). This is a common bug caused by
Chrome flag changes. Run the diagnostic:

```bash
node bin/forge-gpu-check --scene scenes/digital-forge-reel-en.html
```

This checks every layer of the GPU pipeline (drivers, ffmpeg, Chrome flags,
chrome://gpu status, sample render) and tells you exactly what's wrong if
anything is amiss. See **[docs/GPU_FIX.md](docs/GPU_FIX.md)** for the full
diagnosis of the silent SwiftShader fallback bug and how it was fixed.

### Benchmark CPU vs GPU

```bash
node bin/forge-benchmark scenes/digital-forge-reel-en.html --frames 30
```

Renders 30 frames under 4 configurations (CPU baseline, GPU raster only,
CPU + parallel, full GPU pipeline) and writes a JSON file with timing +
GPU utilization stats.

See **[docs/GPU.md](docs/GPU.md)** for VAAPI/QSV/VideoToolbox variants.

## Key options

| Flag | Default | What it does |
|------|---------|--------------|
| `--fps <n>` | 15 | Source frame rate (capture) |
| `--target-fps <n>` | 60 | Output frame rate (after interpolation) |
| `--scale <0.1-4>` | 1.0 | Capture scale. 0.5 = half-res (fast), 1.0 = native, 2.0 = 4K |
| `--encoder <auto\|cpu\|nvenc\|vaapi\|qsv\|videotoolbox>` | auto | Video encoder |
| `--gpu` | off | Enable Chrome GPU rasterization (Chrome 131+ compatible flags) |
| `--workers <n>` | 0 (auto) | Parallel Chrome processes for capture (0 = cpus/2, max 4) |
| `--no-verify-gpu` | off | Skip chrome://gpu verification (faster startup, less safe) |
| `--no-gpu-monitor` | off | Disable nvidia-smi sampling during render |
| `--no-nvenc-hwupload` | off | Use CPU filter chain instead of hwupload_cuda |
| `--theme <path>` | null | Theme file (themes/X.js) — injects colors/fonts/motion as CSS vars |
| `--crf <0-51>` | 18 | Quality (lower = better, 18 = visually lossless) |
| `--interpolate <dup\|mi>` | dup | Frame interpolation (`mi` = minterpolate, smoother but slow) |
| `--start <n>` | 0 | Start frame (for resumable rendering) |
| `--max-frames <n>` | ∞ | Cap frames per run (for batching long renders) |
| `--no-resume` | off | Re-capture existing frames |
| `--keep-frames` | off | Don't delete frames after encoding |
| `--generate-music` | off | Auto-generate music if `--music` not given |

## Documentation

- **[docs/GPU_FIX.md](docs/GPU_FIX.md)** — ⭐ **GPU pipeline fix diagnosis & resolution** (start here if GPU isn't being used)
- **[docs/INSTALL.md](docs/INSTALL.md)** — installation for every platform
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — how the pipeline works
- **[docs/NEW-VIDEO-EXTENSION.md](docs/NEW-VIDEO-EXTENSION.md)** — **build a completely new video format** ⭐
- **[docs/RENDERING.md](docs/RENDERING.md)** — capture strategies, fps, scaling
- **[docs/GPU.md](docs/GPU.md)** — NVENC / VAAPI / QSV / VideoToolbox
- **[docs/COLAB.md](docs/COLAB.md)** — Google Colab guide
- **[docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md)** — write your own scene
- **[docs/CONFIG.md](docs/CONFIG.md)** — every CLI flag + env var
- **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** — common issues

## Building a new video format

The system is designed for **1000% flexibility** — every aspect (scene, theme, animation, renderer, encoder, audio) is independently swappable.

```bash
# Scaffold a new video project with a theme
node bin/forge-new my-podcast-promo --theme podcast
cd my-podcast-promo
# Edit scene.html + theme.js
node ../bin/forge-render scene.html --output output.mp4 --music music.wav --theme theme.js
```

See **[docs/NEW-VIDEO-EXTENSION.md](docs/NEW-VIDEO-EXTENSION.md)** for the full guide — covers the 6 axes of customization, the scene contract, theme system, swapping animation libraries (GSAP / Anime.js / Three.js / Lottie), adding new renderers/encoders/audio generators, multi-format project structure, and a worked podcast-promo example.

## License

MIT — see [LICENSE](LICENSE).
