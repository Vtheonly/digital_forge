/**
 * PlaywrightRenderer.js — Frame-by-frame renderer using Playwright/Chromium (Optimized & Stabilized)
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { Renderer } = require("../core/Renderer");
const { RenderError } = require("../utils/errors");
const { ensureDir } = require("../utils/fs");
const env = require("../utils/environment");

class PlaywrightRenderer extends Renderer {
  constructor(config, logger) {
    super(config, logger);
    this.browser = null;
    this.ctx = null;
    this.page = null;
    this.cdp = null;
    this._duration = null;
    this._xvfb = null;
  }

  async _init() {
    const envInfo = env.detect();
    const c = this.config;

    // Viewport width and height pinned to integer values to prevent sub-pixel layout anomalies.
    // Programmatic downscaling / quality scaling is handled on the browser compositing layer using Playwright dsf.
    const scale = c.get("captureScale");
    const captureW = 1080;
    const captureH = 1920;
    const dsf = scale;

    this.logger.info("Booting Chromium", {
      viewport: `${captureW}x${captureH}`,
      deviceScaleFactor: dsf,
      useGpu: c.get("useGpu"),
      hasNvidia: envInfo.hasNvidia,
      isColab: envInfo.isColab,
    });

    if (c.get("useGpu")) {
      process.env.FORGE_USE_GPU = "1";
    }

    const args = env.recommendedChromiumArgs();
    const executablePath = env.findChromium();

    let browser;
    try {
      this.browser = await chromium.launch({
        args,
        headless: !this._xvfb,
        executablePath,
      });
    } catch (e) {
      if (e.message && e.message.includes("snap")) {
        throw new RenderError(
          "System chromium-browser is a snap stub (broken on Colab). Run `node bin/forge-setup` to install Playwright's real Chromium.",
          { cause: e },
        );
      }
      throw new RenderError(`Failed to launch Chromium: ${e.message}`, {
        cause: e,
      });
    }

    // Force context setup with correct scale factor variables
    this.ctx = await this.browser.newContext({
      viewport: { width: captureW, height: captureH },
      deviceScaleFactor: dsf,
    });

    await this.ctx.addInitScript(() => {
      window.renderMode = true;
      const _realNow = performance.now.bind(performance);
      let _frozen = true;
      performance.now = () => (_frozen ? 0 : _realNow());
      setTimeout(() => {
        _frozen = false;
      }, 1000);
    });

    this.page = await this.ctx.newPage();

    if (c.get("useGpu") && c.get("verifyGpu")) {
      const { verifyGpu } = require("../utils/GpuVerifier");
      try {
        this.gpuStatus = await verifyGpu(this.page, this.logger);

        // Fallback headed verification process
        if (!this.gpuStatus.gpuActive && !process.env.DISPLAY) {
          this.logger.warn(
            "GPU was requested but Chrome is using CPU rasterization (SwiftShader). Attempting virtual frame buffer launch fallback...",
            { glRenderer: this.gpuStatus.glRenderer },
          );

          const { XvfbFallback } = require("../utils/XvfbFallback");
          const xvfb = new XvfbFallback({ logger: this.logger });
          const display = await xvfb.start();
          if (display) {
            await this.browser.close();
            const headedArgs = args.filter(
              (a) => !a.startsWith("--headless") && a !== "--disable-gpu",
            );
            this.logger.info("Relaunching Chrome HEADED under Xvfb", {
              display,
              resolution: "1920x1080x24",
            });
            try {
              this.browser = await chromium.launch({
                args: headedArgs,
                headless: false,
                viewport: { width: captureW, height: captureH },
                deviceScaleFactor: dsf,
                executablePath,
                env: { ...process.env, DISPLAY: display },
              });
              this.ctx = await this.browser.newContext({
                viewport: { width: captureW, height: captureH },
                deviceScaleFactor: dsf,
              });
              await this.ctx.addInitScript(() => {
                window.renderMode = true;
                const _realNow = performance.now.bind(performance);
                let _frozen = true;
                performance.now = () => (_frozen ? 0 : _realNow());
                setTimeout(() => {
                  _frozen = false;
                }, 1000);
              });
              this.page = await this.ctx.newPage();
              this._xvfb = xvfb;

              this.gpuStatus = await verifyGpu(this.page, this.logger);
              if (this.gpuStatus.gpuActive) {
                this.logger.info(
                  "✓ Xvfb fallback successful — GPU is now active",
                  { glRenderer: this.gpuStatus.glRenderer },
                );
              } else {
                this.logger.warn(
                  "Xvfb fallback did NOT activate GPU — continuing with SwiftShader",
                  { glRenderer: this.gpuStatus.glRenderer },
                );
              }
            } catch (e) {
              this.logger.error("Xvfb relaunch failed", { err: e.message });
              this.browser = await chromium.launch(launchOpts);
              this.ctx = await this.browser.newContext({
                viewport: { width: captureW, height: captureH },
                deviceScaleFactor: dsf,
              });
              this.page = await this.ctx.newPage();
            }
          }
        }
      } catch (e) {
        this.logger.warn("GPU verification failed (non-fatal)", {
          err: e.message,
        });
      }
    }

    this.page.on("pageerror", (e) => {
      this.logger.error("Page JS error", { err: e.message });
    });
    this.page.on("console", (msg) => {
      if (msg.type() === "error") {
        this.logger.warn("Page console.error", {
          text: msg.text().slice(0, 200),
        });
      }
    });

    const htmlPath = path.resolve(c.get("htmlPath"));
    this.logger.info("Loading scene HTML", { path: htmlPath });
    await this.page.goto("file://" + htmlPath, {
      waitUntil: "load",
      timeout: 30000,
    });

    const themeSource = c.get("theme");
    if (themeSource) {
      const { ThemeLoader } = require("../core/ThemeLoader");
      const { Theme } = require("../core/Theme");
      const loader = new ThemeLoader(this.logger);
      const rawTheme = await loader.load(themeSource);
      const themeObj = new Theme(rawTheme, this.logger);

      await this.page.evaluate((vars) => {
        const root = document.documentElement;
        for (const [key, val] of Object.entries(vars)) {
          root.style.setProperty(key, val);
        }
      }, themeObj.toCssVars());
    }

    // Force consistent 1080x1920 styling
    await this.page.addStyleTag({
      content: `
        html, body, #viewport {
          margin: 0 !important;
          padding: 0 !important;
          width: 1080px !important;
          height: 1920px !important;
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
          width: 1080px !important;
          height: 1920px !important;
          transform: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          margin: 0 !important;
        }
      `,
    });

    // Disable CSS animations, CSS transitions, and layout filters to prevent timeline lag.
    // Preserves background visual meshes and film grain elements.
    if (process.env.FORGE_FAST_MODE !== "0") {
      await this.page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation: none !important;
            transition: none !important;
            transition-delay: 0s !important;
            transition-duration: 0s !important;
          }
          #bg-mesh, #bg-grid, #bg-rays, #grain {
            animation: none !important;
            transition: none !important;
          }
        `,
      });
    }

    await this.page.evaluate(() => document.fonts.ready);
    await this.page.evaluate((t) => window.renderAtTime(t), 0);
    await this.page.waitForTimeout(300);

    this.cdp = await this.ctx.newCDPSession(this.page);
  }

  async _getDuration() {
    if (this._duration !== null) return this._duration;
    const nativeDuration = await this.page.evaluate(() =>
      window.masterTL.duration(),
    );
    const timeScale = this.config.get("timeScale");
    this._duration = nativeDuration / timeScale;
    this.logger.info("Scene duration", {
      native: nativeDuration.toFixed(2) + "s",
      timeScale,
      capture: this._duration.toFixed(2) + "s",
    });
    return this._duration;
  }

  async _renderFrame(t, outPath) {
    ensureDir(path.dirname(outPath));
    const timeScale = this.config.get("timeScale");
    const sceneT = t * timeScale;

    // Recalculate styles and force browser layout synchronization
    await this.page.evaluate((tt) => {
      window.renderAtTime(tt);
      // Synchronous style recalculation forces Chrome to align GPU paints with manual seek styles
      return window.getComputedStyle(document.body).opacity;
    }, sceneT);

    const fmt = this.config.get("frameFormat");
    const cdpOpts = {
      captureBeyondViewport: false,
      fromSurface: true,
      optimizeForSpeed: true,
    };

    if (fmt === "jpeg") {
      cdpOpts.format = "jpeg";
      cdpOpts.quality = this.config.get("jpegQuality");
    } else {
      cdpOpts.format = "png";
    }

    const result = await this.cdp.send("Page.captureScreenshot", cdpOpts);
    const buf = Buffer.from(result.data, "base64");
    fs.writeFileSync(outPath, buf);
  }

  async _close() {
    if (this.cdp) {
      try {
        await this.cdp.detach();
      } catch {
        /* ignore */
      }
    }
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        /* ignore */
      }
    }
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        /* ignore */
      }
    }
    if (this._xvfb) {
      try {
        await this._xvfb.stop();
      } catch {
        /* ignore */
      }
      this._xvfb = null;
    }
  }
}

module.exports = { PlaywrightRenderer };
