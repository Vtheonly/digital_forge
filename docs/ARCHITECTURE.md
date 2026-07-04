# Architecture

## High-level data flow

```
┌────────────┐
│  Config    │  (CLI flags + env vars + defaults → validated)
└─────┬──────┘
      │
      ▼
┌────────────┐    ┌──────────────────┐
│  Pipeline  │───►│     Renderer     │  (Playwright + Chromium)
│            │    │                  │
│  capture() │    │  renderFrame(t)  │  ← seeks GSAP timeline
│  encode()  │    └──────────────────┘
│  cleanup() │
│            │    ┌──────────────────┐
│            │───►│     Encoder      │  (FFmpeg + libx264/NVENC/VAAPI/...)
│            │    │                  │
│            │    │  encode(frames)  │  ← ffmpeg → MP4
└────────────┘    └──────────────────┘
      │
      ▼
┌────────────┐
│  Output    │  output/video.mp4
└────────────┘
```

## Core abstractions

### `Renderer` (abstract)
- `init()` → boot browser
- `getDuration()` → query scene timeline
- `renderFrame(t, outPath)` → capture one frame at time `t`
- `close()` → cleanup

Currently only `PlaywrightRenderer` implements this, but the abstraction makes it trivial to add alternatives (Puppeteer, Selenium, headless Chrome direct CDP).

### `Encoder` (abstract)
- `encode({ framesDir, outputPath, frameCount, audioPath })` → produce MP4

Implementations:
- `FFmpegEncoder` (CPU libx264) — universal, highest quality
- `NVENCEncoder` (NVIDIA) — 5-20x faster, slightly lower quality
- `VAAPIEncoder` (Intel/AMD) — fast on Linux servers
- `QSVEncoder` (Intel QuickSync) — Windows/Mac with Intel iGPU
- `VideoToolboxEncoder` (macOS) — Mac-only, native

### `Pipeline`
Orchestrates the three phases:
1. **Capture** — for each frame `i`, seek timeline to `i / fps`, screenshot, save to `framesDir`
2. **Encode** — feed frames + audio to encoder, produce MP4
3. **Cleanup** — remove intermediate frames

Each phase is its own method, so you can call them independently (e.g. re-encode without re-capturing).

### `Config`
Validated, env-aware config. Sources (priority high → low):
1. CLI flags
2. `FORGE_*` environment variables (e.g. `FORGE_FPS=30`)
3. Built-in defaults

Every option has a type-checked default. Misconfiguration fails loudly at startup.

### `Logger`
Structured, leveled (debug/info/warn/error/fatal), with optional file output. Color-coded to stdout, plain to file. Used by every module so logs have a consistent format.

## Design principles

### 1. Fail loud, fail early
- Config validation at construction — never mid-render
- Pre-flight checks in every encoder (verifies ffmpeg has the right codec before encoding)
- Typed errors with `code` + `context` for precise error handling

### 2. Idempotent / resumable
- Capture phase skips frames already on disk (disable with `--no-resume`)
- You can interrupt a render and re-run; it picks up where it left off
- `--start <n>` and `--max-frames <n>` let you split long renders across runs

### 3. Modular & extensible
- Add a new renderer? Implement the `Renderer` interface + register in `rendererFactory.js`
- Add a new encoder? Implement the `Encoder` interface + register in `encoderFactory.js`
- Add a new scene? Drop an HTML file in `scenes/`, point `--html-path` at it

### 4. Environment-aware
- `environment.js` detects Colab / Docker / CI / GPU
- Chromium launch args auto-adapt (Colab needs `--no-sandbox`, etc.)
- Encoder auto-selection picks NVENC on NVIDIA, VideoToolbox on Mac, etc.

### 5. Deterministic capture
- Scene HTML exposes `window.renderAtTime(t)` which seeks the GSAP timeline + redraws particles deterministically
- No `requestAnimationFrame` loops in render mode — every frame is a clean snapshot
- Same input → same output, every time (essential for debugging)

## Scene contract

For a scene HTML to work with this pipeline, it must expose:

```js
window.masterTL   // GSAP Timeline (or any object with .seek() and .duration())
window.renderAtTime(t)  // function(t: number): void  — seek to time t and redraw
```

The scene can be as simple or complex as you want — animation system is up to you (GSAP, Anime.js, raw CSS, WebGL, Three.js, etc.). The renderer only cares about the two globals above.

See `scenes/digital-forge-reel-en.html` for a full example, or `examples/minimal-scene.html` for a tiny one.
