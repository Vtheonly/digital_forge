/**
 * PlaywrightRenderer.js — Frame-by-frame renderer using Playwright/Chromium
 *
 * STABILITY OVERVIEW (read before editing):
 *
 *   This renderer captures frames DISCRETELY. It calls `window.renderAtTime(t)`
 *   which seeks the GSAP master timeline to a precise time, then takes a CDP
 *   screenshot. There is no real-time playback during capture.
 *
 *   That means ANY source of real-time advancement must be eliminated, or it
 *   will fight the manual seek positions and produce high-frequency jitter.
 *
 *   The following sources of wall-clock motion are neutralized below:
 *     1. `performance.now()`            — permanently frozen at 0
 *     2. `Date.now()`                   — permanently frozen at a fixed epoch
 *     3. `requestAnimationFrame()`      — replaced with a no-op that never fires
 *     4. `cancelAnimationFrame()`       — replaced with a no-op
 *     5. `gsap.ticker`                  — put to sleep + lagSmoothing(0)
 *     6. `gsap.globalTimeline`          — paused at 0 so stray play() is a no-op
 *     7. CSS `transition` / `animation` — killed via injected `!important` style tag
 *     8. `#stageWrap` `transform: scale(...)` — killed via injected `!important` style tag
 *
 *   Per-frame, before each screenshot we also force a synchronous layout flush
 *   via `getComputedStyle(...).opacity` + `offsetHeight` so the GPU compositor
 *   has caught up with the JS-driven style writes.
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

  /* ============================================================
     INIT SCRIPT — injected into every page before any scene JS runs.
     This is the SINGLE source of truth for clock/RAF freezing.
     ============================================================ */
  _clockFreezeInitScript() {
    return () => {
      window.renderMode = true;

      // 1. Freeze performance.now() PERMANENTLY at 0.
      //    (Previous implementation unfroze it after 1000ms — that race caused
      //    mid-render jitter if scene load took longer than 1s.)
      performance.now = () => 0;

      // 2. Freeze Date.now() too — some animation polyfills fall back to it.
      const FROZEN_EPOCH = 1700000000000;
      Date.now = () => FROZEN_EPOCH;

      // 3. Neutralize requestAnimationFrame so any RAF-based loop in the scene
      //    never advances state between Playwright's manual seek() calls.
      const NOOP = () => 0;
      window.requestAnimationFrame = NOOP;
      window.webkitRequestAnimationFrame = NOOP;
      window.mozRequestAnimationFrame = NOOP;
      window.cancelAnimationFrame = NOOP;
      window.webkitCancelAnimationFrame = NOOP;
      window.mozCancelAnimationFrame = NOOP;

      // 4. Neutralize setTimeout/setInterval for any short-tick scene loops.
      //    We do NOT touch them — Playwright/CDP itself relies on setTimeout for
      //    internal scheduling. The RAF kill above is sufficient for animation
      //    loops. (If a scene misbehaves, fix it in the scene file.)
    };
  }

  async _init() {
    const envInfo = env.detect();
    const c = this.config;

    // Viewport is pinned to native 1080x1920 with integer scale factor.
    // NEVER scale the viewport via CSS transforms — that produces sub-pixel
    // layout coords that Chrome's rasterizer snaps inconsistently between
    // frames, causing high-frequency shimmer during movement.
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

    await this.ctx.addInitScript(this._clockFreezeInitScript());

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
                executablePath,
                env: { ...process.env, DISPLAY: display },
              });
              this.ctx = await this.browser.newContext({
                viewport: { width: captureW, height: captureH },
                deviceScaleFactor: dsf,
              });
              await this.ctx.addInitScript(this._clockFreezeInitScript());
              this.page = await this.ctx.newPage();
              this._xvfb = xvfb;

              this.gpuStatus = await verifyGpu(this.page, this.logger);
              if (this.gpuStatus.gpuActive) {
                this.logger.info(
                  "Xvfb fallback successful — GPU is now active",
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
              this.browser = await chromium.launch({
                args,
                headless: true,
                executablePath,
              });
              this.ctx = await this.browser.newContext({
                viewport: { width: captureW, height: captureH },
                deviceScaleFactor: dsf,
              });
              await this.ctx.addInitScript(this._clockFreezeInitScript());
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

    // Pin #stageWrap and #viewport to native 1080x1920 with NO transform.
    // This is the renderer-side counterpart to the scene's fitStage() guard —
    // the scene disables its JS scaler in render mode, and we hard-pin here
    // with !important so any lingering inline style is overridden.
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

    // Kill all CSS transitions and CSS @keyframe animations.
    // Discrete seeking does NOT advance CSS transitions; if they were left
    // active, every captured frame would catch them at an arbitrary real-world
    // phase offset, producing ghosting / partial-paint jitter.
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

    // Wait for all webfonts to actually load before doing anything else.
    // Without this, the first ~10 frames can render with the fallback font
    // and then "snap" to the real font once it arrives — a very visible
    // layout shift.
    await this.page.evaluate(() => document.fonts.ready);

    // After fonts are loaded and the scene script has executed, put GSAP's
    // ticker to sleep and pause its global timeline. The scene file also
    // does this in its own `if (window.renderMode)` block, but we re-assert
    // here to be defensive against scene-load ordering quirks.
    await this.page.evaluate(() => {
      if (typeof window.gsap !== "undefined") {
        try {
          window.gsap.ticker.lagSmoothing(0);
          window.gsap.ticker.sleep();
          window.gsap.globalTimeline.pause();
        } catch (e) {
          /* ignore — scene may not have a global timeline yet */
        }
      }
    });

    // Prime the very first frame at t=0 and let the compositor settle.
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

    // Seek the timeline and force a SYNCHRONOUS layout + paint flush.
    //
    // Why the getComputedStyle + offsetHeight double-pump:
    //   - `getComputedStyle(elem).opacity` forces a STYLE recalc.
    //   - `document.body.offsetHeight` forces a LAYOUT recalc.
    //   - Together they guarantee the GPU compositor has a fully-resolved
    //     style tree to paint when the CDP screenshot lands on the next tick.
    //
    // Without this, Chrome may capture the screenshot before the paint thread
    // has caught up with the seek() writes — producing partially-painted
    // frames that look like stutter.
    await this.page.evaluate((tt) => {
      window.renderAtTime(tt);

      // Style recalc
      window.getComputedStyle(document.body).opacity;
      // Layout recalc
      // eslint-disable-next-line no-unused-expressions
      document.body.offsetHeight;
      // Force the document element to flush too
      // eslint-disable-next-line no-unused-expressions
      document.documentElement.offsetHeight;

      return true;
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
