/**
 * NVENCEncoder.js — NVIDIA hardware H.264 encoder (h264_nvenc)
 *
 * Uses the GPU's dedicated NVENC chip (separate from CUDA cores) to encode
 * video. ~5-20x faster than CPU libx264 with minimal quality loss.
 *
 * REQUIREMENTS
 * ------------
 *   - NVIDIA GPU (any modern one — T4, V100, A100, RTX 3060+, etc.)
 *   - NVIDIA drivers installed (nvidia-smi works)
 *   - ffmpeg built with --enable-nvenc (most distro builds include it)
 *
 * On Colab GPU runtime (T4), this Just Works after `node bin/setup`.
 *
 * QUALITY
 * -------
 *   - Uses CQ (constant quality) mode with cq=20 — visually equivalent
 *     to libx264 CRF 18 but ~10x faster.
 *   - preset: p1 (fastest) to p7 (highest quality). Default p4.
 *
 * TROUBLESHOOTING
 * ---------------
 *   "No capable devices found" → drivers missing or GPU in use by another process
 *   "h264_nvenc not found"     → install ffmpeg with NVENC support
 *                                (apt install ffmpeg on Ubuntu usually works)
 */

const path = require('path');
const { exec } = require('../utils/exec');
const { Encoder } = require('../core/Encoder');
const { EncodeError, DependencyError } = require('../utils/errors');

class NVENCEncoder extends Encoder {
  constructor(config, logger) {
    super(config, logger);
    this.name = 'nvenc';
  }

  async _encode({ framesDir, outputPath, frameCount, audioPath }) {
    // Pre-flight: verify NVENC is available
    await this._verifyAvailable();

    const c = this.config;
    const ext = c.get('frameFormat') === 'jpeg' ? 'jpg' : 'png';

    const inputArgs = [
      'ffmpeg', '-hide_banner', '-y',
      '-framerate', String(c.get('fps')),
      '-i', path.join(framesDir, `frame_%05d.${ext}`)
    ];

    const audioInput = audioPath ? ['-i', audioPath] : [];

    // NVENC video args
    // -c:v h264_nvenc: use NVIDIA encoder
    // -preset p4: balanced (p1=fastest, p7=highest quality)
    // -tune hq: high quality tuning
    // -rc vbr: variable bitrate (lets CQ mode work)
    // -cq 20: constant quality (lower=better, 20 ≈ CRF 18)
    // -b:v 0: required for CQ mode to actually use CQ
    const preset = c.get('preset') === 'medium' ? 'p4' :
                   c.get('preset') === 'fast' ? 'p2' :
                   c.get('preset') === 'slow' ? 'p6' : 'p4';
    const cq = c.get('crf') + 2;  // NVENC CQ is ~2 higher than x264 CRF for same quality

    const videoArgs = [
      '-c:v', 'h264_nvenc',
      '-preset', preset,
      '-tune', 'hq',
      '-rc', 'vbr',
      '-cq', String(cq),
      '-b:v', '0',
      '-spatial-aq', '1',
      '-temporal-aq', '1',
      '-rc-lookahead', '20'
    ];

    const filterArgs = this._videoFilterArgs();
    const audioArgs = audioPath ? this._audioArgs(audioPath) : ['-an'];
    const outputArgs = [
      ...this._outputArgs(),
      '-r', String(c.get('targetFps')),
      outputPath
    ];

    const fullArgs = [...inputArgs, ...audioInput, ...videoArgs, ...filterArgs, ...audioArgs, ...outputArgs];

    this.logger.info('Encoding with h264_nvenc (NVIDIA GPU)', {
      frames: frameCount,
      preset, cq, gpu: 'auto-selected'
    });
    this.logger.debug('ffmpeg cmd', { cmd: fullArgs.join(' ') });

    const t0 = Date.now();
    await exec(fullArgs, {
      logger: this.logger,
      timeout: c.get('timeout'),
      rejectOnNonZero: true
    });

    const { fileSize } = require('../utils/fs');
    const sizeBytes = fileSize(outputPath);
    if (sizeBytes === 0) {
      throw new EncodeError('NVENC encoder produced empty file', { outputPath });
    }

    const durationSec = (Date.now() - t0) / 1000;
    this.logger.info('NVENC encoding complete', {
      sizeMB: (sizeBytes / 1024 / 1024).toFixed(2),
      durationSec: durationSec.toFixed(1),
      speedup: 'NVENC is typically 5-20x faster than CPU'
    });

    return { path: outputPath, sizeBytes, durationSec };
  }

  /**
   * Verify NVENC is available before we start encoding.
   * Fails fast with a helpful message if not.
   */
  async _verifyAvailable() {
    try {
      const { stdout } = await exec(['ffmpeg', '-hide_banner', '-encoders']);
      if (!stdout.includes('h264_nvenc')) {
        throw new DependencyError(
          'ffmpeg lacks h264_nvenc. Install ffmpeg with NVENC support:\n' +
          '  Ubuntu/Colab: apt install ffmpeg (usually already has NVENC)\n' +
          '  Or build from source: https://trac.ffmpeg.org/wiki/HWAccelIntro'
        );
      }
    } catch (e) {
      if (e instanceof DependencyError) throw e;
      throw new DependencyError('Failed to check ffmpeg encoders: ' + e.message, { cause: e });
    }

    // Check GPU is actually accessible
    try {
      await exec(['nvidia-smi', '--query-gpu=name', '--format=csv,noheader'], {
        rejectOnNonZero: true, timeout: 5000
      });
    } catch (e) {
      throw new DependencyError(
        'nvidia-smi failed — GPU not accessible. Make sure you\'re on a GPU runtime.',
        { cause: e }
      );
    }
  }
}

module.exports = { NVENCEncoder };
