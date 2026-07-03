/**
 * Encoder.js — Abstract base class for video encoders
 *
 * All encoders (CPU/NVENC/VAAPI/QSV/VideoToolbox) implement this interface.
 * The pipeline doesn't care which one is used — it just calls encode().
 */

const { AppError, EncodeError } = require('../utils/errors');

class Encoder {
  constructor(config, logger) {
    if (this.constructor === Encoder) {
      throw new AppError('Encoder is abstract — instantiate a concrete subclass');
    }
    this.config = config;
    this.logger = logger.child('encoder');
  }

  /**
   * Encode a directory of frames + an audio file into a final MP4.
   *
   * @param {Object} opts
   * @param {string} opts.framesDir  - dir containing frame_00000.jpg, frame_00001.jpg, ...
   * @param {string} opts.outputPath - final MP4 path
   * @param {number} opts.frameCount - number of input frames
   * @param {string} [opts.audioPath] - optional music track
   * @returns {Promise<{path:string, sizeBytes:number, durationSec:number}>}
   */
  async encode(opts) {
    this._validateOpts(opts);
    return this._encode(opts);
  }

  async _encode(opts) {
    throw new AppError('_encode() not implemented');
  }

  _validateOpts(opts) {
    if (!opts.framesDir) throw new EncodeError('framesDir required');
    if (!opts.outputPath) throw new EncodeError('outputPath required');
    if (!opts.frameCount || opts.frameCount < 1) {
      throw new EncodeError('frameCount must be >= 1');
    }
  }

  /**
   * Get the ffmpeg video codec + encoder name for this encoder.
   * Subclasses override.
   */
  _videoCodecArgs() {
    return ['-c:v', 'libx264'];
  }

  /**
   * Get ffmpeg preset args (some encoders don't support presets).
   */
  _presetArgs() {
    const preset = this.config.get('preset');
    return preset ? ['-preset', preset] : [];
  }

  /**
   * Build the standard video filter chain.
   * - Scale to final resolution (if capture was at lower res)
   * - Interpolate to target fps
   */
  _videoFilterArgs() {
    const c = this.config;
    const filters = [];

    // Scale to final resolution
    const captureScale = c.get('captureScale');
    if (captureScale !== 1.0) {
      const w = c.get('width');
      const h = c.get('height');
      const scaleAlg = c.get('scaleFilter');
      filters.push(`scale=${w}:${h}:flags=${scaleAlg}`);
    }

    // Frame interpolation
    const targetFps = c.get('targetFps');
    const sourceFps = c.get('fps');
    if (c.get('interpolate') === 'minterpolate' && targetFps > sourceFps) {
      filters.push(`minterpolate=fps=${targetFps}:mi_mode=mci:mc_mode=aobmc:vsbmc=1`);
    } else if (targetFps !== sourceFps) {
      filters.push(`fps=${targetFps}`);
    }

    return filters.length ? ['-vf', filters.join(',')] : [];
  }

  /**
   * Build the audio args (codec, bitrate, optional input).
   */
  _audioArgs(audioPath) {
    const args = [];
    if (audioPath) {
      args.push('-i', audioPath);
    }
    args.push(
      '-c:a', this.config.get('audioCodec'),
      '-b:a', this.config.get('audioBitrate'),
      '-shortest'
    );
    return args;
  }

  /**
   * Build the standard output args (pix_fmt, movflags, etc.)
   */
  _outputArgs() {
    return [
      '-pix_fmt', this.config.get('pixelFormat'),
      '-movflags', '+faststart',
      '-y'
    ];
  }
}

module.exports = { Encoder };
