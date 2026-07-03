/**
 * MusicGenerator.js — Node wrapper around the Python music generator
 *
 * Lets the pipeline generate music on-demand instead of requiring a
 * pre-existing WAV file. Spawns Python as a subprocess.
 */

const path = require('path');
const { exec } = require('../utils/exec');
const { DependencyError, AppError } = require('../utils/errors');
const { fileExists, fileSize } = require('../utils/fs');

const PY_SCRIPT = path.resolve(__dirname, 'generate_music.py');

class MusicGenerator {
  constructor(logger) {
    this.logger = logger.child('music');
  }

  /**
   * Generate background music.
   * @param {Object} opts
   * @param {string} opts.outputPath  - where to write the WAV
   * @param {number} [opts.bpm=128]
   * @param {number} [opts.bars=17]
   * @returns {Promise<{path:string, sizeBytes:number, durationSec:number}>}
   */
  async generate(opts) {
    if (!opts.outputPath) throw new AppError('outputPath required');

    // Verify Python + deps
    await this._verifyPython();

    this.logger.info('Generating music', { bpm: opts.bpm || 128, bars: opts.bars || 17 });

    const args = [
      'python3', PY_SCRIPT,
      '--out', opts.outputPath,
      '--bpm', String(opts.bpm || 128),
      '--bars', String(opts.bars || 17)
    ];

    const result = await exec(args, {
      logger: this.logger,
      timeout: 60000,
      rejectOnNonZero: true
    });

    if (!fileExists(opts.outputPath)) {
      throw new AppError('Music generation produced no output file', { stdout: result.stdout.slice(-500) });
    }

    const sizeBytes = fileSize(opts.outputPath);
    this.logger.info('Music generated', {
      path: opts.outputPath,
      sizeMB: (sizeBytes / 1024 / 1024).toFixed(2)
    });

    return { path: opts.outputPath, sizeBytes };
  }

  async _verifyPython() {
    try {
      await exec(['python3', '-c', 'import numpy, scipy'], { rejectOnNonZero: true, timeout: 10000 });
    } catch (e) {
      throw new DependencyError(
        'Python 3 with numpy + scipy required. Install with: pip install numpy scipy',
        { cause: e }
      );
    }
  }
}

module.exports = { MusicGenerator };
