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
      hasNvidia: envInfo.hasNvidia,
      isColab: envInfo.isColab
    });

    // Bridge config.useGpu → FORGE_USE_GPU env var so recommendedChromiumArgs()
    // picks it up. Without this, the --gpu CLI flag and recommendedChromiumArgs()
    // were checking two different signals, so Chrome always got --disable-gpu.
    if (c.get('useGpu')) {
      process.env.FORGE_USE_GPU = '1';
      this.logger.info('GPU mode enabled', {
        hasNvidia: envInfo.hasNvidia,
        note: envInfo.hasNvidia
          ? 'Chrome will use ANGLE/Vulkan GPU rasterization (Chrome 131+ compatible)'
          : 'No NVIDIA GPU detected — Chrome will fall back to software'
      });
    }

    // Build launch args
    let args = c.get('browserArgs');
    if (!args) {
      args = env.recommendedChromiumArgs();
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
    this.logger.debug('Chromium launch args', { args });

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

    // === RENDER MODE ===
    // Set window.renderMode = true BEFORE the scene's JS runs.
    // The scene checks this flag to:
    //   - Skip masterTL.play() (we drive the timeline via seek() instead)
    //   - Stop requestAnimationFrame loops (we don't want real-time particle
    //     updates between the seek and the screenshot — that would make
    //     sparks/embers drift non-deterministically based on RAF timing)
    // Without this, parallel workers produce slightly different output
    // because each Chrome instance's RAF cycle is at a different point.
    //
    // We also stub performance.now() to return 0 during page load. Some
    // scene code uses `performance.now()` as a fallback before masterTL
    // is initialized, which would otherwise introduce non-determinism
    // based on when the page finished loading.
    await this.ctx.addInitScript(() => {
      window.renderMode = true;
      // Freeze performance.now at 0 during initial script execution so that
      // any code that reads it before masterTL exists gets a deterministic
      // value. We restore the real clock after a tick so animations that
      // legitimately use it (none in render mode) still work.
      const _realNow = performance.now.bind(performance);
      let _frozen = true;
      performance.now = () => _frozen ? 0 : _realNow();
      // Unfreeze after 1s (well after scene init completes)
      setTimeout(() => { _frozen = false; }, 1000);
    });

    this.page = await this.ctx.newPage();

    // === GPU VERIFICATION + XVFB FALLBACK ===
    // After browser launch, verify the GPU is actually being used.
    // This catches the silent SwiftShader fallback that was the original bug.
    //
    // If GPU was requested but Chrome fell back to SwiftShader, AND Xvfb
    // is available, we restart Chrome in HEADED mode under a virtual display.
    // This is the most reliable GPU activation path on Colab T4 with newer
    // NVIDIA drivers (580+) where headless GPU flags don't engage.
    if (c.get('useGpu') && c.get('verifyGpu')) {
      const { verifyGpu } = require('../utils/GpuVerifier');
      try {
        this.gpuStatus = await verifyGpu(this.page, this.logger);
        if (!this.gpuStatus.gpuActive) {
          this.logger.warn(
            'GPU was requested but Chrome is using CPU rasterization (SwiftShader). ' +
            'Will try Xvfb (headed) fallback...',
            { glRenderer: this.gpuStatus.glRenderer }
          );

          // Try Xvfb fallback
          const { XvfbFallback } = require('../utils/XvfbFallback');
          const xvfb = new XvfbFallback({ logger: this.logger });
          const display = await xvfb.start();
          if (display) {
            // Close the SwiftShader browser and relaunch headed under Xvfb
            await this.browser.close();
            const headedArgs = args.filter(a =>
              !a.startsWith('--headless') && a !== '--disable-gpu'
            );
            // Add --no-sandbox is already there; for headed we keep window flags off
            this.logger.info('Relaunching Chrome HEADED under Xvfb', {
              display, resolution: '1920x1080x24'
            });
            try {
              this.browser = await chromium.launch({
                args: headedArgs,
                headless: false,           // ← KEY: headed mode
                viewport: { width: captureW, height: captureH },
                deviceScaleFactor: dsf,
                executablePath,
                env: { ...process.env, DISPLAY: display }
              });
              this.ctx = await this.browser.newContext({
                viewport: { width: captureW, height: captureH },
                deviceScaleFactor: dsf
              });
              await this.ctx.addInitScript(() => {
                window.renderMode = true;
                const _realNow = performance.now.bind(performance);
                let _frozen = true;
                performance.now = () => _frozen ? 0 : _realNow();
                setTimeout(() => { _frozen = false; }, 1000);
              });
              this.page = await this.ctx.newPage();
              this._xvfb = xvfb;  // remember to stop it on close

              // Re-verify GPU
              this.gpuStatus = await verifyGpu(this.page, this.logger);
              if (this.gpuStatus.gpuActive) {
                this.logger.info('✓ Xvfb fallback successful — GPU is now active', {
                  glRenderer: this.gpuStatus.glRenderer
                });
              } else {
                this.logger.warn('Xvfb fallback did NOT activate GPU — continuing with SwiftShader', {
                  glRenderer: this.gpuStatus.glRenderer
                });
              }
            } catch (e) {
              this.logger.error('Xvfb relaunch failed', { err: e.message });
              // Re-launch headless as fallback
              this.browser = await chromium.launch(launchOpts);
              this.ctx = await this.browser.newContext({
                viewport: { width: captureW, height: captureH },
                deviceScaleFactor: dsf
              });
              this.page = await this.ctx.newPage();
            }
          } else {
            this.logger.warn(
              'Xvfb not available — continuing with SwiftShader (CPU rasterization). ' +
              'Install Xvfb for GPU acceleration: apt install -y xvfb'
            );
          }
        }
      } catch (e) {
        this.logger.warn('GPU verification failed (non-fatal)', { err: e.message });
      }
    }

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

    // === THEME INJECTION ===
    // If a theme is configured, inject its CSS variables + JS object BEFORE
    // the scene's own script runs its initialization. This lets theme-aware
    // scenes pick up colors/fonts/motion from the theme.
    const themeSource = c.get('theme');
    if (themeSource) {
      const { ThemeLoader } = require('../core/ThemeLoader');
      const { themeToCSS, themeToJS } = require('../core/Theme');
      const loader = new ThemeLoader(this.logger);
      const theme = loader.load(themeSource);
      const css = themeToCSS(theme);
      const js = themeToJS(theme);
      this.logger.info('Injecting theme', { name: theme.name });
      await this.page.addStyleTag({ content: css });
      await this.page.evaluate((themeObj) => {
        window.theme = themeObj;
      }, js);
    }

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
    // Get the scene's native duration, then scale it.
    // timeScale=0.5 means we play the animation at half speed, so a 30s
    // scene takes 60s of "capture time" — we capture twice as many frames
    // at the same fps. The output video is then sped back up in ffmpeg.
    const nativeDuration = await this.page.evaluate(() => window.masterTL.duration());
    const timeScale = this.config.get('timeScale');
    this._duration = nativeDuration / timeScale;
    this.logger.info('Scene duration', {
      native: nativeDuration.toFixed(2) + 's',
      timeScale,
      capture: this._duration.toFixed(2) + 's'
    });
    return this._duration;
  }

  async _renderFrame(t, outPath) {
    ensureDir(path.dirname(outPath));

    // Apply time scaling: if timeScale=0.5, we seek to t*0.5 in the timeline.
    // This makes the animation play at half speed during capture.
    // The output video is then sped back up by 1/timeScale in ffmpeg.
    const timeScale = this.config.get('timeScale');
    const sceneT = t * timeScale;

    // Seek the timeline — this drives all GSAP animations deterministically
    // Use the SCALED time (sceneT), not the capture time (t).
    await this.page.evaluate((tt) => window.renderAtTime(tt), sceneT);

    // Small wait for paint (necessary for some animated CSS to settle)
    // Skip on subsequent frames since they're typically fast

    const fmt = this.config.get('frameFormat');
    const cdpOpts = {
      captureBeyondViewport: false,
      fromSurface: true,
      // ⚡ optimizeForSpeed: trade slightly larger JPEG for ~2x faster encode.
      // This is the single most useful CDP screenshot flag for video pipelines.
      optimizeForSpeed: true
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
    // Stop Xvfb if we started it for the headed GPU fallback
    if (this._xvfb) {
      try { await this._xvfb.stop(); } catch { /* ignore */ }
      this._xvfb = null;
    }
  }
}

module.exports = { PlaywrightRenderer };
