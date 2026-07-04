/**
 * rendererFactory.js — Picks the right renderer based on config
 *
 * Two concrete renderers:
 *   - PlaywrightRenderer          — single-process serial capture
 *   - ParallelPlaywrightRenderer  — multi-process parallel capture
 *
 * The parallel renderer is selected automatically when config.workers > 1
 * (or workers == 0 + auto-detected > 1). Otherwise we use the simpler
 * serial renderer.
 */

const { PlaywrightRenderer } = require('../renderers/PlaywrightRenderer');
const { ParallelPlaywrightRenderer } = require('../renderers/ParallelPlaywrightRenderer');
const { ConfigError } = require('../utils/errors');
const env = require('../utils/environment');

function createRenderer(config, logger) {
  const requested = config.get('workers');
  // Resolve auto (0) — mirrors Config.js logic
  let workers = requested;
  if (workers === 0) {
    const e = env.detect();
    workers = Math.max(1, Math.min(4, Math.floor(e.cpus / 2)));
  }

  if (workers > 1) {
    return new ParallelPlaywrightRenderer(config, logger);
  }
  return new PlaywrightRenderer(config, logger);
}

module.exports = { createRenderer };
