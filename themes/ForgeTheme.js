/**
 * ForgeTheme.js — The default "Digital Forge" brand theme
 *
 * Visual identity: dark, technical, fiery orange + yellow accents,
 * industrial motion (sharp punches, forge sparks).
 *
 * This is the theme used by the original Digital Forge reel.
 */

module.exports = {
  name: 'forge',

  palette: {
    background:     '#0a0a10',
    foreground:     '#ffffff',
    accent:         '#ff6b1a',   // forge orange
    accentSecondary:'#ffb800',   // molten yellow
    muted:          'rgba(255,255,255,0.65)',
    surface:        '#191c29',
    border:         'rgba(255,255,255,0.12)'
  },

  typography: {
    display: "'Inter', system-ui, sans-serif",
    body:    "'Inter', system-ui, sans-serif",
    mono:    "'JetBrains Mono', 'Courier New', monospace",
    baseSize: '38px'
  },

  motion: {
    defaultEase:     'back.out(1.4)',
    defaultDuration: 0.5,
    stagger:         0.08,
    punchEase:       'power4.out',
    punchDuration:   0.15
  },

  layout: {
    padding: 80,
    gap:     30,
    radius:  20
  },

  decor: {
    glowColor:     'rgba(255,140,40,0.55)',
    particleColor: '#ffb800',
    particleStyle: 'embers',     // 'embers' | 'snow' | 'confetti' | 'bubbles' | 'none'
    backgroundMode: 'gradient'   // 'gradient' | 'mesh' | 'grid' | 'rays' | 'solid'
  },

  assets: {
    // SVG markup for logo/watermark, used by scenes that reference theme.assets.logo
    logo: `<svg viewBox="0 0 200 200">
      <path d="M40 110 L160 110 L160 125 L140 125 L140 160 L60 160 L60 125 L40 125 Z"
            fill="url(#anvilGrad)" stroke="#fff5e1" stroke-width="2"/>
      <path d="M50 90 L150 90 L160 110 L40 110 Z"
            fill="url(#anvilGrad)" stroke="#fff5e1" stroke-width="2"/>
    </svg>`,
    watermark: '@digitalforgedev'
  }
};
