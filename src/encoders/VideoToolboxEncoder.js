/**
 * VideoToolboxEncoder.js — macOS hardware H.264 encoder (h264_videotoolbox)
 *
 * Uses Apple's VideoToolbox framework for hardware encoding on Macs.
 * Works on any Mac with hardware H.264 encoding support (basically all
 * Macs since 2011).
 *
 * REQUIREMENTS
 * ------------
 *   - macOS (this encoder is auto-selected on darwin)
 *   - ffmpeg built with --enable-videotoolbox (Homebrew's ffmpeg has it)
 *
 * QUALITY
 * -------
 *   - Uses -q:v (1-100, lower = better). We map CRF to ~Q:50
 *   - Faster than libx264, similar quality at high bitrates
 */

const path = require('path');
const { exec } = require('../utils/exec');
const { Encoder } = require('../core/Encoder');
const { EncodeError, DependencyError } = require('../utils/errors');

class VideoToolboxEncoder extends Encoder {
  constructor(config, logger) {
    super(config, logger);
    this.name = 'videotoolbox';
  }

  async _encode({ framesDir, outputPath, frameCount, audioPath }) {
    await this._verifyAvailable();

    const c = this.config;
    const ext = c.get('frameFormat') === 'jpeg' ? 'jpg' : 'png';

    const inputArgs = [
      'ffmpeg', '-hide_banner', '-y',
      '-framerate', String(c.get('fps')),
      '-i', path.join(framesDir, `frame_%05d.${ext}`)
    ];

    const audioInput = audioPath ? ['-i', audioPath] : [];

    // VideoToolbox uses -q:v (1-100, lower=better)
    // Map CRF 0-51 → Q 100-30 (inverse: lower CRF = better, lower Q = better)
    const qv = Math.max(30, Math.min(100, 100 - c.get('crf') * 1.5));

    const videoArgs = [
      '-c:v', 'h264_videotoolbox',
      '-q:v', String(Math.round(qv))
    ];

    const filterArgs = this._videoFilterArgs();
    const audioArgs = audioPath ? this._audioArgs(audioPath) : ['-an'];
    const outputArgs = [...this._outputArgs(), '-r', String(c.get('targetFps')), outputPath];

    const fullArgs = [...inputArgs, ...audioInput, ...videoArgs, ...filterArgs, ...audioArgs, ...outputArgs];

    this.logger.info('Encoding with h264_videotoolbox (macOS GPU)', {
      frames: frameCount, qv: Math.round(qv)
    });

    const t0 = Date.now();
    await exec(fullArgs, { logger: this.logger, timeout: c.get('timeout'), rejectOnNonZero: true });

    const { fileSize } = require('../utils/fs');
    const sizeBytes = fileSize(outputPath);
    if (sizeBytes === 0) throw new EncodeError('VideoToolbox produced empty file', { outputPath });

    const durationSec = (Date.now() - t0) / 1000;
    this.logger.info('VideoToolbox encoding complete', {
      sizeMB: (sizeBytes / 1024 / 1024).toFixed(2),
      durationSec: durationSec.toFixed(1)
    });

    return { path: outputPath, sizeBytes, durationSec };
  }

  async _verifyAvailable() {
    if (process.platform !== 'darwin') {
      throw new DependencyError('VideoToolbox only available on macOS');
    }
    try {
      const { stdout } = await exec(['ffmpeg', '-hide_banner', '-encoders']);
      if (!stdout.includes('h264_videotoolbox')) {
        throw new DependencyError(
          'ffmpeg lacks h264_videotoolbox. Install via: brew install ffmpeg'
        );
      }
    } catch (e) {
      if (e instanceof DependencyError) throw e;
      throw new DependencyError('ffmpeg check failed: ' + e.message, { cause: e });
    }
  }
}

module.exports = { VideoToolboxEncoder };
