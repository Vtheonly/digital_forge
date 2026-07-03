# Rendering

## How frame capture works

```
For i = 0 to totalFrames-1:
  1. Compute timestamp: t = i / fps
  2. Call window.renderAtTime(t) in the browser
     → Seeks GSAP timeline to t
     → Redraws canvas particles deterministically
     → Updates CSS transforms (drift, shake)
  3. CDP Page.captureScreenshot → JPEG/PNG bytes
  4. Write to disk as frame_00000.jpg
```

Each frame is captured by **seeking the timeline to a specific timestamp**, not by playing in real-time. This means:

- No dropped frames (every frame is a clean snapshot)
- Deterministic output (same input → same frames)
- Resumable (skip frames already on disk)
- Debuggable (re-render frame 42 alone to inspect)

## Choosing capture fps

| Source fps | Use case | Trade-off |
|------------|----------|-----------|
| 60 | True 60fps source (best for smooth motion) | 2x capture time vs 30fps |
| 30 | Standard video quality | Good balance, recommended for most scenes |
| 15 | Fast preview, slow scenes | Motion may look choppy, but interpolates well to 60fps |

**Recommendation:** `--fps 30` for production. Drop to `--fps 15` for quick previews or if your scene has slow motion (which interpolates well).

## Frame interpolation

Source fps ≠ output fps. Two options:

### `--interpolate dup` (default, fast)
Duplicates frames to reach target fps. E.g. 15fps → 60fps means each frame is shown 4x.
- ✅ Fast (no extra computation)
- ✅ Sharp (no blur)
- ❌ Stutter on fast motion (looks like 15fps even though file says 60fps)

### `--interpolate mi` (minterpolate, slow but smooth)
ffmpeg's `minterpolate` filter generates intermediate frames using motion estimation.
- ✅ Smooth motion (true 60fps look)
- ❌ 10-50x slower encode
- ❌ Can introduce artifacts on text/UI elements

**Recommendation:** Start with `dup`. If motion looks choppy, try `mi` on a slow scene. For text-heavy UI animations, `dup` is usually better (no motion-blur artifacts on text).

## Capture scale

`--scale <n>` controls the resolution Chrome captures at:

| Scale | Capture size | Output size | Speed | Quality |
|-------|--------------|-------------|-------|---------|
| 1.0 (default) | 1080×1920 | 1080×1920 | Baseline | Native |
| 0.5 | 540×960 | 1080×1920 (upscaled) | ~4x faster | Slightly soft |
| 0.75 | 810×1440 | 1080×1920 (upscaled) | ~2x faster | Good |
| 2.0 | 2160×3840 | 2160×3840 (4K) | ~4x slower | 4K source |

**Recommendation:** Use `--scale 1.0` for production (true 1080p). Use `--scale 0.5` for quick previews or when rendering on a slow machine.

## Offset bug (fixed)

Earlier versions had a bug where the rendered video was offset 50% to the left, leaving the right half black. This happened because:

- The stage was 1080×1920 but scaled with CSS `transform: scale(0.5)`
- The viewport was 540×960, but the stage's transform-origin put it at top-left
- Playwright captured the whole viewport including the empty right portion

**Fix (in `PlaywrightRenderer.js`):**
```css
html, body, #viewport {
  width: 1080px !important;  /* viewport = stage size, no offset */
  height: 1920px !important;
}
#stageWrap {
  position: absolute;
  top: 0; left: 0;
  width: 1080px; height: 1920px;
  transform: scale(1.0);     /* scale only the stage, not the viewport */
}
```

The viewport and the stage are now exactly the same size, so there's no gap. When you use `--scale 0.5`, the viewport becomes 540×960 (smaller) and the stage is scaled down to fit — but it always fills the viewport with zero offset.

## Performance optimization

The renderer disables some expensive CSS effects during capture to speed things up:

```css
*, *::before, *::after {
  animation: none !important;        /* CSS animations recompute every frame */
  filter: none !important;           /* blur/drop-shadow are GPU-expensive */
  box-shadow: none !important;       /* shadow re-render is slow */
  text-shadow: none !important;
}
.forge-glow, #bg-mesh, #bg-rays,    /* heavy decorative layers */
  #bg-grid, #vignette, #grain {
  display: none !important;
}
```

**Why this is safe:** The scene's motion comes from GSAP `timeline.seek()`, not CSS animations. So disabling CSS animations doesn't lose any visible motion — it just stops Chrome from recomputing them every frame.

**To override:** Set `FORGE_FAST_MODE=0` env var to keep all CSS effects on (slower but pixel-perfect to the live preview).

## Resume / batching

Long renders can be split across multiple runs:

```bash
# Run 1: capture frames 0-100
node bin/forge-render scene.html --start 0 --max-frames 100 --no-encode

# Run 2: capture frames 100-200
node bin/forge-render scene.html --start 100 --max-frames 100 --no-encode

# Run 3: encode everything
node bin/forge-render scene.html --encode-only
```

(Note: `--no-encode` and `--encode-only` flags are planned but not yet implemented. Currently `--start` and `--max-frames` control which frames are captured, and the encode phase always runs after capture.)

## Quality reference

| Setting | File size (30s reel) | Quality |
|---------|---------------------|---------|
| `--crf 18` (default) | ~6-8 MB | Visually lossless |
| `--crf 23` | ~3-4 MB | High quality |
| `--crf 28` | ~1.5-2 MB | Acceptable for social media |
| `--crf 18 --encoder nvenc` | ~5-7 MB | Same quality, 10x faster encode |
