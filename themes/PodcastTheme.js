/**
 * PodcastTheme.js — A completely different visual identity
 *
 * Use case: a podcast promo reel.
 *
 * Visual identity: warm, intimate, retro-radio vibe.
 *   - Cream paper background (not dark)
 *   - Deep burgundy + mustard yellow accents
 *   - Serif display font (feels editorial)
 *   - Slow, gentle motion (no sharp punches)
 *   - Floating dust particles (not sparks)
 *
 * This shows how a theme can completely change a video's feel
 * without changing the scene HTML or renderer.
 */

module.exports = {
  name: 'podcast',

  palette: {
    background:     '#f4ecd8',   // cream paper
    foreground:     '#2a1810',   // dark brown
    accent:         '#7a1f2b',   // deep burgundy
    accentSecondary:'#d4a017',   // mustard yellow
    muted:          'rgba(42,24,16,0.6)',
    surface:        '#e8d9b8',
    border:         'rgba(42,24,16,0.15)'
  },

  typography: {
    display: "'Playfair Display', Georgia, serif",
    body:    "'Crimson Text', Georgia, serif",
    mono:    "'Courier New', monospace",
    baseSize: '42px'
  },

  motion: {
    defaultEase:     'power2.inOut',     // gentle, no overshoot
    defaultDuration: 0.8,                // slower than forge
    stagger:         0.15,
    punchEase:       'power2.out',
    punchDuration:   0.3
  },

  layout: {
    padding: 100,
    gap:     40,
    radius:  8                    // sharp corners feel editorial
  },

  decor: {
    glowColor:     'rgba(212,160,23,0.3)',
    particleColor: '#d4a017',
    particleStyle: 'dust',        // slow-floating dust motes
    backgroundMode: 'solid'       // clean paper, no mesh
  },

  assets: {
    logo: `<svg viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="80" fill="none" stroke="#7a1f2b" stroke-width="3"/>
      <circle cx="100" cy="100" r="20" fill="#7a1f2b"/>
    </svg>`,
    watermark: '@thepodcast'
  }
};
