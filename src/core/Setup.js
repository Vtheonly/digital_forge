/**
 * Setup.js — One-shot environment bootstrap
 *
 * Handles installing everything the project needs:
 *   - System packages (Chromium, fonts, ffmpeg, NVIDIA drivers)
 *   - Node deps (playwright, etc.)
 *   - Python deps (numpy, scipy for music gen)
 *   - Playwright browser binary
 *
 * On Colab: installs via apt-get + pip + npx playwright install
 * On local Linux: same, but checks first to be polite
 * On Mac/Win: only installs Node/Python deps, assumes browser available
 *
 * Usage:
 *   const setup = new Setup({ logger });
 *   await setup.run();           // full setup
 *   await setup.ensureColab();   // Colab-only bootstrap
 */

const fs = require('fs');
const path = require('path');
const { exec, which } = require('../utils/exec');
const { AppError, DependencyError } = require('../utils/errors');
const { fileExists, dirExists } = require('../utils/fs');
const env = require('../utils/environment');

class Setup {
  constructor(opts = {}) {
    this.logger = opts.logger || console;
    this.envInfo = env.detect();
    this.projectRoot = opts.projectRoot || path.resolve(__dirname, '..', '..');
  }

  log(level, msg, meta) {
    if (this.logger[level]) this.logger[level](msg, meta);
    else console.log(`[${level}] ${msg}`, meta || '');
  }

  /**
   * Run the full setup sequence. Idempotent — skips what's already installed.
   */
  async run() {
    this.log('info', 'Setup starting', { platform: this.envInfo.platform, isColab: this.envInfo.isColab });

    if (this.envInfo.isColab) {
      await this.ensureColab();
    } else if (this.envInfo.isLinux) {
      await this.ensureLinuxDeps();
    }

    // Node + Python deps are needed everywhere
    await this.ensureNodeDeps();
    await this.ensurePythonDeps();
    await this.ensurePlaywrightBrowser();
    await this.ensureFfmpeg();

    // GPU setup if available
    if (this.envInfo.hasNvidia) {
      await this.ensureNvidiaEncoder();
    }

    this.log('info', 'Setup complete ✓');
    return { ok: true, env: this.envInfo };
  }

  /**
   * Colab-specific bootstrap. Installs:
   *   - apt: chromium, fonts, ffmpeg, nvidia-cuda-toolkit (if GPU runtime)
   *   - pip: numpy, scipy
   *   - npx: playwright + chromium binary
   */
  async ensureColab() {
    this.log('info', 'Colab detected — installing system packages (this takes ~3-5 min)');

    // Update + install Chromium + fonts + ffmpeg
    const aptPackages = [
      'chromium-browser',
      'fonts-noto-color-emoji',
      'fonts-noto-core',
      'fonts-noto-cjk',          // CJK fallback
      'fonts-noto-cjk-extra',
      'fonts-noto-ui-core',
      'fonts-dejavu-core',
      'fonts-liberation',
      'libnss3', 'libnspr4', 'libatk1.0-0', 'libatk-bridge2.0-0',
      'libcups2', 'libdrm2', 'libxkbcommon0', 'libxcomposite1',
      'libxdamage1', 'libxfixes3', 'libxrandr2', 'libgbm1',
      'libasound2', 'libatspi2.0-0', 'libpangocairo-1.0-0',
      'libpango-1.0-0', 'libcairo2', 'libgdk-pixbuf-2.0-0',
      'ffmpeg'
    ];

    this.log('info', 'apt-get update');
    await exec(['apt-get', 'update', '-qq'], { logger: this.logger, timeout: 120000 });

    this.log('info', 'apt-get install', { packages: aptPackages.length });
    await exec(['apt-get', 'install', '-y', '-qq', ...aptPackages], {
      logger: this.logger, timeout: 600000
    });

    // If GPU runtime, install NVENC-enabled ffmpeg + CUDA
    if (this.envInfo.hasNvidia) {
      this.log('info', 'NVIDIA GPU detected — installing CUDA + NVENC ffmpeg');
      try {
        await exec(['apt-get', 'install', '-y', '-qq', 'nvidia-cuda-toolkit'], {
          timeout: 600000
        });
      } catch (e) {
        this.log('warn', 'CUDA toolkit install failed (non-fatal, will use CPU encode)', {
          err: e.message
        });
      }
    }

    this.log('info', 'Colab system packages installed ✓');
  }

