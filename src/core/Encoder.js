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

    // === TIME SCALE: speed the video back up ===
    // If timeScale=0.5, we captured at half speed (animation lasted 2x longer).
    // We now speed up the video by 1/timeScale = 2x using setpts.
    //   setpts=PTS/N divides presentation timestamps by N (speeds up by N)
    //   atempo=N speeds up audio by N (but we handle audio separately)
    const timeScale = c.get('timeScale');
    if (timeScale !== 1.0) {
      const speedup = 1 / timeScale;
      filters.push(`setpts=PTS/${speedup}`);
    }

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
   * Build the audio OUTPUT args (codec, bitrate, shortest).
   *
   * NOTE: This does NOT include the `-i audioPath` input flag — that's
   * added separately by each encoder's `_encode()` method via the
   * `audioInput` array, which places it BEFORE the video codec args
   * (where ffmpeg expects input options). Including `-i` here would
   * cause a duplicate input and ffmpeg would fail with:
   *   "Option b:v cannot be applied to input url ..."
   *
   * TIME SCALE: if timeScale != 1.0, we sped up the video with setpts.
   * We also need to speed up the audio by the same factor using atempo.
   * atempo accepts factors 0.5-2.0; for larger ranges we chain multiple.
   */
  _audioArgs(audioPath) {
    if (!audioPath) return ['-an'];
    const args = [
      '-c:a', this.config.get('audioCodec'),
      '-b:a', this.config.get('audioBitrate')
    ];
    // Apply audio speed-up to match video time-scale
    const timeScale = this.config.get('timeScale');
    if (timeScale !== 1.0) {
      const speedup = 1 / timeScale;
      // atempo only accepts 0.5-2.0; chain for larger ranges
      const atempoFilters = [];
      let remaining = speedup;
      while (remaining > 2.0) {
        atempoFilters.push('atempo=2.0');
        remaining /= 2.0;
      }
      while (remaining < 0.5) {
        atempoFilters.push('atempo=0.5');
        remaining /= 0.5;
      }
      atempoFilters.push(`atempo=${remaining}`);
      args.push('-af', atempoFilters.join(','));
    }
    args.push('-shortest');
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
