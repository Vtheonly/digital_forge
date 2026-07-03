/**
 * FFmpegEncoder.js — CPU H.264 encoder (libx264)
 *
 * The default. Works everywhere. Slower than GPU encoders but produces
 * the highest quality at a given bitrate (CRF 18 = visually lossless).
 *
 * Use this when:
 *   - No GPU available (Colab CPU runtime, most laptops)
 *   - Maximum quality is required
 *   - Render time is not critical
 */

const path = require('path');
const { exec } = require('../utils/exec');
const { Encoder } = require('../core/Encoder');
const { EncodeError } = require('../utils/errors');

class FFmpegEncoder extends Encoder {
  constructor(config, logger) {
    super(config, logger);
    this.name = 'cpu';
  }

  async _encode({ framesDir, outputPath, frameCount, audioPath }) {
    const c = this.config;
    const sourceFps = c.get('fps');

    // Compute frame file extension
    const ext = c.get('frameFormat') === 'jpeg' ? 'jpg' : 'png';

    const inputArgs = [
      'ffmpeg', '-hide_banner', '-y',
      '-framerate', String(sourceFps),
      '-i', path.join(framesDir, `frame_%05d.${ext}`)
    ];

    // Audio input (optional)
    const audioInput = audioPath ? ['-i', audioPath] : [];

    // Video codec args (libx264 + preset + crf)
    const videoArgs = [
      ...this._videoCodecArgs(),     // -c:v libx264
      ...this._presetArgs(),         // -preset medium
      '-crf', String(c.get('crf'))
    ];

    // Filter chain (scale + interpolation)
    const filterArgs = this._videoFilterArgs();

    // Audio args
    const audioArgs = audioPath ? this._audioArgs(audioPath) : ['-an'];

    // Output args
    const outputArgs = [
      ...this._outputArgs(),
      '-r', String(c.get('targetFps')),
      outputPath
    ];

    const fullArgs = [...inputArgs, ...audioInput, ...videoArgs, ...filterArgs, ...audioArgs, ...outputArgs];

    this.logger.info('Encoding with libx264 (CPU)', {
      frames: frameCount,
      sourceFps,
      targetFps: c.get('targetFps'),
      crf: c.get('crf'),
      preset: c.get('preset')
    });
    this.logger.debug('ffmpeg cmd', { cmd: fullArgs.join(' ') });

    const t0 = Date.now();
    const result = await exec(fullArgs, {
      logger: this.logger,
      timeout: c.get('timeout'),
      rejectOnNonZero: true
    });

    const { fileSize } = require('../utils/fs');
    const sizeBytes = fileSize(outputPath);
    if (sizeBytes === 0) {
      throw new EncodeError('Encoder produced empty file', { outputPath });
    }

    const durationSec = (Date.now() - t0) / 1000;
    this.logger.info('Encoding complete', {
      sizeMB: (sizeBytes / 1024 / 1024).toFixed(2),
      durationSec: durationSec.toFixed(1)
    });

    return { path: outputPath, sizeBytes, durationSec };
  }

  _videoCodecArgs() {
    return ['-c:v', 'libx264'];
  }
}

module.exports = { FFmpegEncoder };
