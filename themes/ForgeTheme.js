/**
 * ForgeTheme.js — Clean, White-Label Visual Identity Config
 */

module.exports = {
  name: "forge",

  palette: {
    background: "#0a0a10",
    foreground: "#ffffff",
    accent: "#ff6b1a", // warm orange
    accentSecondary: "#ffb800", // yellow highlights
    muted: "rgba(255,255,255,0.65)",
    surface: "#191c29",
    border: "rgba(255,255,255,0.12)",
  },

  typography: {
    display: "'Inter', system-ui, sans-serif",

    body: "'Inter', system-ui, sans-serif",

    mono: "'JetBrains Mono', 'Courier New', monospace",

    baseSize: "38px",
  },

  motion: {
    defaultEase: "back.out(1.4)",

    defaultDuration: 0.5,

    stagger: 0.08,

    punchEase: "power4.out",

    punchDuration: 0.15,
  },

  layout: {
    padding: 80,

    gap: 30,

    radius: 20,
  },

  decor: {
    glowColor: "rgba(255,140,40,0.55)",

    particleColor: "#ffb800",

    particleStyle: "embers", // 'embers' | 'snow' | 'confetti' | 'bubbles' | 'none'

    backgroundMode: "gradient", // 'gradient' | 'mesh' | 'grid' | 'rays' | 'solid'
  },

  assets: {
    logo: `<svg viewBox="0 0 200 200">

<circle cx="100" cy="100" r="40" fill="none" stroke="#ff6b1a" stroke-width="4"/>

<polygon points="100,80 120,110 80,110" fill="#ffb800"/>

</svg>`,

    watermark: "", // Left blank to remove the default branding watermark
  },
};
