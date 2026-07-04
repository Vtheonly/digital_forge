/**
 * rendererFactory.js — Picks the right renderer based on config
 */

const PlaywrightModule = require("../renderers/PlaywrightRenderer");
const ParallelModule = require("../renderers/ParallelPlaywrightRenderer");

// Defensively resolve both named and default class exports
const PlaywrightRenderer =
  PlaywrightModule.PlaywrightRenderer || PlaywrightModule;
const ParallelPlaywrightRenderer =
  ParallelModule.ParallelPlaywrightRenderer || ParallelModule;

const { ConfigError } = require("../utils/errors");
const env = require("../utils/environment");

/**
 * Instantiates the appropriate renderer based on worker configuration.
 *
 * @param {Config} config
 * @param {Logger} logger
 * @returns {Renderer}
 */
function createRenderer(config, logger) {
  const requested = config.get("workers");

  // Resolve auto worker count (0)
  let workers = requested;
  if (workers === 0) {
    const e = env.detect();
    workers = Math.max(1, Math.min(4, Math.floor(e.cpus / 2)));
  }

  if (workers > 1) {
    if (typeof ParallelPlaywrightRenderer !== "function") {
      throw new ConfigError(
        "ParallelPlaywrightRenderer constructor could not be resolved from module exports.",
      );
    }
    return new ParallelPlaywrightRenderer(config, logger);
  }

  if (typeof PlaywrightRenderer !== "function") {
    throw new ConfigError(
      "PlaywrightRenderer constructor could not be resolved from module exports.",
    );
  }
  return new PlaywrightRenderer(config, logger);
}

module.exports = { createRenderer };
