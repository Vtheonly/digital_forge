/**
 * PlaywrightRenderer.js — Frame-by-frame renderer using Playwright/Chromium
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

    const scale = c.get("captureScale");
    const captureW = Math.round(c.get("width") * scale);
    const captureH = Math.round(c.get("height") * scale);
    const dsf = scale >= 1 ? scale : 1;

    this.logger.info("Booting Chromium", {
      viewport: `${captureW}x${captureH}`,
      deviceScaleFactor: dsf,
      useGpu: c.get("useGpu"),
      hasNvidia: envInfo.hasNvidia,
      isColab: envInfo.isColab,
    });

    if (c.get("useGpu")) {
      process.env.FORGE_USE_GPU = "1";
      this.logger.info("GPU mode enabled", {
        hasNvidia: envInfo.hasNvidia,
        note: envInfo.hasNvidia
          ? "Chrome will use ANGLE/Vulkan GPU rasterization (Chrome 131+ compatible)"
          : "No NVIDIA GPU detected — Chrome will fall back to software",
      });
    }

    let args = c.get("browserArgs");
    if (!args) {
      args = env.recommendedChromiumArgs();
    }

    let executablePath = c.get("executablePath");
    if (!executablePath) {
      executablePath = env.findChromium();
    }

    if (!executablePath) {
      this.logger.warn(
        "No Chromium found — auto-installing Playwright Chromium (~150MB download)",
      );
      const { exec } = require("../utils/exec");
      try {
        await exec(["npx", "playwright", "install", "chromium"], {
          logger: this.logger,
          timeout: 600000,
        });
        await exec(["npx", "playwright", "install-deps", "chromium"], {
          logger: this.logger,
          timeout: 600000,
        });
        executablePath = env.findChromium();
      } catch (installErr) {
        throw new RenderError(
          "Chromium not found and auto-install failed. Run `node bin/forge-setup` manually.",
          { cause: installErr },
        );
      }
      if (!executablePath) {
        throw new RenderError(
          "Chromium install appeared to succeed but binary still not found. Try: npx playwright install chromium",
        );
      }
      this.logger.info("Chromium auto-installed", { path: executablePath });
    }

    // Pre-emptively spin up Xvfb to bypass standard headless software fallbacks
    let xvfbDisplay = null;
    if (c.get("useGpu") && c.get("verifyGpu") && envInfo.isLinux) {
      const { XvfbFallback } = require("../utils/XvfbFallback");
      const xvfb = new XvfbFallback({ logger: this.logger });
      xvfbDisplay = await xvfb.start();
      if (xvfbDisplay) {
        this._xvfb = xvfb;
        this.logger.info(
          "Xvfb pre-emptively started for headed GPU execution",
          { display: xvfbDisplay },
        );
      }
    }

    const launchOpts = {
      // If Xvfb is running, strip headless flag so Chrome runs headed and inherits hardware acceleration
      args: xvfbDisplay
        ? args.filter((a) => !a.startsWith("--headless"))
        : args,
      headless: !xvfbDisplay,
      viewport: { width: captureW, height: captureH },
      deviceScaleFactor: dsf,
      executablePath,
      env: xvfbDisplay ? { ...process.env, DISPLAY: xvfbDisplay } : process.env,
    };

    this.logger.debug("Using Chromium binary", { path: executablePath });
    this.logger.debug("Chromium launch args", { args });

    try {
      this.browser = await chromium.launch(launchOpts);
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

        // Classic fallback chain (only used if pre-emptive display wasn't active)
        if (!this.gpuStatus.gpuActive && !xvfbDisplay) {
          this.logger.warn(
            "GPU was requested but Chrome is using CPU rasterization (SwiftShader). Will try Xvfb (headed) fallback...",
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
                  {
                    glRenderer: this.gpuStatus.glRenderer,
                  },
                );
              } else {
                this.logger.warn(
                  "Xvfb fallback did NOT activate GPU — continuing with SwiftShader",
                  {
                    glRenderer: this.gpuStatus.glRenderer,
                  },
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
          } else {
            this.logger.warn(
              "Xvfb not available — continuing with SwiftShader (CPU rasterization). Install Xvfb for GPU acceleration: apt install -y xvfb",
            );
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
      const { themeToCSS, themeToJS } = require("../core/Theme");
      const loader = new ThemeLoader(this.logger);
      const theme = loader.load(themeSource);
      const css = themeToCSS(theme);
      const js = themeToJS(theme);
      this.logger.info("Injecting theme", { name: theme.name });
      await this.page.addStyleTag({ content: css });
      await this.page.evaluate((themeObj) => {
        window.theme = themeObj;
      }, js);
    }

    await this.page.waitForFunction(
      () =>
        typeof window.renderAtTime === "function" &&
        typeof window.masterTL === "object",
      { timeout: 15000 },
    );

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
          width: ${c.get("width")}px !important;
          height: ${c.get("height")}px !important;
          transform: scale(${scale}) !important;
          transform-origin: top left !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          margin: 0 !important;
        }
      `,
    });

    if (process.env.FORGE_FAST_MODE !== "0") {
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

    await this.page.evaluate((tt) => window.renderAtTime(tt), sceneT);

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
