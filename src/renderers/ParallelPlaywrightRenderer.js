/**
 * ParallelPlaywrightRenderer.js — Spawns parallel worker processes to capture frames
 */

const { fork } = require("child_process");
const path = require("path");
const { Renderer } = require("../core/Renderer");
const { RenderError } = require("../utils/errors");
const { chromium } = require("playwright");
const env = require("../utils/environment");
const { fileExists, fileSize } = require("../utils/fs");

class ParallelPlaywrightRenderer extends Renderer {
  constructor(config, logger) {
    super(config, logger);
    this._duration = null;
  }

  /**
   * Probe scene duration using a single, lightweight browser instance before scaling
   */
  async _init() {
    const c = this.config;
    const htmlPath = path.resolve(c.get("htmlPath"));
    const executablePath = env.findChromium();
    const args = env.recommendedChromiumArgs();

    this.logger.debug(
      "Probing scene duration via temporary Chromium instance...",
    );
    let tempBrowser;
    try {
      tempBrowser = await chromium.launch({
        args,
        headless: true,
        executablePath,
      });
      const ctx = await tempBrowser.newContext();
      const page = await ctx.newPage();
      await page.goto("file://" + htmlPath, {
        waitUntil: "load",
        timeout: 30000,
      });

      await page.waitForFunction(
        () =>
          typeof window.masterTL === "object" &&
          typeof window.masterTL.duration === "function",
        { timeout: 15000 },
      );

      const nativeDuration = await page.evaluate(() =>
        window.masterTL.duration(),
      );
      const timeScale = c.get("timeScale");
      this._duration = nativeDuration / timeScale;

      this.logger.info("Scene duration probe complete", {
        native: nativeDuration.toFixed(2) + "s",
        timeScale,
        capture: this._duration.toFixed(2) + "s",
      });
    } catch (e) {
      throw new RenderError(`Failed to probe scene duration: ${e.message}`, {
        cause: e,
      });
    } finally {
      if (tempBrowser) {
        await tempBrowser.close();
      }
    }
  }

  async _getDuration() {
    return this._duration;
  }

  /**
   * Divide frames amongst configured workers and run them concurrently
   */
  async _renderFramesInRange(range, framesDir, options = {}) {
    const c = this.config;
    const numWorkers = c.get("workers");
    const startFrame = range.startFrame;
    const endFrame = range.endFrame;

    let indices = [];
    for (let i = startFrame; i < endFrame; i++) {
      indices.push(i);
    }

    const frameFormat = c.get("frameFormat");
    const ext = frameFormat === "jpeg" ? "jpg" : "png";

    let skipped = 0;
    if (c.get("resumeFromDisk")) {
      const filtered = [];
      for (const idx of indices) {
        const framePath = path.join(
          framesDir,
          `frame_${String(idx).padStart(5, "0")}.${ext}`,
        );
        if (fileExists(framePath) && fileSize(framePath) > 3000) {
          skipped++;
        } else {
          filtered.push(idx);
        }
      }
      indices = filtered;
    }

    if (indices.length === 0) {
      this.logger.info("All frames already exist on disk. Skipping capture.");
      return { captured: 0, skipped };
    }

    const chunks = Array.from({ length: numWorkers }, () => []);
    for (let i = 0; i < indices.length; i++) {
      chunks[i % numWorkers].push(indices[i]);
    }

    this.logger.info(`Spawning ${numWorkers} parallel render workers`, {
      totalFramesToRender: indices.length,
      skippedExisting: skipped,
    });

    const workerScript = path.resolve(__dirname, "_RenderWorker.js");

    const promises = chunks.map((chunk, workerIdx) => {
      if (chunk.length === 0) return Promise.resolve(0);

      return new Promise((resolve, reject) => {
        const args = [
          "--html-path",
          c.get("htmlPath"),
          "--frames-dir",
          framesDir,
          "--frame-indices",
          chunk.join(","),
          "--fps",
          String(c.get("fps")),
          "--width",
          String(c.get("width")),
          "--height",
          String(c.get("height")),
          "--capture-scale",
          String(c.get("captureScale")),
          "--frame-format",
          c.get("frameFormat"),
          "--jpeg-quality",
          String(c.get("jpegQuality")),
          "--use-gpu",
          c.get("useGpu") ? "1" : "0",
          "--verify-gpu",
          c.get("verifyGpu") ? "1" : "0",
          "--time-scale",
          String(c.get("timeScale")),
          "--worker-idx",
          String(workerIdx),
          "--log-level",
          c.get("logLevel"),
        ];

        if (c.get("theme")) {
          args.push("--theme", c.get("theme"));
        }
        if (c.get("executablePath")) {
          args.push("--executable-path", c.get("executablePath"));
        }
        if (c.get("browserArgs")) {
          args.push("--browser-args", JSON.stringify(c.get("browserArgs")));
        }

        const child = fork(workerScript, args, { silent: true });

        let workerCaptured = 0;
        const workerTotal = chunk.length;

        child.stdout.on("data", (data) => {
          const lines = data.toString().split("\n");
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              if (msg.type === "progress") {
                workerCaptured = msg.captured;
                if (options.onProgress) {
                  options.onProgress(workerCaptured, workerTotal, workerIdx);
                }
              } else if (msg.type === "log") {
                const level = msg.level || "info";
                this.logger[level](`[w${workerIdx}] ${msg.msg}`, msg.ctx);
              }
            } catch {
              this.logger.debug(`[w${workerIdx} stdout] ${line}`);
            }
          }
        });

        child.stderr.on("data", (data) => {
          this.logger.error(`[w${workerIdx} stderr] ${data.toString().trim()}`);
        });

        child.on("error", (err) => {
          reject(
            new RenderError(`Worker ${workerIdx} failed: ${err.message}`, {
              cause: err,
            }),
          );
        });

        child.on("exit", (code) => {
          if (code !== 0) {
            reject(
              new RenderError(`Worker ${workerIdx} exited with code ${code}`),
            );
          } else {
            resolve(workerCaptured);
          }
        });
      });
    });

    const results = await Promise.all(promises);
    const totalCaptured = results.reduce((sum, val) => sum + val, 0);

    return { captured: totalCaptured, skipped };
  }

  async _close() {
    // Parent maintains no long-lived browser resources
  }
}

module.exports = { ParallelPlaywrightRenderer };
