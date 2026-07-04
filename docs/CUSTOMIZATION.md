# Customization

## Writing your own scene

A scene is just a self-contained HTML file. The only contract with the renderer is exposing two globals:

```js
window.masterTL      // GSAP Timeline (or any object with .seek() and .duration())
window.renderAtTime   // function(t: number): void  — seek to t and redraw
```

### Minimal scene template

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <style>
    body { margin: 0; background: #0a0a10; color: white;
           font-family: sans-serif; overflow: hidden; }
    #stage { width: 1080px; height: 1920px; position: relative;
             display: flex; align-items: center; justify-content: center; }
    h1 { font-size: 120px; font-weight: 900; text-align: center; }
  </style>
</head>
<body>
  <div id="stage">
    <h1 id="title">YOUR BRAND</h1>
  </div>
  <script>
    // Build timeline
    const masterTL = gsap.timeline({ paused: true });
    masterTL.from('#title', { opacity: 0, y: 100, duration: 1 });
    masterTL.to('#title', { scale: 1.2, duration: 1, yoyo: true, repeat: 1 });
    masterTL.to({}, { duration: 1 }); // hold

    // Render-mode helper: seek timeline + redraw anything custom
    window.masterTL = masterTL;
    window.renderMode = (location.hash !== '#live');

    window.renderAtTime = function(t) {
      masterTL.seek(t);
    };

    // Play in live mode (preview in browser)
    if (!window.renderMode) masterTL.play();
  </script>
</body>
</html>
```

Save as `scenes/my-scene.html` and render:

```bash
node bin/forge-render scenes/my-scene.html --output output/my-scene.mp4
```

### Scene contract details

**`window.masterTL`** must have:
- `.seek(t)` — seek to time `t` (seconds)
- `.duration()` — return total duration (seconds)
- `.pause()` — pause (so renderer can control time)

GSAP timelines have all of these. Anime.js, Tween.js, etc. — wrap them.

**`window.renderAtTime(t)`** is called by the renderer for every frame. It must:
1. Seek the timeline to `t`
2. Update any custom animations (canvas, WebGL, etc.) to reflect time `t`
3. Be **deterministic** — same `t` always produces same visual

For canvas/WebGL animations, you need to step your simulation to time `t` based on `t` alone (not on real-time delta). See `scenes/digital-forge-reel-en.html` for a full example with deterministic particle system.

### Live preview mode

Add `#live` to the URL to preview in a browser:

```
file:///path/to/scene.html#live
```

The renderer uses `renderMode = (location.hash !== '#live')` to disable `requestAnimationFrame` loops during capture (so they don't fight with the renderer's seek-based capture).

## Customizing the existing scene

### Changing text

Open `scenes/digital-forge-reel-en.html` and search for the text you want to change. All visible text is in the HTML body — no extraction needed.

```html
<!-- Hook scene -->
<h1 class="headline hook-headline">
  <span class="word">your</span>
  <span class="word">business</span><br>
  ...
</h1>
```

### Changing colors

Search for `#ff6b1a` (orange) and `#ffb800` (yellow) — these are the brand colors. Replace with your own hex codes.

For a global color scheme change, the key CSS variables are at the top of the `<style>`:

```css
/* Forge brand palette */
:root {
  --forge-orange: #ff6b1a;
  --forge-yellow: #ffb800;
  --forge-cool:   #5e9eff;
  --forge-bg:     #0a0a10;
}
```

(Not actually defined as CSS vars in the current scene, but you can add them and find/replace.)

### Changing music

Generate your own:

```bash
# Different tempo
node bin/forge-music --bpm 140 --out audio/custom.wav

# Longer (25 bars ≈ 47s)
node bin/forge-music --bars 25 --out audio/long.wav
```

Or replace `audio/forge_theme.wav` with any WAV/MP3 of your choice.

### Changing duration

The scene duration is determined by the GSAP timeline inside the HTML. To make it longer/shorter, edit the timeline in the scene's `<script>`:

```js
// Find the last tl.to(...) call and adjust its time
// Or add/remove the final hold:
tl.to({}, { duration: 2 }); // add 2s hold at end
```

### Adding a new scene section

Copy an existing scene block and modify:

```html
<!-- Copy scene-mobile, paste as scene-newservice, change content -->
<div class="scene" id="scene-newservice">
  <div class="device-stage">
    <!-- Your custom device mockup -->
  </div>
  <div class="caption-box">
    <div class="caption-eyebrow">// 05 — we build</div>
    <h2 class="caption-headline" id="capNew"></h2>
    <p class="caption-sub">Description here</p>
  </div>
</div>
```

Then add the timeline animations in the `<script>` section (copy the mobile scene's timeline block and adjust selectors + timing).

### Translating to another language

The Arabic version (`scenes/digital-forge-reel-ar.html`) shows the pattern:

1. Set `<html lang="ar" dir="rtl">` (or your target language)
2. Load appropriate fonts (Cairo + Tajawal for Arabic, Noto Sans for CJK, etc.)
3. Translate all visible text in the HTML body
4. For mixed-direction content (like the brand name "DIGITAL FORGE" staying in Latin script), wrap with `dir="ltr"`:
   ```html
   <h1 class="brand-name" dir="ltr">DIGITAL FORGE</h1>
   ```
5. Update caption builders in JS:
   ```js
   const capMobile = buildCaption('capMobile', 'تطبيقات الموبايل', []);
   ```

## Generating variations

### Different hooks for A/B testing

Make multiple copies of the scene with different hook text:

```bash
cp scenes/digital-forge-reel-en.html scenes/digital-forge-reel-en-stat.html
# Edit scenes/digital-forge-reel-en-stat.html — change hook to a stat ("73% of businesses...")
node bin/forge-render scenes/digital-forge-reel-en-stat.html --output output/en-stat.mp4 --music audio/forge_theme.wav
```

### Different aspect ratios

The scene is built for 9:16 (1080×1920). For other ratios, change `--width` and `--height`:

```bash
# 1:1 square (Instagram feed)
node bin/forge-render scene.html --width 1080 --height 1080 --output output/square.mp4

# 16:9 horizontal (YouTube)
node bin/forge-render scene.html --width 1920 --height 1080 --output output/horizontal.mp4
```

Note: the scene's CSS is designed for 9:16, so other ratios will have letterboxing or content cut off. You'll need to adjust the scene's `#stage` dimensions and layout to truly support other aspect ratios.

### 4K output

```bash
node bin/forge-render scene.html \
    --scale 2.0 \           # Capture at 2x = 2160×3840
    --width 2160 \
    --height 3840 \
    --output output/4k.mp4
```

Captures at true 4K (slow but full quality). For upscaling from 1080p instead:

```bash
node bin/forge-render scene.html \
    --scale 1.0 \
    --width 2160 \           # ffmpeg upscales to 4K
    --height 3840 \
    --output output/4k-upscaled.mp4
```

## Performance tuning

For faster renders (at quality cost):

```bash
node bin/forge-render scene.html \
    --scale 0.5 \            # Half-res capture
    --fps 15 \               # Fewer source frames
    --interpolate dup \      # Fast frame duplication (no minterpolate)
    --encoder nvenc \        # GPU encode
    --crf 23 \               # Lower quality, smaller file
    --output output/fast.mp4
```

For maximum quality:

```bash
node bin/forge-render scene.html \
    --scale 1.0 \            # Native res
    --fps 60 \               # True 60fps capture
    --target-fps 60 \        # No interpolation needed
    --encoder cpu \          # Best quality encode
    --crf 16 \               # Near-lossless
    --preset slow \          # Best compression efficiency
    --output output/best.mp4
```
