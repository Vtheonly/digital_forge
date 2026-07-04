/**
 * QSVEncoder.js — Intel QuickSync Video encoder (h264_qsv)
 *
 * Uses Intel QuickSync for hardware encoding. Similar to VAAPI but uses
 * Intel's Media SDK directly. Available on Intel CPUs with integrated
 * graphics (Sandy Bridge and newer).
 *
 * REQUIREMENTS
 * ------------
 *   - Intel CPU with iGPU (or Arc GPU)
 *   - libmfx (Intel Media SDK) installed
 *   - ffmpeg built with --enable-libmfx or --enable-qsv
 *
 * Less common on servers/Colab — VAAPI is the standard there.
 * Mostly useful on Intel Macs (older) and Windows machines with Intel iGPU.
 */

const path = require('path');
const { exec } = require('../utils/exec');
const { Encoder } = require('../core/Encoder');
const { EncodeError, DependencyError } = require('../utils/errors');

class QSVEncoder extends Encoder {
  constructor(config, logger) {
    super(config, logger);
    this.name = 'qsv';
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

    const videoArgs = [
      '-c:v', 'h264_qsv',
      '-global_quality', String(c.get('crf')),
      '-look_ahead', '1'
    ];

    const filterArgs = this._videoFilterArgs();
    const audioArgs = audioPath ? this._audioArgs(audioPath) : ['-an'];
    const outputArgs = [...this._outputArgs(), '-r', String(c.get('targetFps')), outputPath];

    const fullArgs = [...inputArgs, ...audioInput, ...videoArgs, ...filterArgs, ...audioArgs, ...outputArgs];

    this.logger.info('Encoding with h264_qsv (Intel QuickSync)', {
      frames: frameCount, quality: c.get('crf')
    });

    const t0 = Date.now();
    await exec(fullArgs, { logger: this.logger, timeout: c.get('timeout'), rejectOnNonZero: true });

    const { fileSize } = require('../utils/fs');
    const sizeBytes = fileSize(outputPath);
    if (sizeBytes === 0) throw new EncodeError('QSV produced empty file', { outputPath });

    const durationSec = (Date.now() - t0) / 1000;
    this.logger.info('QSV encoding complete', {
      sizeMB: (sizeBytes / 1024 / 1024).toFixed(2),
      durationSec: durationSec.toFixed(1)
    });

    return { path: outputPath, sizeBytes, durationSec };
  }

  async _verifyAvailable() {
    try {
      const { stdout } = await exec(['ffmpeg', '-hide_banner', '-encoders']);
      if (!stdout.includes('h264_qsv')) {
        throw new DependencyError(
          'ffmpeg lacks h264_qsv. Install ffmpeg with QuickSync support:\n' +
          '  Windows: use the gyan.dev build\n' +
          '  Linux: build with --enable-libmfx\n' +
          '  Or use VAAPI instead (FORGE_ENCODER=vaapi)'
        );
      }
    } catch (e) {
      if (e instanceof DependencyError) throw e;
      throw new DependencyError('ffmpeg check failed: ' + e.message, { cause: e });
    }
  }
}

module.exports = { QSVEncoder };
