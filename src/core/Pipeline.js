/**
 * Pipeline.js — Orchestrates the full render + encode flow
 *
 * This is the brain of the project. Given a Config, it:
 *   1. Sets up the renderer (browser, page, scene)
 *   2. Captures all frames (with resume support)
 *   3. Encodes the final MP4 (with audio)
 *   4. Cleans up intermediate frames
 *   5. Reports stats (total time, fps, file size)
 *
 * Each phase is its own method so it can be called independently —
 * e.g. you can re-encode existing frames without re-capturing them.
 *
 * ERROR HANDLING
 * --------------
 * Every phase is wrapped in try/finally so the browser always gets closed.
 * Failures throw AppError subclasses with full context for debugging.
 *
 * RESUME SUPPORT
 * --------------
 * If config.resumeFromDisk is true (default), frames already on disk are
 * skipped. This lets you split a long render across multiple runs.
 */

const fs = require('fs');
const path = require('path');
const { Logger } = require('./Logger');
const { Config } = require('../config/Config');
const { createRenderer } = require('./rendererFactory');
const { createEncoder } = require('./encoderFactory');
const { AppError, RenderError, EncodeError } = require('../utils/errors');
const { ensureDir, cleanDir, listFiles, fileExists, fileSize, humanSize, rmrf } = require('../utils/fs');

class Pipeline {
  constructor(config, logger) {
    if (!(config instanceof Config)) {
      throw new AppError('Pipeline requires a Config instance');
    }
    this.config = config;
    this.logger = logger || new Logger({ level: config.get('logLevel') });
    this.renderer = null;
    this.encoder = null;
    this.stats = {
      captureStartedAt: null,
      captureEndedAt: null,
      encodeStartedAt: null,
      encodeEndedAt: null,
      framesCaptured: 0,
      framesSkipped: 0,
      finalSizeBytes: 0
    };
  }

  /**
   * Run the full pipeline: setup → capture → encode → cleanup.
   */
  async run() {
    const summary = this.config.summary();
    this.logger.info('Pipeline starting', summary);

    try {
      await this.capture();
      await this.encode();
      if (this.config.get('cleanFramesAfterEncode')) {
        this.cleanup();
      }
      this.logger.info('Pipeline complete ✓', this._finalStats());
      return this.stats;
    } catch (e) {
      this.logger.error('Pipeline failed', { err: e.message, code: e.code, context: e.context });
      throw e;
    }
  }

  /**
   * PHASE 1: Capture frames from the scene HTML.
   */
  async capture() {
    this.stats.captureStartedAt = Date.now();
    this.logger.info('=== CAPTURE PHASE ===');

    const framesDir = this.config.get('framesDir');
    const frameFormat = this.config.get('frameFormat');
    const ext = frameFormat === 'jpeg' ? 'jpg' : 'png';

    ensureDir(framesDir);

    // Create renderer + init
    this.renderer = createRenderer(this.config, this.logger);
    await this.renderer.init();

    try {
      // Get scene duration
      const duration = await this.renderer.getDuration();
      const fps = this.config.get('fps');
      const totalFrames = Math.ceil(duration * fps);

      // Apply start/max bounds
      const startFrame = this.config.get('startFrame');
      const maxFrames = this.config.get('maxFrames');
      const endFrame = Math.min(startFrame + maxFrames, totalFrames);

      this.logger.info('Capture plan', {
        duration: duration.toFixed(2) + 's',
        totalFrames,
        willCapture: endFrame - startFrame,
        range: `${startFrame}..${endFrame - 1}`,
        resumeFromDisk: this.config.get('resumeFromDisk')
      });

      let captured = 0;
      let skipped = 0;
      const t0 = Date.now();

      for (let i = startFrame; i < endFrame; i++) {
        const framePath = path.join(framesDir, `frame_${String(i).padStart(5, '0')}.${ext}`);

        // Resume support: skip if already on disk
        if (this.config.get('resumeFromDisk') && fileExists(framePath) && fileSize(framePath) > 3000) {
          skipped++;
          continue;
        }

        const ts = i / fps;
        const result = await this.renderer.renderFrame(ts, framePath);
        captured++;

        // Progress log every 10 frames or on last frame
        if (captured % 10 === 0 || i === endFrame - 1) {
          const elapsed = (Date.now() - t0) / 1000;
          const rate = captured / (elapsed || 1);
          const eta = (endFrame - i - 1) / (rate || 1);
          this.logger.info('Capture progress', {
            frame: `${i + 1}/${totalFrames}`,
            time: ts.toFixed(2) + 's',
            rate: rate.toFixed(2) + ' fps',
            eta: eta.toFixed(0) + 's',
            captured, skipped
          });
        }
      }

      this.stats.framesCaptured = captured;
      this.stats.framesSkipped = skipped;
      this.stats.captureEndedAt = Date.now();

      const totalOnDisk = listFiles(framesDir, f => f.endsWith('.' + ext)).length;
      this.logger.info('Capture phase complete', {
        captured, skipped, totalOnDisk, totalFrames,
        elapsedSec: ((this.stats.captureEndedAt - this.stats.captureStartedAt) / 1000).toFixed(1)
      });
    } finally {
      await this.renderer.close();
    }
  }

  /**
   * PHASE 2: Encode captured frames into a final MP4.
   */
  async encode() {
    this.stats.encodeStartedAt = Date.now();
    this.logger.info('=== ENCODE PHASE ===');

    const framesDir = this.config.get('framesDir');
    const frameFormat = this.config.get('frameFormat');
    const ext = frameFormat === 'jpeg' ? 'jpg' : 'png';
    const frameCount = listFiles(framesDir, f => f.endsWith('.' + ext)).length;

    if (frameCount === 0) {
      throw new EncodeError('No frames to encode', { framesDir });
    }

    const audioPath = this.config.get('musicPath');
    const outputPath = this.config.get('outputPath') || path.join(
      this.config.get('outputDir'),
      'output.mp4'
    );

    ensureDir(path.dirname(outputPath));

    this.encoder = createEncoder(this.config, this.logger);
    const result = await this.encoder.encode({
      framesDir,
      outputPath,
      frameCount,
      audioPath
    });

    this.stats.finalSizeBytes = result.sizeBytes;
    this.stats.encodeEndedAt = Date.now();

    this.logger.info('Encode phase complete', {
      outputPath,
      size: humanSize(result.sizeBytes),
      elapsedSec: result.durationSec.toFixed(1)
    });

    return result;
  }

  /**
   * PHASE 3: Remove intermediate frames.
   */
  cleanup() {
    this.logger.info('=== CLEANUP PHASE ===');
    const framesDir = this.config.get('framesDir');
    if (fs.existsSync(framesDir)) {
      rmrf(framesDir);
      this.logger.info('Removed frames dir', { dir: framesDir });
    }
  }

  _finalStats() {
    const totalMs = (this.stats.encodeEndedAt || Date.now()) - this.stats.captureStartedAt;
    return {
      totalTime: (totalMs / 1000).toFixed(1) + 's',
      framesCaptured: this.stats.framesCaptured,
      framesSkipped: this.stats.framesSkipped,
      finalSize: humanSize(this.stats.finalSizeBytes)
    };
  }
}

module.exports = { Pipeline };
