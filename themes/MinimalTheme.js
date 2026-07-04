/**
 * MinimalTheme.js — Bare-bones theme for testing/learning
 *
 * The simplest valid theme. Use as a starting point for new themes.
 */

module.exports = {
  name: 'minimal',
  palette: {
    background:      '#000000',
    foreground:      '#ffffff',
    accent:          '#ffffff',
    accentSecondary: '#cccccc',
    muted:           'rgba(255,255,255,0.5)'
  },
  typography: {
    display: 'system-ui, sans-serif',
    body:    'system-ui, sans-serif',
    mono:    'monospace'
  },
  motion: {
    defaultEase:     'power2.out',
    defaultDuration: 0.5,
    stagger:         0.1
  },
  layout: { padding: 60, gap: 20, radius: 0 },
  decor: { particleStyle: 'none', backgroundMode: 'solid' },
  assets: {}
};
