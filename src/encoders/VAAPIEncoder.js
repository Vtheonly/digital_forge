/**
 * VAAPIEncoder.js — Intel/AMD hardware H.264 encoder (h264_vaapi)
 *
 * Uses Video Acceleration API (VAAPI) for hardware encoding on Intel
 * integrated graphics (iHD/i965 drivers) and AMD GPUs (radeonsi).
 *
 * REQUIREMENTS
 * ------------
 *   - Intel iGPU (Broadwell+) or AMD GPU with VAAPI support
 *   - /dev/dri/renderD128 device node
 *   - ffmpeg built with --enable-vaapi
 *   - Correct render device accessible to the user running ffmpeg
 *
 * COMMON ON
 * ---------
 *   - Intel NUCs, laptops with Iris Xe graphics
 *   - Some cloud instances (Intel GPU instances on AWS/GCP)
 *   - NOT on Colab (which uses NVIDIA T4/P100)
 */

const path = require('path');
const fs = require('fs');
const { exec } = require('../utils/exec');
const { Encoder } = require('../core/Encoder');
const { EncodeError, DependencyError } = require('../utils/errors');

class VAAPIEncoder extends Encoder {
  constructor(config, logger) {
    super(config, logger);
    this.name = 'vaapi';
    this._renderDevice = '/dev/dri/renderD128';
  }

  async _encode({ framesDir, outputPath, frameCount, audioPath }) {
    await this._verifyAvailable();

    const c = this.config;
    const ext = c.get('frameFormat') === 'jpeg' ? 'jpg' : 'png';

    const inputArgs = [
      'ffmpeg', '-hide_banner', '-y',
      '-vaapi_device', this._renderDevice,
      '-framerate', String(c.get('fps')),
      '-i', path.join(framesDir, `frame_%05d.${ext}`)
    ];

    const audioInput = audioPath ? ['-i', audioPath] : [];

    // VAAPI requires the filter chain to end with format=nv12,hwupload
    // so we wrap the regular filters and append the VAAPI-specific bits.
    const filters = [];
    const captureScale = c.get('captureScale');
    if (captureScale !== 1.0) {
      filters.push(`scale=${c.get('width')}:${c.get('height')}:flags=${c.get('scaleFilter')}`);
    }
    if (c.get('targetFps') !== c.get('fps')) {
      if (c.get('interpolate') === 'minterpolate') {
        filters.push(`minterpolate=fps=${c.get('targetFps')}:mi_mode=mci`);
      } else {
        filters.push(`fps=${c.get('targetFps')}`);
      }
    }
    filters.push('format=nv12', 'hwupload');

    const videoArgs = [
      '-c:v', 'h264_vaapi',
      '-qp', String(c.get('crf')),  // VAAPI uses QP (≈ CRF semantics)
      '-bf', '0'                     // no B-frames (some Intel GPUs choke)
    ];

    const filterArgs = filters.length ? ['-vf', filters.join(',')] : [];
    const audioArgs = audioPath ? this._audioArgs(audioPath) : ['-an'];
    const outputArgs = [...this._outputArgs(), '-r', String(c.get('targetFps')), outputPath];

    const fullArgs = [...inputArgs, ...audioInput, ...videoArgs, ...filterArgs, ...audioArgs, ...outputArgs];

    this.logger.info('Encoding with h264_vaapi (Intel/AMD GPU)', {
      frames: frameCount, renderDevice: this._renderDevice, qp: c.get('crf')
    });

    const t0 = Date.now();
    await exec(fullArgs, { logger: this.logger, timeout: c.get('timeout'), rejectOnNonZero: true });

    const { fileSize } = require('../utils/fs');
    const sizeBytes = fileSize(outputPath);
    if (sizeBytes === 0) throw new EncodeError('VAAPI produced empty file', { outputPath });

    const durationSec = (Date.now() - t0) / 1000;
    this.logger.info('VAAPI encoding complete', {
      sizeMB: (sizeBytes / 1024 / 1024).toFixed(2),
      durationSec: durationSec.toFixed(1)
    });

    return { path: outputPath, sizeBytes, durationSec };
  }

  async _verifyAvailable() {
    if (!fs.existsSync(this._renderDevice)) {
      throw new DependencyError(
        `VAAPI render device not found: ${this._renderDevice}\n` +
        'VAAPI requires Intel/AMD GPU with /dev/dri/renderD128.\n' +
        'On Colab, use NVENC instead (FORGE_ENCODER=nvenc).'
      );
    }
    try {
      const { stdout } = await exec(['ffmpeg', '-hide_banner', '-encoders']);
      if (!stdout.includes('h264_vaapi')) {
        throw new DependencyError('ffmpeg lacks h264_vaapi. Install ffmpeg with VAAPI support.');
      }
    } catch (e) {
      if (e instanceof DependencyError) throw e;
      throw new DependencyError('ffmpeg check failed: ' + e.message, { cause: e });
    }
  }
}

module.exports = { VAAPIEncoder };
