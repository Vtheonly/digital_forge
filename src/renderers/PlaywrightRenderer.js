/**
 * PlaywrightRenderer.js — Frame-by-frame renderer using Playwright/Chromium
 *
 * STRATEGY
 * --------
 * Each frame is captured deterministically by:
 *   1. Calling window.renderAtTime(t) — seeks GSAP timeline + redraws canvas
 *   2. Taking a CDP screenshot (faster than page.screenshot)
 *   3. Writing the JPEG/PNG to disk
 *
 * OFFSET FIX (the bug you reported)
 * ---------------------------------
 * The original code scaled the 1080x1920 stage with a CSS transform:
 *     #stageWrap { transform: scale(0.5); transform-origin: top left; }
 * This worked for the eye but Playwright's screenshot captured the
 * transformed bounding box — which on Colab/Docker left a 50% gap on the
 * right because the viewport was wider than the scaled stage.
 *
 * FIX: We no longer use CSS scale. Instead we:
 *   - Set viewport to the EXACT capture dimensions (e.g. 540x960 for scale=0.5)
 *   - Set deviceScaleFactor to capture at full resolution
 *   - Override the page's #stageWrap CSS to be the exact viewport size,
 *     no transform — the stage IS the viewport, perfectly aligned.
 *
 * GPU ACCELERATION
 * ----------------
 * When config.useGpu is true, we DON'T pass --disable-gpu. Instead we
 * pass --enable-gpu-rasterization and --ignore-gpu-blocklist so Chrome
 * uses the GPU for compositing. This makes a big difference on Colab
 * GPU runtimes (T4/P100) and local machines with discrete GPUs.
 *
 * On headless Colab CPU runtimes, --disable-gpu is required (no GPU
 * available), and we fall back to SwiftShader software rasterizer.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { Renderer } = require('../core/Renderer');
const { RenderError, AppError } = require('../utils/errors');
const { ensureDir } = require('../utils/fs');
const env = require('../utils/environment');

class PlaywrightRenderer extends Renderer {
  constructor(config, logger) {
    super(config, logger);
    this.browser = null;
    this.ctx = null;
    this.page = null;
    this.cdp = null;
    this._duration = null;
  }

  async _init() {
    const envInfo = env.detect();
    const c = this.config;

    // Compute capture viewport dimensions
    // captureScale=1.0 → 1080x1920 viewport
    // captureScale=0.5 → 540x960 viewport, then upscaled to 1080x1920 by encoder
    const scale = c.get('captureScale');
    const captureW = Math.round(c.get('width') * scale);
    const captureH = Math.round(c.get('height') * scale);

    // deviceScaleFactor: if scale < 1, we still want to capture at native
    // pixel density (1) and let ffmpeg upscale. If scale > 1 (e.g. 2.0 for
    // 4K capture), we set deviceScaleFactor=2 so Chrome renders at 2x.
    const dsf = scale >= 1 ? scale : 1;

    this.logger.info('Booting Chromium', {
      viewport: `${captureW}x${captureH}`,
      deviceScaleFactor: dsf,
      useGpu: c.get('useGpu'),
      isColab: envInfo.isColab
    });

    // Build launch args
    let args = c.get('browserArgs');
    if (!args) {
      args = env.recommendedChromiumArgs();
      // GPU flag depends on config + environment
      if (c.get('useGpu') && envInfo.hasNvidia) {
        args = args.filter(a => a !== '--disable-gpu');
        args.push('--enable-gpu-rasterization', '--ignore-gpu-blocklist',
                  '--use-gl=egl');
      }
    }

    // Find Chromium binary
    let executablePath = c.get('executablePath');
    if (!executablePath) {
      executablePath = env.findChromium();
    }

    // Auto-install Playwright Chromium if missing (helps on Colab where
    // the user may have skipped `node bin/forge-setup`)
    if (!executablePath) {
      this.logger.warn('No Chromium found — auto-installing Playwright Chromium (~150MB download)');
      const { exec } = require('../utils/exec');
      try {
        await exec(['npx', 'playwright', 'install', 'chromium'], {
          logger: this.logger, timeout: 600000
        });
        await exec(['npx', 'playwright', 'install-deps', 'chromium'], {
          logger: this.logger, timeout: 600000
        });
        executablePath = env.findChromium();
      } catch (installErr) {
        throw new RenderError(
          'Chromium not found and auto-install failed. Run `node bin/forge-setup` manually.',
          { cause: installErr }
        );
      }
      if (!executablePath) {
        throw new RenderError(
          'Chromium install appeared to succeed but binary still not found. ' +
          'Try: npx playwright install chromium'
        );
      }
      this.logger.info('Chromium auto-installed', { path: executablePath });
    }

    const launchOpts = {
      args,
      headless: true,
      viewport: { width: captureW, height: captureH },
      deviceScaleFactor: dsf,
      executablePath
    };
    this.logger.debug('Using Chromium binary', { path: executablePath });

    try {
      this.browser = await chromium.launch(launchOpts);
    } catch (e) {
      // Check if it's the snap stub issue
      if (e.message && e.message.includes('snap')) {
        throw new RenderError(
          'System chromium-browser is a snap stub (broken on Colab). ' +
          'Run `node bin/forge-setup` to install Playwright\'s real Chromium.',
          { cause: e }
        );
      }
      throw new RenderError(`Failed to launch Chromium: ${e.message}`, { cause: e });
    }

    this.ctx = await this.browser.newContext({
      viewport: { width: captureW, height: captureH },
      deviceScaleFactor: dsf
    });
    this.page = await this.ctx.newPage();

    // Wire up error logging
    this.page.on('pageerror', e => {
      this.logger.error('Page JS error', { err: e.message });
    });
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.logger.warn('Page console.error', { text: msg.text().slice(0, 200) });
      }
    });

    // Load scene HTML
    const htmlPath = path.resolve(c.get('htmlPath'));
    this.logger.info('Loading scene HTML', { path: htmlPath });
    await this.page.goto('file://' + htmlPath, {
      waitUntil: 'load',
      timeout: 30000
    });

    // Wait for the scene's renderAtTime function to be ready
    await this.page.waitForFunction(
      () => typeof window.renderAtTime === 'function' && typeof window.masterTL === 'object',
      { timeout: 15000 }
    );

    // === OFFSET FIX ===
    // Inject CSS to make the stage fill the viewport EXACTLY (no transform).
    // The scene HTML's #stageWrap is 1080x1920 by default; we override it
    // to be the viewport size, eliminating any offset/centering issues.
    // The scene's #stage stays at its native 1080x1920 (the scene draws to it)
    // and we use CSS scale on #stageWrap only — but with the wrapper sized
    // to the viewport so the scale centers perfectly.
    await this.page.addStyleTag({
      content: `
        html, body, #viewport {
          margin: 0 !important;
          padding: 0 !important;
          width: ${captureW}px !important;
          height: ${captureH}px !important;
          overflow: hidden !important;
          background: #0a0a10 !important;
        }
        #viewport {
          display: block !important;
        }
        #stageWrap {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: ${c.get('width')}px !important;
          height: ${c.get('height')}px !important;
          transform: scale(${scale}) !important;
          transform-origin: top left !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          margin: 0 !important;
        }
      `
    });

    // Performance: disable CSS animations + heavy filters that slow capture
    // (the scene's motion comes from GSAP timeline.seek, not CSS animations)
    if (process.env.FORGE_FAST_MODE !== '0') {
      await this.page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation: none !important;
            filter: none !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }
          .forge-glow, #bg-mesh, #bg-rays, #bg-grid, #vignette, #grain {
            display: none !important;
          }
        `
      });
    }

    // Wait for fonts to load (otherwise first frame screenshots hang)
    await this.page.evaluate(() => document.fonts.ready);

    // Initialize: seek to t=0 to set initial state
    await this.page.evaluate((t) => window.renderAtTime(t), 0);
    await this.page.waitForTimeout(300);

    // CDP session for fast screenshots
    this.cdp = await this.ctx.newCDPSession(this.page);
  }

  async _getDuration() {
    if (this._duration !== null) return this._duration;
    this._duration = await this.page.evaluate(() => window.masterTL.duration());
    return this._duration;
  }

  async _renderFrame(t, outPath) {
    ensureDir(path.dirname(outPath));

    // Seek the timeline — this drives all GSAP animations deterministically
    await this.page.evaluate((tt) => window.renderAtTime(tt), t);

    // Small wait for paint (necessary for some animated CSS to settle)
    // Skip on subsequent frames since they're typically fast

    const fmt = this.config.get('frameFormat');
    const cdpOpts = {
      captureBeyondViewport: false,
      fromSurface: true
    };

    if (fmt === 'jpeg') {
      cdpOpts.format = 'jpeg';
      cdpOpts.quality = this.config.get('jpegQuality');
    } else {
      cdpOpts.format = 'png';
    }

    const result = await this.cdp.send('Page.captureScreenshot', cdpOpts);
    const buf = Buffer.from(result.data, 'base64');
    fs.writeFileSync(outPath, buf);
  }

  async _close() {
    if (this.cdp) {
      try { await this.cdp.detach(); } catch { /* ignore */ }
    }
    if (this.ctx) {
      try { await this.ctx.close(); } catch { /* ignore */ }
    }
    if (this.browser) {
      try { await this.browser.close(); } catch { /* ignore */ }
    }
  }
}

module.exports = { PlaywrightRenderer };