  /**
   * Local Linux — same as Colab but only installs what's missing.
   */
  async ensureLinuxDeps() {
    this.log('info', 'Linux detected — checking system packages');

    const required = ['chromium-browser', 'chromium', 'google-chrome'];
    let hasBrowser = false;
    for (const b of required) {
      if (await which(b)) { hasBrowser = true; this.log('debug', `Found ${b}`); break; }
    }
    if (!hasBrowser) {
      this.log('warn', 'No Chrome/Chromium found. Install via: sudo apt install chromium-browser');
    }

    if (!await which('ffmpeg')) {
      this.log('warn', 'ffmpeg not found. Install via: sudo apt install ffmpeg');
    }
  }

  /**
   * Install Node dependencies (playwright).
   */
  async ensureNodeDeps() {
    this.log('info', 'Checking Node dependencies');
    const nodeModules = path.join(this.projectRoot, 'node_modules');
    if (dirExists(nodeModules) && dirExists(path.join(nodeModules, 'playwright'))) {
      this.log('debug', 'Node deps already installed');
      return;
    }
    this.log('info', 'Running npm install');
    await exec(['npm', 'install', '--no-audit', '--no-fund'], {
      logger: this.logger, timeout: 300000,
      // npm install writes to stderr normally
      rejectOnNonZero: true
    });
    this.log('info', 'Node deps installed ✓');
  }

  /**
   * Install Python deps for music generation.
   */
  async ensurePythonDeps() {
    this.log('info', 'Checking Python dependencies');
    try {
      await exec(['python3', '-c', 'import numpy, scipy'], { rejectOnNonZero: true });
      this.log('debug', 'numpy + scipy already installed');
      return;
    } catch {
      // Need to install
    }
    this.log('info', 'Installing numpy + scipy via pip');
    try {
      await exec(['pip3', 'install', '-q', 'numpy', 'scipy'], {
        timeout: 300000
      });
      this.log('info', 'Python deps installed ✓');
    } catch (e) {
      this.log('warn', 'pip install failed — music generation will not work', { err: e.message });
    }
  }

  /**
   * Install Playwright's bundled Chromium (used as fallback if system Chrome missing).
   */
  async ensurePlaywrightBrowser() {
    this.log('info', 'Checking Playwright browser');
    const chromiumPath = env.findChromium();
    if (chromiumPath) {
      this.log('debug', 'Playwright Chromium found', { path: chromiumPath });
      return;
    }
    this.log('info', 'Installing Playwright Chromium binary (~150MB download)');
    try {
      await exec(['npx', 'playwright', 'install', 'chromium'], {
        logger: this.logger, timeout: 600000
      });
      await exec(['npx', 'playwright', 'install-deps', 'chromium'], {
        timeout: 600000
      });
      this.log('info', 'Playwright Chromium installed ✓');
    } catch (e) {
      this.log('error', 'Failed to install Playwright browser', { err: e.message });
      throw new DependencyError('Playwright browser install failed', { cause: e });
    }
  }

  /**
   * Verify ffmpeg is available.
   */
  async ensureFfmpeg() {
    if (await which('ffmpeg')) {
      const { stdout } = await exec(['ffmpeg', '-version']);
      this.log('debug', 'ffmpeg available', { version: stdout.split('\n')[0] });
      return;
    }
    throw new DependencyError('ffmpeg not found. Install via apt/brew/installer.');
  }

  /**
   * Detect + log NVENC availability for GPU encoding.
   */
  async ensureNvidiaEncoder() {
    this.log('info', 'NVIDIA GPU detected — checking NVENC');
    if (!await which('nvidia-smi')) {
      this.log('warn', 'nvidia-smi not found — GPU may not be usable');
      return;
    }
    try {
      const { stdout } = await exec(['nvidia-smi', '--query-gpu=name,driver_version', '--format=csv,noheader']);
      this.log('info', 'GPU info', { info: stdout.trim() });

      // Check ffmpeg has h264_nvenc
      const { stdout: encoders } = await exec(['ffmpeg', '-hide_banner', '-encoders']);
      if (encoders.includes('h264_nvenc')) {
        this.log('info', 'NVENC encoder available ✓');
      } else {
        this.log('warn', 'ffmpeg lacks h264_nvenc — install ffmpeg with NVENC support');
      }
    } catch (e) {
      this.log('warn', 'GPU check failed', { err: e.message });
    }
  }
}

module.exports = { Setup };
