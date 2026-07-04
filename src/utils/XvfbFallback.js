/**
 * XvfbFallback.js — Run Chrome headed under Xvfb when headless GPU fails
 *
 * WHY THIS EXISTS
 * ---------------
 * On some Colab images (notably those with newer NVIDIA drivers like 580+),
 * Chrome's headless GPU pipeline doesn't engage even with the correct flags
 * (`--use-gl=angle --use-angle=vulkan --enable-features=Vulkan`).
 * chrome://gpu reports SwiftShader and GPU utilization stays at 0%.
 *
 * The most reliable GPU activation path on such systems is to run Chrome
 * HEADED (not headless) under a virtual display (Xvfb). This bypasses the
 * headless GPU factory entirely and uses Chrome's regular GPU pipeline,
 * which has better driver support.
 *
 * References:
 *   - https://blog.promaton.com/testing-3d-applications-with-playwright-on-gpu-1e9cfc8b54a9
 *   - https://davesnider.com/posts/gputests
 *
 * HOW IT WORKS
 * ------------
 *   1. Check if Xvfb is installed (apt install xvfb)
 *   2. If yes, start an Xvfb server on a free display (:99 by default)
 *    3. Set DISPLAY=:99 in the environment
 *    4. Launch Chrome in HEADED mode (headless: false) with GPU flags
 *    5. chrome://gpu now reports Hardware accelerated + GL_RENDERER = Tesla T4
 *
 * USAGE
 * -----
 *   const xvfb = new XvfbFallback({ logger });
 *   const display = await xvfb.start();    // returns ':99' or null
 *   // ... launch Chrome with headless: false, env: { DISPLAY: display, ... }
 *   await xvfb.stop();                      // kills Xvfb
 *
 * Or use the helper:
 *   const launchOpts = await xvfb.getLaunchOpts({ useGpu, headlessOpts });
 *   // launchOpts.headless = false if Xvfb is needed, true otherwise
 *   // launchOpts.env.DISPLAY = ':99' if Xvfb is needed
 */

const { exec, spawn } = require('child_process');
const fs = require('fs');

class XvfbFallback {
  constructor(opts = {}) {
    this.logger = opts.logger || console;
    this.display = opts.display || ':99';
    this.resolution = opts.resolution || '1920x1080x24';
    this._xvfbProc = null;
    this._enabled = false;
  }

  /**
   * Check if Xvfb is installed on the system.
   */
  static async isAvailable() {
    try {
      const { exec } = require('../utils/exec');
      await exec(['which', 'Xvfb'], { rejectOnNonZero: false });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Start an Xvfb server on the configured display.
   * Returns the display string (e.g. ':99') or null if Xvfb isn't available.
   */
  async start() {
    if (this._xvfbProc) return this.display;

    const available = await XvfbFallback.isAvailable();
    if (!available) {
      this.logger.warn?.('Xvfb not installed — cannot use headed GPU fallback. ' +
        'Install with: apt install -y xvfb');
      return null;
    }

    // Make sure the display isn't already in use
    const lockFile = `/tmp/.X${this.display.slice(1)}-lock`;
    if (fs.existsSync(lockFile)) {
      this.logger.debug?.(`Display ${this.display} already in use — assuming Xvfb is running`);
      this._enabled = true;
      return this.display;
    }

    return new Promise((resolve) => {
      const args = [
        this.display,
        '-screen', '0', this.resolution,
        '-ac',           // disable access control
        '-nolisten', 'tcp',
        '-nolisten', 'unix'
      ];
      this._xvfbProc = spawn('Xvfb', args, {
        stdio: 'ignore',
        detached: false
      });

      this._xvfbProc.on('error', err => {
        this.logger.warn?.('Xvfb failed to start', { err: err.message });
        this._xvfbProc = null;
        resolve(null);
      });

      // Give Xvfb a moment to initialize
      setTimeout(() => {
        if (this._xvfbProc && !this._xvfbProc.killed) {
          this._enabled = true;
          this.logger.info?.(`Xvfb started on display ${this.display}`, {
            resolution: this.resolution,
            pid: this._xvfbProc.pid
          });
          resolve(this.display);
        } else {
          resolve(null);
        }
      }, 1000);
    });
  }

  /**
   * Stop the Xvfb server.
   */
  async stop() {
    if (!this._xvfbProc) return;
    try {
      this._xvfbProc.kill('SIGTERM');
      this.logger.debug?.('Xvfb stopped');
    } catch { /* ignore */ }
    this._xvfbProc = null;
    this._enabled = false;
  }

  /**
   * Whether Xvfb is currently running.
   */
  get isEnabled() {
    return this._enabled;
  }

  /**
   * Get the environment variables needed to use Xvfb.
   * Returns { DISPLAY: ':99' } if enabled, empty object otherwise.
   */
  getEnv() {
    return this._enabled ? { DISPLAY: this.display } : {};
  }
}

module.exports = { XvfbFallback };
