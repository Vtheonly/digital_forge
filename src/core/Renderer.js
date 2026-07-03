/**
 * Renderer.js — Abstract base class for all renderers
 *
 * Defines the contract every renderer must follow:
 *   - init()      : boot browser/page
 *   - getDuration(): query scene duration
 *   - renderFrame(t, outPath): render one frame at time t (seconds)
 *   - close()     : cleanup
 *
 * Concrete subclasses (PlaywrightRenderer, etc.) implement these.
 * The pipeline calls them through this interface so renderers can
 * be swapped without touching higher-level code.
 */

const { AppError, RenderError } = require('../utils/errors');

class Renderer {
  constructor(config, logger) {
    if (this.constructor === Renderer) {
      throw new AppError('Renderer is abstract — instantiate a concrete subclass');
    }
    this.config = config;
    this.logger = logger.child('renderer');
    this._initialized = false;
    this._closed = false;
  }

  /**
   * Boot the renderer (browser, page, etc.).
   * Must be called before renderFrame / getDuration.
   */
  async init() {
    if (this._initialized) return;
    await this._init();
    this._initialized = true;
    this.logger.info('Renderer initialized', { type: this.constructor.name });
  }

  /**
   * Subclass-specific initialization.
   */
  async _init() {
    throw new AppError('_init() not implemented');
  }

  /**
   * Get the total duration of the scene timeline in seconds.
   * @returns {Promise<number>}
   */
  async getDuration() {
    this._ensureReady();
    return this._getDuration();
  }

  async _getDuration() {
    throw new AppError('_getDuration() not implemented');
  }

  /**
   * Render a single frame at the given timestamp.
   * @param {number} t - time in seconds
   * @param {string} outPath - absolute path to write the frame to
   * @returns {Promise<{path:string, sizeBytes:number, ms:number}>}
   */
  async renderFrame(t, outPath) {
    this._ensureReady();
    const t0 = Date.now();
    try {
      await this._renderFrame(t, outPath);
      const { fileSize } = require('../utils/fs');
      const sizeBytes = fileSize(outPath);
      const ms = Date.now() - t0;
      if (sizeBytes === 0) {
        throw new RenderError(`Frame produced empty file at t=${t}`, { t, outPath });
      }
      return { path: outPath, sizeBytes, ms };
    } catch (e) {
      throw new RenderError(`Frame render failed at t=${t}: ${e.message}`, {
        t, outPath, cause: e
      });
    }
  }

  async _renderFrame(t, outPath) {
    throw new AppError('_renderFrame() not implemented');
  }

  /**
   * Release all resources (browser, page, etc.).
   * Safe to call multiple times.
   */
  async close() {
    if (this._closed) return;
    this._closed = true;
    try {
      await this._close();
    } catch (e) {
      this.logger.warn('Error during close (ignored)', { err: e.message });
    }
    this.logger.debug('Renderer closed');
  }

  async _close() { /* override if needed */ }

  _ensureReady() {
    if (!this._initialized) {
      throw new RenderError('Renderer not initialized — call init() first');
    }
    if (this._closed) {
      throw new RenderError('Renderer already closed');
    }
  }
}

module.exports = { Renderer };
