/**
 * rendererFactory.js — Picks the right renderer based on config
 *
 * Currently only PlaywrightRenderer is implemented (it's the only
 * browser-based frame capturer), but the factory makes it easy to
 * add alternatives (Puppeteer, headless Chrome CDP direct, etc.)
 */

const { PlaywrightRenderer } = require('../renderers/PlaywrightRenderer');
const { ConfigError } = require('../utils/errors');

function createRenderer(config, logger) {
  // For now there's only one renderer. The factory exists so we can add
  // more later (e.g. PuppeteerRenderer, SeleniumRenderer) without
  // changing the pipeline.
  switch ('playwright') {
    case 'playwright':
      return new PlaywrightRenderer(config, logger);
    default:
      throw new ConfigError(`Unknown renderer type`);
  }
}

module.exports = { createRenderer };
