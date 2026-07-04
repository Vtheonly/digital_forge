/**
 * Theme.js — Abstract theme interface
 *
 * A Theme is a serializable description of a video's visual identity:
 *   - Color palette
 *   - Typography (font families, weights, sizes)
 *   - Motion language (easing curves, durations, stagger patterns)
 *   - Spacing & layout grid
 *   - Decorative elements (particle types, glow styles, background layers)
 *   - Brand assets (logo SVG, watermark)
 *
 * Themes are pure data — no DOM, no GSAP. They're injected into scenes
 * via CSS custom properties (variables) and a JS object on `window.theme`.
 * This means:
 *   - The same scene HTML can render in completely different visual styles
 *     just by swapping the theme
 *   - Themes can be shared across scenes (a "brand kit")
 *   - Themes can be exported/imported as JSON
 *   - A/B testing visual styles = running the same scene with 2 themes
 *
 * IMPLEMENTING A THEME
 * --------------------
 * Create a file in `themes/` that exports an object matching this shape:
 *
 *   {
 *     name: 'my-theme',
 *     palette: { ... },      // colors
 *     typography: { ... },   // fonts
 *     motion: { ... },       // easing & timing
 *     layout: { ... },       // spacing
 *     decor: { ... },        // particles, glows
 *     assets: { ... }        // logo, watermark
 *   }
 *
 * See `themes/ForgeTheme.js` for a full example.
 *
 * USING A THEME
 * -------------
 * Pass `--theme themes/MyTheme.js` to forge-render. The renderer reads
 * the theme, injects it as CSS variables + `window.theme`, and the scene
 * HTML references them: `color: var(--accent)`, `font-family: var(--font-display)`.
 *
 * A scene that uses theme variables is theme-agnostic — it works with any
 * theme. A scene that hardcodes colors is theme-locked.
 */

/**
 * Validate that an object is a complete theme.
 * Throws ConfigError with specifics if anything is missing/wrong.
 */
function validateTheme(theme) {
  const { ConfigError } = require('../utils/errors');
  const errs = [];

  if (!theme || typeof theme !== 'object') {
    throw new ConfigError('Theme must be an object');
  }
  if (typeof theme.name !== 'string' || !theme.name) {
    errs.push('theme.name must be a non-empty string');
  }

  // Palette
  const p = theme.palette || {};
  for (const key of ['background', 'foreground', 'accent', 'accentSecondary', 'muted']) {
    if (typeof p[key] !== 'string' || !p[key]) {
      errs.push(`theme.palette.${key} must be a string (color)`);
    }
  }

  // Typography
  const t = theme.typography || {};
  for (const key of ['display', 'body', 'mono']) {
    if (typeof t[key] !== 'string' || !t[key]) {
      errs.push(`theme.typography.${key} must be a font-family string`);
    }
  }

  // Motion (optional but validated if present)
  if (theme.motion) {
    const m = theme.motion;
    if (m.defaultEase && typeof m.defaultEase !== 'string') {
      errs.push('theme.motion.defaultEase must be a string (GSAP ease name)');
    }
    if (m.defaultDuration && typeof m.defaultDuration !== 'number') {
      errs.push('theme.motion.defaultDuration must be a number (seconds)');
    }
  }

  if (errs.length) {
    throw new ConfigError('Invalid theme:\n  - ' + errs.join('\n  - '));
  }
  return true;
}

/**
 * Convert a theme object to CSS custom properties string.
 * This gets injected as a <style> tag by the renderer.
 *
 * Example output:
 *   :root {
 *     --bg: #0a0a10;
 *     --fg: #ffffff;
 *     --accent: #ff6b1a;
 *     --font-display: 'Inter', sans-serif;
 *     --ease: 'back.out(1.4)';
 *     --duration: 0.5s;
 *     ...
 *   }
 */
function themeToCSS(theme) {
  validateTheme(theme);
  const lines = [':root {'];

  // Palette
  const p = theme.palette;
  lines.push(`  --bg: ${p.background};`);
  lines.push(`  --fg: ${p.foreground};`);
  lines.push(`  --accent: ${p.accent};`);
  lines.push(`  --accent-2: ${p.accentSecondary || p.accent};`);
  lines.push(`  --muted: ${p.muted};`);
  if (p.surface) lines.push(`  --surface: ${p.surface};`);
  if (p.border) lines.push(`  --border: ${p.border};`);

  // Typography
  const t = theme.typography;
  lines.push(`  --font-display: ${t.display};`);
  lines.push(`  --font-body: ${t.body};`);
  lines.push(`  --font-mono: ${t.mono};`);
  if (t.baseSize) lines.push(`  --font-base: ${t.baseSize};`);

  // Motion
  const m = theme.motion || {};
  if (m.defaultEase) lines.push(`  --ease: ${m.defaultEase};`);
  if (m.defaultDuration) lines.push(`  --duration: ${m.defaultDuration}s;`);
  if (m.stagger) lines.push(`  --stagger: ${m.stagger}s;`);

  // Layout
  const l = theme.layout || {};
  if (l.padding) lines.push(`  --pad: ${l.padding}px;`);
  if (l.gap) lines.push(`  --gap: ${l.gap}px;`);
  if (l.radius) lines.push(`  --radius: ${l.radius}px;`);

  // Decor (custom props for particles, glows)
  const d = theme.decor || {};
  if (d.glowColor) lines.push(`  --glow: ${d.glowColor};`);
  if (d.particleColor) lines.push(`  --particle: ${d.particleColor};`);

  lines.push('}');
  return lines.join('\n');
}

/**
 * Convert theme to a JSON-safe object for `window.theme` injection.
 * Strips any non-serializable values (functions, DOM nodes).
 */
function themeToJS(theme) {
  validateTheme(theme);
  return JSON.parse(JSON.stringify(theme));
}

module.exports = { validateTheme, themeToCSS, themeToJS };
