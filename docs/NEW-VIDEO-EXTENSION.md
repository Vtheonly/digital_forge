# New Video Extension Guide

> How to design, build, and ship an entirely new video format using this system — different theme, different structure, different animation system, different everything.

This document is the **creative manual** for the project. The architecture is intentionally generic: scenes, themes, renderers, encoders, and audio are all swappable. You can build a 30-second Instagram reel, a 2-minute product demo, a 6-second bumper ad, or a 10-minute explainer — all on the same engine.

---

## Table of contents

1. [Design philosophy: the 6 axes of customization](#1-design-philosophy-the-6-axes-of-customization)
2. [The scene contract — what every video must expose](#2-the-scene-contract--what-every-video-must-expose)
3. [Workflow: from idea to rendered MP4](#3-workflow-from-idea-to-rendered-mp4)
4. [Themes — the visual identity layer](#4-themes--the-visual-identity-layer)
5. [Building a new scene from scratch](#5-building-a-new-scene-from-scratch)
6. [Swapping the animation system](#6-swapping-the-animation-system)
7. [Adding a new renderer](#7-adding-a-new-renderer)
8. [Adding a new encoder](#8-adding-a-new-encoder)
9. [Adding a new audio generator](#9-adding-a-new-audio-generator)
10. [Multi-format project structure](#10-multi-format-project-structure)
11. [Worked example: building a "Podcast Promo" from scratch](#11-worked-example-building-a-podcast-promo-from-scratch)
12. [Plug-in reference — every extension point](#12-plug-in-reference--every-extension-point)
13. [Anti-patterns to avoid](#13-anti-patterns-to-avoid)
14. [Testing new formats](#14-testing-new-formats)

---

## 1. Design philosophy: the 6 axes of customization

Every video built on this system is defined by 6 independent axes. Change any one without touching the others:

| Axis | What it controls | Where it lives | Example swap |
|------|------------------|----------------|--------------|
| **Scene** | The content — text, layout, animation timeline | `scenes/*.html` | Hook scene → testimonial scene |
| **Theme** | Visual identity — colors, fonts, motion language, particles | `themes/*.js` | Forge (dark/orange) → Podcast (cream/burgundy) |
| **Animation** | How elements move — GSAP, Anime.js, raw CSS, Three.js | Loaded in scene HTML | GSAP timeline → Anime.js timeline |
| **Renderer** | How frames are captured — Playwright, Puppeteer, direct CDP | `src/renderers/` | Playwright → Puppeteer |
| **Encoder** | How frames become video — libx264, NVENC, VAAPI, ProRes | `src/encoders/` | CPU → NVENC (5-20x faster) |
| **Audio** | Background music / voiceover — generated or pre-recorded | `audio/`, `src/audio/` | Synth music → licensed track |

**The principle:** none of these axes know about each other. A scene doesn't know what theme will be applied. A theme doesn't know what scene will use it. A renderer doesn't know what encoder will follow. This means you can mix and match freely — same scene, 5 themes → 5 totally different videos.

---

## 2. The scene contract — what every video must expose

A "scene" is any HTML file that exposes two globals:

```js
window.masterTL      // Any object with .seek(t) and .duration()
window.renderAtTime  // function(t: number): void  — seek to time t and redraw
```

That's it. The renderer doesn't care:
- What animation library you use (GSAP, Anime.js, Tween.js, raw CSS, WebGL, Three.js, Lottie, D3)
- What HTML structure you use
- What CSS approach you use (inline, Tailwind, CSS-in-JS, no CSS)
- Whether you use a canvas, SVG, or pure DOM
- Whether your scene is 3 seconds or 30 minutes

As long as `renderAtTime(t)` makes the page look the way it should at time `t` seconds, the renderer will capture it correctly.

### The two modes

Every scene should support two modes:

```js
window.renderMode = (location.hash !== '#live');

if (!window.renderMode) {
  // LIVE mode (open scene.html#live in browser to preview)
  // Use requestAnimationFrame, real-time playback, etc.
  masterTL.play();
} else {
  // RENDER mode (Playwright is controlling time)
  // NO requestAnimationFrame loops — the renderer calls renderAtTime(t)
  // for each frame. RAF loops would fight with the renderer.
}
```

**Why this matters:** In render mode, the renderer seeks the timeline to exact timestamps (`0.0, 0.033, 0.066, ...` for 30fps). If your scene has a `requestAnimationFrame` loop running, it'll overwrite the renderer's seek and produce flickering/jitter. So all RAF loops must be gated on `!window.renderMode`.

### For canvas/WebGL scenes

If your scene uses a canvas or WebGL, `renderAtTime(t)` must redraw it:

```js
window.renderAtTime = function(t) {
  masterTL.seek(t);

  // Redraw canvas deterministically based on t
  ctx.clearRect(0, 0, w, h);
  for (const particle of particles) {
    // Compute particle position from its spawn time + t (NOT real-time delta)
    const age = t - particle.spawnT;
    const x = particle.x0 + particle.vx * age;
    const y = particle.y0 + particle.vy * age + 0.5 * gravity * age * age;
    // ... draw
  }
};
```

**Key rule:** Never use `performance.now()` or `Date.now()` inside `renderAtTime`. Use the `t` parameter. This makes every frame deterministic — same `t` always produces the same pixels.

---

## 3. Workflow: from idea to rendered MP4

```
┌─────────────────────────────────────────────────────────────┐
│  1. CONCEPT                                                  │
│     - What's the video for? (promo, explainer, ad, tutorial)│
│     - Who watches? (audience)                               │
│     - What's the hook? (first 2 seconds)                    │
│     - What's the CTA? (last 3 seconds)                      │
│     - Total duration?                                       │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  2. STRUCTURE                                                │
│     - Break into scenes (each = one idea, 2-6 seconds)      │
│     - Write the text for each scene (keep it short)         │
│     - Decide scene order + transitions                      │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  3. THEME                                                    │
│     - Pick colors (background, foreground, accent, muted)   │
│     - Pick fonts (display, body, mono)                      │
│     - Pick motion language (fast/sharp vs slow/gentle)      │
│     - Pick particles (embers, dust, snow, none)             │
│     - Save as themes/YourTheme.js                            │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  4. SCENE                                                    │
│     - Copy templates/scene-template.html                    │
│     - Replace text + layout with your content               │
│     - Build the GSAP timeline (or swap animation system)    │
│     - Save as scenes/your-scene.html                        │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  5. PREVIEW                                                  │
│     - Open scene.html#live in browser                       │
│     - Watch it play end-to-end                              │
│     - Tweak timeline, text, CSS until it feels right        │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  6. AUDIO                                                    │
│     - Generate music: node bin/forge-music --bpm 120        │
│     - OR drop a licensed track into audio/                  │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  7. RENDER                                                   │
│     node bin/forge-render scenes/your-scene.html \          │
│         --theme themes/YourTheme.js \                       │
│         --music audio/track.wav \                           │
│         --output output/your-video.mp4 \                    │
│         --gpu --encoder auto                                │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  8. ITERATE                                                  │
│     - Too slow? Add --scale 0.5 for fast preview            │
│     - Want different vibe? Try a different theme            │
│     - Want different music? Generate or drop in new track   │
│     - Need a 15s cutdown? Edit scene timeline + re-render   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Themes — the visual identity layer

A theme is a serializable description of a video's look and feel. It's pure data — no DOM, no animation code. The renderer injects it into the scene as:

1. **CSS custom properties** (`:root { --accent: #ff6b1a; ... }`) — scenes use `var(--accent)`
2. **A JS object** (`window.theme = { palette: {...}, motion: {...} }`) — scenes read for logic

### Theme shape

```js
module.exports = {
  name: 'my-theme',

  palette: {
    background:      '#0a0a10',   // page background
    foreground:      '#ffffff',   // main text
    accent:          '#ff6b1a',   // brand color (CTAs, highlights)
    accentSecondary: '#ffb800',   // secondary accent
    muted:           'rgba(255,255,255,0.65)',
    surface:         '#191c29',   // card backgrounds
    border:          'rgba(255,255,255,0.12)'
  },

  typography: {
    display:  "'Inter', sans-serif",      // big headlines
    body:     "'Inter', sans-serif",      // paragraph text
    mono:     "'JetBrains Mono', monospace",
    baseSize: '38px'
  },

  motion: {
    defaultEase:     'back.out(1.4)',     // GSAP ease name
    defaultDuration: 0.5,                  // seconds
    stagger:         0.08,                 // seconds between staggered elements
    punchEase:       'power4.out',         // for impact frames
    punchDuration:   0.15
  },

  layout: {
    padding: 80,           // px
    gap:     30,           // px between elements
    radius:  20            // px corner radius
  },

  decor: {
    glowColor:     'rgba(255,140,40,0.55)',
    particleColor: '#ffb800',
    particleStyle: 'embers',     // 'embers' | 'dust' | 'snow' | 'confetti' | 'bubbles' | 'none'
    backgroundMode: 'gradient'   // 'gradient' | 'mesh' | 'grid' | 'rays' | 'solid'
  },

  assets: {
    logo: '<svg>...</svg>',
    watermark: '@yourbrand'
  }
};
```

### Creating a new theme

1. Copy `themes/ForgeTheme.js` to `themes/YourTheme.js`
2. Edit the values
3. Use it: `--theme themes/YourTheme.js`

### Theme-aware scenes

A scene is "theme-aware" if it uses CSS variables instead of hardcoded values:

```css
/* Theme-LOCKED (bad — ignores theme) */
h1 { color: #ff6b1a; font-family: 'Inter', sans-serif; }

/* Theme-AWARE (good — adapts to any theme) */
h1 { color: var(--accent); font-family: var(--font-display); }
```

Theme-aware scenes work with ANY theme. Theme-locked scenes only work with one. The template at `templates/scene-template.html` is fully theme-aware — use it as your starting point.

### A/B testing themes

```bash
# Same scene, 3 themes → 3 different videos
node bin/forge-render scene.html --theme themes/ForgeTheme.js    --output output/forge.mp4
node bin/forge-render scene.html --theme themes/PodcastTheme.js  --output output/podcast.mp4
node bin/forge-render scene.html --theme themes/MinimalTheme.js  --output output/minimal.mp4
```

Pick the winner. This is impossible if your scene hardcodes colors.

---

## 5. Building a new scene from scratch

### Option A: Use the scaffolding CLI (fastest)

```bash
node bin/forge-new my-video --theme forge
cd my-video
# Edit scene.html and theme.js
node ../bin/forge-render scene.html --output output.mp4 --music music.wav --theme theme.js
```

This creates a directory with a theme-aware scene template, a theme file, and a symlink to the default music.

### Option B: Manual

1. Copy `templates/scene-template.html` to `scenes/your-scene.html`
2. Edit the `<body>` — replace text, add/remove elements
3. Edit the `<script>` — build your GSAP timeline
4. Render:

```bash
node bin/forge-render scenes/your-scene.html --output output.mp4 --theme themes/ForgeTheme.js
```

### Scene structure patterns

**Pattern 1: Single-scene (simple promos)**
```html
<div class="scene" id="main">
  <h1>YOUR HEADLINE</h1>
  <p>Subtitle</p>
</div>
```
Good for: 6-second bumper ads, single CTAs.

**Pattern 2: Multi-scene carousel (most common)**
```html
<div class="scene" id="hook">...</div>
<div class="scene" id="problem">...</div>
<div class="scene" id="solution">...</div>
<div class="scene" id="cta">...</div>
```
Each scene is `position: absolute; inset: 0; opacity: 0;` — the timeline fades them in/out. Good for: 15-60s explainers, promos.

**Pattern 3: Continuous scroll (storytelling)**
```html
<div id="track" style="transition: transform 0.6s">
  <section>Scene 1</section>
  <section>Scene 2</section>
  <section>Scene 3</section>
</div>
```
Animate `transform: translateY()` to move between sections. Good for: long-form (60s+), tutorials.

**Pattern 4: Layered reveal (cinematic)**
```html
<div class="scene">
  <div class="layer-bg"></div>
  <div class="layer-mid"></div>
  <div class="layer-fg"></div>
  <div class="layer-text"></div>
</div>
```
Each layer animates independently with parallax. Good for: product launches, brand films.

### Building the timeline

The timeline is the director's script. It says "at time X, element Y should look like Z."

```js
const masterTL = gsap.timeline({ paused: true });

// Scene 1: Hook (0-3s)
masterTL.set('#scene-hook', { opacity: 1 }, 0);
masterTL.to('#scene-hook .word', {
  opacity: 1, y: 0,
  duration: 0.5, stagger: 0.12,
  ease: 'back.out(1.4)'
}, 0.3);
masterTL.to('#scene-hook', { opacity: 0, duration: 0.4 }, 2.6);

// Scene 2: Value prop (3-8s)
masterTL.set('#scene-value', { opacity: 1 }, 3.0);
// ... etc

// Hold final frame
masterTL.to({}, { duration: 2 });
```

**Tips:**
- Use `masterTL.set()` for instant state changes, `masterTL.to()` for animated
- Use negative offset (`-0.2`) for overlap (smoother transitions)
- Always end with a hold (`masterTL.to({}, { duration: 2 })`) so the last frame lingers
- The total duration = position of last tween + its duration. `masterTL.duration()` returns this.

### Deterministic canvas/WebGL

If your scene has a canvas, `renderAtTime` must redraw it based on `t`:

```js
window.renderAtTime = function(t) {
  masterTL.seek(t);

  // Clear + redraw based on t
  ctx.clearRect(0, 0, w, h);

  // Each particle's position is computed from t, not real-time delta
  for (const p of particles) {
    const age = t - p.spawnT;
    if (age < 0 || age > p.lifetime) continue;
    const x = p.x0 + p.vx * age;
    const y = p.y0 + p.vy * age + 0.5 * p.gravity * age * age;
    const alpha = 1 - (age / p.lifetime);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(x, y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
};
```

**Critical:** Never use `requestAnimationFrame` inside `renderAtTime`. Never read `performance.now()`. Always derive state from `t`.

---

## 6. Swapping the animation system

GSAP is the default, but it's not required. Any system that can seek to a timestamp works.

### Using Anime.js instead

```html
<!-- Replace the GSAP CDN -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"></script>
<script>
// Anime.js doesn't have a timeline .seek() by default, but you can build one:
const animations = [
  anime({ targets: '.word', opacity: [0, 1], translateY: [60, 0],
          duration: 500, delay: anime.stagger(80), autoplay: false }),
  anime({ targets: '.sub', opacity: [0, 1], duration: 500, autoplay: false })
];

// Compute total duration
const totalDuration = Math.max(...animations.map(a => a.duration + (a.delay || 0)));

window.masterTL = {
  seek(t) {
    for (const a of animations) {
      a.seek(t * 1000);  // anime.js uses ms
    }
  },
  duration() { return totalDuration / 1000; }
};

window.renderAtTime = (t) => window.masterTL.seek(t);
</script>
```

### Using raw CSS animations

```html
<style>
.word { animation: fadeIn 0.5s forwards; }
.word:nth-child(2) { animation-delay: 0.1s; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(60px); } to { opacity: 1; transform: translateY(0); } }
</style>
<script>
// For CSS animations, renderAtTime sets animation-delay and uses a hack:
// set document.timeline.currentTime = t * 1000
window.masterTL = {
  seek(t) {
    // CSS animations follow document.timeline — we can't easily seek them.
    // Solution: convert to CSS transitions triggered by class swaps.
    // OR: use the Web Animations API (element.animate()) which is seekable.
  },
  duration() { return 5; }
};
</script>
```

**Recommendation:** Use the **Web Animations API** (`element.animate()`) if you want native browser animations that are seekable. It's built into every modern browser and supports `.currentTime` for seeking.

### Using Three.js (3D scenes)

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1080/1920, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas') });
renderer.setSize(1080, 1920);

// Build your 3D scene...
const cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ color: 0xff6b1a }));
scene.add(cube);

// Animate by time
window.masterTL = {
  seek(t) { /* store t for render */ },
  duration() { return 10; }
};
let currentTime = 0;
window.renderAtTime = function(t) {
  currentTime = t;
  cube.rotation.x = t * 0.5;
  cube.rotation.y = t * 0.7;
  camera.position.z = 5 + Math.sin(t) * 0.5;
  renderer.render(scene, camera);
};
</script>
```

### Using Lottie (After Effects exports)

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>
<script>
const anim = lottie.loadAnimation({
  container: document.getElementById('lottie-container'),
  renderer: 'svg',
  loop: false,
  autoplay: false,
  path: 'animation.json'
});

anim.addEventListener('DOMLoaded', () => {
  window.masterTL = {
    seek(t) { anim.goToAndStop(t * 1000, true); },
    duration() { return anim.totalFrames / anim.frameRate; }
  };
  window.renderAtTime = (t) => window.masterTL.seek(t);
});
</script>
```

---

## 7. Adding a new renderer

A renderer captures frames from a scene. The default is `PlaywrightRenderer` (Chromium via Playwright). To add an alternative:

### Step 1: Implement the Renderer interface

```js
// src/renderers/PuppeteerRenderer.js
const { Renderer } = require('../core/Renderer');

class PuppeteerRenderer extends Renderer {
  async _init() {
    const puppeteer = require('puppeteer');
    this.browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1080, height: 1920 });
    await this.page.goto('file://' + this.config.get('htmlPath'));
    // ... inject theme, wait for renderAtTime, etc.
  }

  async _getDuration() {
    return await this.page.evaluate(() => window.masterTL.duration());
  }

  async _renderFrame(t, outPath) {
    await this.page.evaluate((tt) => window.renderAtTime(tt), t);
    await this.page.screenshot({ path: outPath, type: 'jpeg', quality: 92 });
  }

  async _close() {
    await this.browser.close();
  }
}

module.exports = { PuppeteerRenderer };
```

### Step 2: Register in the factory

```js
// src/core/rendererFactory.js
function createRenderer(config, logger) {
  const type = config.get('rendererType') || 'playwright';
  switch (type) {
    case 'playwright': return new PlaywrightRenderer(config, logger);
    case 'puppeteer':  return new PuppeteerRenderer(config, logger);
    default: throw new ConfigError(`Unknown renderer: ${type}`);
  }
}
```

### Step 3: Use it

```bash
node bin/forge-render scene.html --renderer-type puppeteer --output out.mp4
```

### When to add a new renderer

- **Puppeteer** — if you already use it elsewhere and don't want to install Playwright
- **Direct CDP** — for maximum control, minimal overhead (no library wrapper)
- **Selenium** — if you need to test against multiple real browsers
- **wkhtmltoimage** — for ultra-fast low-quality captures (no JS animation)

---

## 8. Adding a new encoder

An encoder turns a directory of frames into a video file. To add a new one:

### Step 1: Implement the Encoder interface

```js
// src/encoders/AV1Encoder.js
const { Encoder } = require('../core/Encoder');

class AV1Encoder extends Encoder {
  constructor(config, logger) {
    super(config, logger);
    this.name = 'av1';
  }

  async _encode({ framesDir, outputPath, frameCount, audioPath }) {
    const args = [
      'ffmpeg', '-y',
      '-framerate', String(this.config.get('fps')),
      '-i', path.join(framesDir, 'frame_%05d.jpg'),
      ...(audioPath ? ['-i', audioPath] : []),
      '-c:v', 'libaom-av1',
      '-cpu-used', '4',
      '-crf', String(this.config.get('crf')),
      ...(audioPath ? ['-c:a', 'aac', '-b:a', '192k'] : ['-an']),
      outputPath
    ];
    await exec(args, { logger: this.logger, timeout: this.config.get('timeout') });
    return { path: outputPath, sizeBytes: fileSize(outputPath), durationSec: 0 };
  }
}

module.exports = { AV1Encoder };
```

### Step 2: Register in the factory

```js
// src/core/encoderFactory.js
const { AV1Encoder } = require('../encoders/AV1Encoder');

function createEncoder(config, logger) {
  switch (config.get('encoder')) {
    case 'av1': return new AV1Encoder(config, logger);
    // ... existing cases
  }
}
```

### Step 3: Add to config validation

```js
// src/config/Config.js
if (!['cpu', 'auto', 'nvenc', 'vaapi', 'qsv', 'videotoolbox', 'av1'].includes(c.encoder)) {
  throw new ConfigError(`encoder must be ...|av1, got ${c.encoder}`);
}
```

### When to add a new encoder

- **AV1** — 30% smaller files than H.264, same quality (slower encode)
- **HEVC (h265)** — 50% smaller than H.264 (royalty issues)
- **ProRes** — for professional video editing workflows
- **VP9** — for web-only delivery (YouTube uses it)
- **GIF** — for ultra-short looping graphics

---

## 9. Adding a new audio generator

The default `MusicGenerator` calls a Python script that synthesizes electronic music. To add alternatives:

### Option A: New Python synth

Copy `src/audio/generate_music.py` to `generate_lofi.py`, change the arrangement (slower tempo, jazz chords, vinyl crackle), and create a wrapper:

```js
// src/audio/LoFiGenerator.js
class LoFiGenerator extends MusicGenerator {
  async generate(opts) {
    // ... same as parent but call generate_lofi.py
  }
}
```

### Option B: AI-generated music (API-based)

```js
// src/audio/SunoGenerator.js
class SunoGenerator {
  async generate(opts) {
    const response = await fetch('https://api.suno.ai/v1/generate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.SUNO_API_KEY}` },
      body: JSON.stringify({ prompt: 'lofi hip hop 30 seconds', duration: 30 })
    });
    const audioBuffer = await response.arrayBuffer();
    fs.writeFileSync(opts.outputPath, Buffer.from(audioBuffer));
    return { path: opts.outputPath, sizeBytes: audioBuffer.byteLength };
  }
}
```

### Option C: Voiceover (TTS)

```js
// src/audio/VoiceoverGenerator.js
const { exec } = require('../utils/exec');
class VoiceoverGenerator {
  async generate({ text, outputPath }) {
    // Use Coqui TTS, Piper, or cloud TTS
    await exec(['tts', '--text', text, '--out_path', outputPath]);
    return { path: outputPath, sizeBytes: fileSize(outputPath) };
  }
}
```

### Register multiple generators

```js
// src/audio/AudioFactory.js
function createAudioGenerator(type, logger) {
  switch (type) {
    case 'forge':   return new MusicGenerator(logger);
    case 'lofi':    return new LoFiGenerator(logger);
    case 'suno':    return new SunoGenerator(logger);
    case 'voice':   return new VoiceoverGenerator(logger);
    default:        return new MusicGenerator(logger);
  }
}
```

---

## 10. Multi-format project structure

For a single video, the structure is simple. For **multiple video formats** (a brand that produces reels, podcast promos, product demos, etc.), organize like this:

```
my-brand-videos/
├── bin/                           # shared CLIs
├── src/                           # shared engine
├── themes/
│   ├── BrandTheme.js              # master brand theme
│   ├── DarkTheme.js               # dark variant
│   ├── LightTheme.js              # light variant
│   └── HolidayTheme.js            # seasonal
├── scenes/
│   ├── formats/
│   │   ├── promo-reel/            # 30s Instagram reel
│   │   │   ├── scene.html
│   │   │   └── README.md
│   │   ├── podcast-promo/         # 15s podcast teaser
│   │   │   ├── scene.html
│   │   │   └── README.md
│   │   ├── product-demo/          # 60s feature walkthrough
│   │   │   ├── scene.html
│   │   │   └── README.md
│   │   └── event-recap/           # 45s conference recap
│   │       ├── scene.html
│   │       └── README.md
│   └── shared/                    # reusable scene fragments
│       ├── logo-sting.html        # 2s logo animation
│       └── cta-template.html      # reusable CTA
├── audio/
│   ├── music/                     # background tracks
│   │   ├── promo.wav
│   │   └── podcast.wav
│   └── voiceovers/
│       └── demo-narration.wav
└── output/                        # rendered videos land here
```

### Render commands per format

```bash
# Promo reel (default brand theme)
node bin/forge-render scenes/formats/promo-reel/scene.html \
    --theme themes/BrandTheme.js --music audio/music/promo.wav \
    --output output/promo-$(date +%Y%m%d).mp4

# Podcast promo (warm intimate theme)
node bin/forge-render scenes/formats/podcast-promo/scene.html \
    --theme themes/PodcastTheme.js --music audio/music/podcast.wav \
    --output output/podcast-$(date +%Y%m%d).mp4

# Product demo (clean minimal theme, with voiceover)
node bin/forge-render scenes/formats/product-demo/scene.html \
    --theme themes/MinimalTheme.js --music audio/voiceovers/demo-narration.wav \
    --output output/demo-$(date +%Y%m%d).mp4
```

### Shared scene fragments

Don't duplicate the logo sting across scenes. Use a build step or `<!-- include: -->` comments + a pre-processor:

```html
<!-- scene.html -->
<body>
  <!-- include: scenes/shared/logo-sting.html -->
  <div class="scene" id="main">...</div>
</body>
```

And a small build script that inlines includes before rendering. (Not built in, but easy to add — see Issue #1 in the project board.)

---

## 11. Worked example: building a "Podcast Promo" from scratch

Let's build a real, different video format end-to-end. This shows the full process.

### 11.1 Concept

- **Format:** 15-second podcast promo
- **Audience:** potential listeners scrolling Instagram
- **Hook:** a provocative quote (not the show name)
- **Structure:** quote → show title → CTA (3 scenes, not 8)
- **Vibe:** warm, intimate, editorial (NOT dark and techy)

### 11.2 Scaffold

```bash
node bin/forge-new podcast-promo --theme podcast
cd podcast-promo
```

### 11.3 Edit the theme

`theme.js` (already copied from `PodcastTheme.js`):

```js
module.exports = {
  name: 'podcast',
  palette: {
    background: '#f4ecd8',     // cream paper
    foreground: '#2a1810',     // dark brown
    accent: '#7a1f2b',         // burgundy
    accentSecondary: '#d4a017',// mustard
    muted: 'rgba(42,24,16,0.6)'
  },
  typography: {
    display: "'Playfair Display', serif",
    body: "'Crimson Text', serif",
    mono: "'Courier New', monospace"
  },
  motion: {
    defaultEase: 'power2.inOut',  // gentle
    defaultDuration: 0.8,         // slow
    stagger: 0.15
  },
  decor: { particleStyle: 'dust', particleColor: '#d4a017' },
  assets: { watermark: '@deepcuts' }
};
```

### 11.4 Build the scene

`scene.html` — replace the template's single-scene structure with 3 scenes:

```html
<div class="scene" id="scene-quote">
  <div class="quote-mark">"</div>
  <div class="quote-text">
    <span class="word">The</span>
    <span class="word">best</span>
    <span class="word">stories</span>
    <span class="word">aren't</span>
    <span class="word em">told.</span><br>
    <span class="word">They're</span>
    <span class="word em">overheard.</span>
  </div>
  <div class="quote-attr">— every great podcast</div>
</div>

<div class="scene" id="scene-title">
  <div class="show-eyebrow">// new show</div>
  <h1 class="show-title">
    <span class="word">DEEP</span>
    <span class="word">CUTS</span>
  </h1>
  <p class="show-tagline">Conversations with the people who built the things you use every day.</p>
</div>

<div class="scene" id="scene-cta">
  <div class="cta-eyebrow">// listen now</div>
  <h1 class="cta-headline">
    <span class="word">EVERY</span>
    <span class="word">TUESDAY.</span>
  </h1>
  <div class="cta-platforms">
    <div class="cta-platform">SPOTIFY</div>
    <div class="cta-platform">APPLE</div>
    <div class="cta-platform">YOUTUBE</div>
  </div>
  <div class="cta-handle">@deepcuts</div>
</div>
```

### 11.5 Build the timeline

```js
const masterTL = gsap.timeline({ paused: true });

// Scene 1: Quote (0 - 5s)
masterTL.set('#scene-quote', { opacity: 1 }, 0);
masterTL.to('#scene-quote .quote-mark', { opacity: 1, duration: 0.8, ease: 'power2.inOut' }, 0.3);
masterTL.to('#scene-quote .word', {
  opacity: 1, y: 0, duration: 0.8, stagger: 0.15, ease: 'power2.inOut'
}, 0.8);
masterTL.to('#scene-quote .quote-attr', { opacity: 1, duration: 0.8 }, 2.5);
masterTL.to({}, { duration: 1.5 }); // hold
masterTL.to('#scene-quote', { opacity: 0, duration: 0.6 }, 5.0);

// Scene 2: Title (5.6 - 10s)
masterTL.set('#scene-title', { opacity: 1 }, 5.6);
// ... etc

// Scene 3: CTA (10.6 - 14s)
// ... etc
```

### 11.6 Preview

Open `scene.html#live` in a browser. Watch it play. Tweak until it feels right.

### 11.7 Generate music

```bash
node bin/forge-music --bpm 90 --bars 8 --out music.wav
# Slower tempo (90 BPM) for intimate vibe
```

### 11.8 Render

```bash
node bin/forge-render scene.html \
    --output output/podcast-promo.mp4 \
    --music music.wav \
    --theme theme.js \
    --fps 30 --target-fps 60
```

### 11.9 Try a different theme

Same scene, totally different vibe:

```bash
node bin/forge-render scene.html \
    --output output/podcast-promo-dark.mp4 \
    --music music.wav \
    --theme ../themes/ForgeTheme.js   # dark + fiery
```

The same scene now looks like a tech product launch instead of a podcast. That's the power of theme-aware scenes.

---

## 12. Plug-in reference — every extension point

| What you want to change | Interface | File to create | Register in |
|-------------------------|-----------|----------------|-------------|
| Visual style (colors, fonts) | Theme object | `themes/X.js` | n/a (pass via `--theme`) |
| Scene content + animation | `window.masterTL` + `window.renderAtTime` | `scenes/X.html` | n/a (pass via `--html-path`) |
| Animation library | n/a (just load different CDN in scene) | scene HTML | n/a |
| Frame capture method | `Renderer` abstract class | `src/renderers/X.js` | `src/core/rendererFactory.js` |
| Video codec | `Encoder` abstract class | `src/encoders/X.js` | `src/core/encoderFactory.js` |
| Music generation | `MusicGenerator` class | `src/audio/X.js` | `src/audio/AudioFactory.js` (new) |
| CLI flags | `parseArgs()` in `bin/forge-render` | `bin/forge-render` | n/a |
| Config defaults | `DEFAULTS` object | `src/config/Config.js` | n/a |
| Environment detection | `detect()` in `src/utils/environment.js` | n/a (extend existing) | n/a |
| Logging | `Logger` class | n/a (extend existing) | n/a |

---

## 13. Anti-patterns to avoid

### ❌ Hardcoding colors in scenes
```css
h1 { color: #ff6b1a; }  /* can't be themed */
```
✅ Use theme variables:
```css
h1 { color: var(--accent); }
```

### ❌ Using `requestAnimationFrame` in render mode
```js
function loop() {
  draw();
  requestAnimationFrame(loop);  // fights with renderer's seek
}
loop();
```
✅ Gate on render mode:
```js
if (!window.renderMode) {
  function loop() { draw(); requestAnimationFrame(loop); }
  loop();
}
```

### ❌ Reading real time inside `renderAtTime`
```js
window.renderAtTime = function(t) {
  const now = performance.now();  // WRONG — non-deterministic
  particle.x = now * 0.001;
};
```
✅ Use the `t` parameter:
```js
window.renderAtTime = function(t) {
  particle.x = t * 60;  // deterministic
};
```

### ❌ One giant scene file with everything hardcoded
✅ Split into scene + theme. Let the scene be data-driven.

### ❌ Calling `masterTL.play()` unconditionally
```js
masterTL.play();  // breaks render mode
```
✅ Only play in live mode:
```js
if (!window.renderMode) masterTL.play();
```

### ❌ Modifying core files to add a new format
✅ Add new files in `scenes/`, `themes/`, `src/renderers/`, `src/encoders/`. The core stays untouched. This keeps your format isolated and mergeable.

### ❌ Tightly coupling scene to theme
```js
if (window.theme.name === 'forge') {
  document.body.style.background = '#0a0a10';
}
```
✅ Let CSS variables handle it. If you need conditional logic, branch on theme *properties*, not name:
```js
if (window.theme.decor.particleStyle === 'embers') {
  // spawn ember particles
}
```

---

## 14. Testing new formats

### Smoke test

```bash
# Fast render at low quality to catch errors
node bin/forge-render scenes/your-scene.html \
    --output output/_test.mp4 \
    --scale 0.25 --fps 8 --crf 30 \
    --no-resume --log-level debug
```

If this succeeds, the full render will too.

### Visual test

Open the scene in a browser at `scene.html#live` and scrub through. Every frame should look intentional.

### Theme compatibility test

Render with all 3 themes:
```bash
for theme in Forge Podcast Minimal; do
  node bin/forge-render scene.html --theme themes/${theme}Theme.js \
      --output output/_test-${theme}.mp4 --scale 0.25 --fps 8
done
```

If the scene is truly theme-aware, all 3 will look good (just different).

### Duration test

```bash
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 output/video.mp4
```

Should match `masterTL.duration()`. If it's off by more than 0.1s, check your timeline.

### Frame-by-frame inspection

Extract every 30th frame to a contact sheet:
```bash
ffmpeg -i output/video.mp4 -vf "select=not(mod(n\,30))" -vsync vfr /tmp/frame_%03d.jpg
montage /tmp/frame_*.jpg -tile 4x4 -geometry 270x480 /tmp/contact-sheet.jpg
```

Eyeball the sheet — every frame should look intentional, no blanks or glitches.

---

## TL;DR

To build a completely new video format:

1. **Concept** — what's it for, who watches, what's the hook
2. **Theme** — copy `themes/ForgeTheme.js`, change colors/fonts/motion
3. **Scene** — copy `templates/scene-template.html`, build your content + timeline
4. **Music** — `node bin/forge-music --bpm 120 --out music.wav` or drop in your own
5. **Render** — `node bin/forge-render scene.html --theme theme.js --music music.wav --output out.mp4`
6. **Iterate** — try different themes, tweak timeline, adjust music

The system is 1000% flexible because every axis (scene, theme, animation, renderer, encoder, audio) is independently swappable. Build a 6-second bumper or a 10-minute documentary — same engine, same workflow.
