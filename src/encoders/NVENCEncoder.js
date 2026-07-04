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
 * HWUPLOAD_CUDA (frame upload optimization)
 * -----------------------------------------
 *   When config.nvencHwupload is true (default), we prepend `hwupload_cuda`
 *   to the filter chain. This uploads each decoded frame to GPU memory ONCE;
 *   subsequent GPU filters (scale_npp) and the NVENC encoder then operate
 *   entirely in VRAM, avoiding per-frame CPU↔GPU round-trips.
 *
 *   This matters most when capturing at a lower resolution than the output
 *   (e.g. --scale 0.5 captures 540×960 but the output is 1080×1920). With
 *   hwupload_cuda + scale_npp, the upscale happens on the GPU.
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

    // Build filter chain. When hwupload is enabled, we upload frames to GPU
    // once and use scale_npp (GPU scaler) instead of CPU scale.
    const filterArgs = this._nvencVideoFilterArgs();

    const audioArgs = audioPath ? this._audioArgs(audioPath) : ['-an'];
    const outputArgs = [
      ...this._outputArgs(),
      '-r', String(c.get('targetFps')),
      outputPath
    ];

    const fullArgs = [...inputArgs, ...audioInput, ...videoArgs, ...filterArgs, ...audioArgs, ...outputArgs];

    this.logger.info('Encoding with h264_nvenc (NVIDIA GPU)', {
      frames: frameCount,
      preset, cq,
      hwupload: c.get('nvencHwupload'),
      gpu: 'auto-selected'
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
   * NVENC-specific filter chain.
   *
   * When `nvencHwupload` is enabled (default), we use:
   *   - hwupload_cuda: upload decoded frame from CPU to GPU VRAM
   *   - scale_npp: GPU-accelerated scaler (replaces CPU `scale` filter)
   *   - format=yuv420p: pixel format on GPU
   *
   * When disabled (or hwupload not available), we fall back to the standard
   * CPU filter chain from the parent class.
   *
   * Frame interpolation (minterpolate) is always done on CPU — there's no
   * GPU equivalent in ffmpeg.
   */
  _nvencVideoFilterArgs() {
    const c = this.config;
    const filters = [];

    const captureScale = c.get('captureScale');
    const targetFps = c.get('targetFps');
    const sourceFps = c.get('fps');
    const useHwupload = c.get('nvencHwupload');
    const timeScale = c.get('timeScale');

    if (useHwupload) {
      // === GPU pipeline ===
      // Upload to VRAM first, then do all subsequent work on GPU.
      filters.push('hwupload_cuda');

      // GPU scale (only if capture was at lower res than output)
      if (captureScale !== 1.0) {
        const w = c.get('width');
        const h = c.get('height');
        // scale_npp uses the same algorithm names as the CPU `scale` filter
        // for the most part, but only supports a subset. lanczos is supported.
        const alg = c.get('scaleFilter') === 'lanczos' ? 'lanczos'
                  : c.get('scaleFilter') === 'bicubic' ? 'bicubic'
                  : c.get('scaleFilter') === 'bilinear' ? 'bilinear'
                  : 'lanczos';
        filters.push(`scale_npp=${w}:${h}:format=yuv420p:interp=${alg}`);
      } else {
        // Even without scaling, force yuv420p pixel format on GPU
        filters.push('format=yuv420p');
      }

      // Time-scale speed-up (must be done on CPU after hwdownload because
      // setpts is a CPU filter; for typical timeScale=0.5 the speedup is 2x
      // and the cost is negligible vs. the capture savings)
      if (timeScale !== 1.0) {
        const speedup = 1 / timeScale;
        filters.push('hwdownload', 'format=yuv420p');
        filters.push(`setpts=PTS/${speedup}`);
        filters.push('hwupload_cuda');
      }

      // Frame interpolation (CPU-only — done via hwdownload/hwupload)
      if (c.get('interpolate') === 'minterpolate' && targetFps > sourceFps) {
        // minterpolate is CPU-only — download, interpolate, upload again
        filters.push('hwdownload', 'format=yuv420p');
        filters.push(`minterpolate=fps=${targetFps}:mi_mode=mci:mc_mode=aobmc:vsbmc=1`);
        filters.push('hwupload_cuda');
      } else if (targetFps !== sourceFps) {
        // fps filter is cheap, runs fine on CPU
        filters.push('hwdownload', 'format=yuv420p');
        filters.push(`fps=${targetFps}`);
        filters.push('hwupload_cuda');
      }
    } else {
      // === CPU pipeline (fallback) ===
      // Time-scale speed-up
      if (timeScale !== 1.0) {
        const speedup = 1 / timeScale;
        filters.push(`setpts=PTS/${speedup}`);
      }
      if (captureScale !== 1.0) {
        const w = c.get('width');
        const h = c.get('height');
        filters.push(`scale=${w}:${h}:flags=${c.get('scaleFilter')}`);
      }
      if (c.get('interpolate') === 'minterpolate' && targetFps > sourceFps) {
        filters.push(`minterpolate=fps=${targetFps}:mi_mode=mci:mc_mode=aobmc:vsbmc=1`);
      } else if (targetFps !== sourceFps) {
        filters.push(`fps=${targetFps}`);
      }
    }

    return filters.length ? ['-vf', filters.join(',')] : [];
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

    // If hwupload_cuda is requested, verify it's available in this ffmpeg build
    if (this.config.get('nvencHwupload')) {
      try {
        const { stdout } = await exec(['ffmpeg', '-hide_banner', '-filters']);
        if (!stdout.includes('hwupload_cuda') || !stdout.includes('scale_npp')) {
          this.logger.warn(
            'ffmpeg lacks hwupload_cuda or scale_npp filters — falling back to CPU filter chain. ' +
            'Install ffmpeg with CUDA support to enable hardware frame upload.'
          );
          // Disable hwupload for this run
          this.config.set('nvencHwupload', false);
        }
      } catch (e) {
        this.logger.warn('Could not verify hwupload_cuda availability — trying anyway', {
          err: e.message
        });
      }
    }
  }
}

module.exports = { NVENCEncoder };
