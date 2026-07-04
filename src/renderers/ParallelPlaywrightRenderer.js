/**
 * ParallelPlaywrightRenderer.js — Multi-process sequential-block parallel frame capture
 */

const path = require("path");
const fs = require("fs");
const { fork } = require("child_process");
const { Renderer } = require("../core/Renderer");
const { RenderError } = require("../utils/errors");
const { ensureDir, fileExists, fileSize } = require("../utils/fs");
const env = require("../utils/environment");

class ParallelPlaywrightRenderer extends Renderer {
  constructor(config, logger) {
    super(config, logger);
    this.workers = [];
    this._duration = null;
    this._xvfbDisplay = null;
    this._xvfb = null;
  }

  async _init() {
    const c = this.config;
    const envInfo = env.detect();

    // Match worker count strictly to physical CPUs to prevent starvation
    let workerCount = c.get("workers");
    if (workerCount === 0 || workerCount > envInfo.cpus) {
      workerCount = Math.max(1, envInfo.cpus);
    }

    this.logger.info("ParallelPlaywrightRenderer sequential-block init", {
      workers: workerCount,
      cpus: envInfo.cpus,
      useGpu: c.get("useGpu"),
    });

    const htmlPath = path.resolve(c.get("htmlPath"));
    if (!fs.existsSync(htmlPath)) {
      throw new RenderError(`Scene HTML not found: ${htmlPath}`);
    }
    const framesDir = c.get("framesDir");
    ensureDir(framesDir);

    // Initialize display server exactly once at the master level
    if (c.get("useGpu") && c.get("verifyGpu") && envInfo.isLinux) {
      const { XvfbFallback } = require("../utils/XvfbFallback");
      const xvfb = new XvfbFallback({ logger: this.logger });
      this._xvfbDisplay = await xvfb.start();
      if (this._xvfbDisplay) {
        this._xvfb = xvfb;
        this.logger.info("Master Xvfb server initialized cleanly", {
          display: this._xvfbDisplay,
        });
      }
    }

    this._workerCount = workerCount;
  }

  async _getDuration() {
    if (this._duration !== null) return this._duration;

    const c = this.config;
    const htmlPath = path.resolve(c.get("htmlPath"));

    const { chromium } = require("playwright");
    let browser;
    try {
      const args = c.get("browserArgs") || env.recommendedChromiumArgs();
      const executablePath = c.get("executablePath") || env.findChromium();

      const launchOpts = {
        args: this._xvfbDisplay
          ? args.filter((a) => !a.startsWith("--headless"))
          : args,
        headless: !this._xvfbDisplay,
        executablePath,
        env: this._xvfbDisplay
          ? { ...process.env, DISPLAY: this._xvfbDisplay }
          : process.env,
      };

      browser = await chromium.launch(launchOpts);
      const page = await browser.newPage();
      await page.goto("file://" + htmlPath, {
        waitUntil: "load",
        timeout: 30000,
      });
      await page.waitForFunction(
        () =>
          typeof window.renderAtTime === "function" &&
          typeof window.masterTL === "object",
        { timeout: 15000 },
      );
      this._duration = await page.evaluate(() => window.masterTL.duration());
    } catch (e) {
      throw new RenderError(`Failed to probe scene duration: ${e.message}`, {
        cause: e,
      });
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
    return this._duration;
  }

  async _renderFrame(t, outPath) {
    await this._renderFramesInRange(
      [Math.round(t * this.config.get("fps"))],
      path.dirname(outPath),
    );
  }

  async _renderFramesInRange(range, framesDir, opts = {}) {
    let frameIndices;
    if (Array.isArray(range)) {
      frameIndices = range;
    } else {
      const { startFrame, endFrame } = range;
      frameIndices = [];
      for (let i = startFrame; i < endFrame; i++) frameIndices.push(i);
    }

    const c = this.config;
    const ext = c.get("frameFormat") === "jpeg" ? "jpg" : "png";
    const toCapture = [];
    let skipped = 0;

    if (c.get("resumeFromDisk")) {
      for (const i of frameIndices) {
        const fp = path.join(
          framesDir,
          `frame_${String(i).padStart(5, "0")}.${ext}`,
        );
        if (fileExists(fp) && fileSize(fp) > 3000) {
          skipped++;
        } else {
          toCapture.push(i);
        }
      }
    } else {
      toCapture.push(...frameIndices);
    }

    const total = frameIndices.length;
    if (toCapture.length === 0) {
      this.logger.info(
        "All frames already on disk — skipping capture entirely",
        { skipped, total },
      );
      return { captured: 0, skipped, total };
    }

    // Allocate sequential block chunks instead of interleaved lists
    const N = Math.min(this._workerCount, toCapture.length);
    const chunks = new Array(N).fill(null).map(() => []);
    const chunkSize = Math.ceil(toCapture.length / N);

    for (let w = 0; w < N; w++) {
      const start = w * chunkSize;
      const end = Math.min(start + chunkSize, toCapture.length);
      chunks[w] = toCapture.slice(start, end);
    }

    this.logger.info("Spawning parallel block-based workers", {
      workers: N,
      totalFrames: total,
      toCapture: toCapture.length,
      skipped,
      chunkSizes: chunks.map((c) => c.length),
    });

    const workerScript = path.join(__dirname, "_RenderWorker.js");
    const promises = chunks.map((chunk, idx) => {
      if (chunk.length === 0)
        return Promise.resolve({ captured: 0, workerIdx: idx });
      return this._runWorker(workerScript, idx, chunk, framesDir, opts);
    });

    let captured = 0;
    const results = await Promise.all(promises);
    for (const r of results) captured += r.captured;

    return { captured, skipped, total };
  }

  _runWorker(scriptPath, workerIdx, frameIndices, framesDir, opts = {}) {
    return new Promise((resolve, reject) => {
      const c = this.config;
      const workerEnv = { ...process.env };

      if (this._xvfbDisplay) {
        workerEnv.DISPLAY = this._xvfbDisplay;
      }

      const workerArgs = [
        scriptPath,
        "--html-path",
        path.resolve(c.get("htmlPath")),
        "--frames-dir",
        framesDir,
        "--frame-indices",
        frameIndices.join(","),
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
        "--theme",
        c.get("theme") || "",
        "--executable-path",
        c.get("executablePath") || "",
        "--browser-args",
        c.get("browserArgs") ? JSON.stringify(c.get("browserArgs")) : "",
        "--log-level",
        c.get("logLevel") || "info",
        "--worker-idx",
        String(workerIdx),
        "--display",
        this._xvfbDisplay || "",
      ];

      const proc = fork(scriptPath, workerArgs.slice(1), {
        env: workerEnv,
        stdio: ["pipe", "pipe", "pipe", "ipc"],
      });

      let captured = 0;
      let stderr = "";

      proc.stdout.on("data", (d) => {
        const lines = d.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const msg = JSON.parse(line);
            if (msg.type === "progress") {
              captured = msg.captured;
              opts.onProgress?.(msg.captured, msg.total, msg.workerIdx);
            } else if (msg.type === "log") {
              const fn = this.logger[msg.level] || this.logger.info;
              fn.call(this.logger, `[w${msg.workerIdx}] ${msg.msg}`, msg.ctx);
            }
          } catch {
            this.logger.debug?.(`[w${workerIdx}] ${line}`);
          }
        }
      });

      proc.stderr.on("data", (d) => {
        stderr += d.toString();
      });

      proc.on("error", (err) => {
        reject(
          new RenderError(`Worker ${workerIdx} crashed: ${err.message}`, {
            cause: err,
            stderr,
          }),
        );
      });

      proc.on("exit", (code) => {
        if (code !== 0) {
          reject(
            new RenderError(`Worker ${workerIdx} exited with code ${code}`, {
              stderr: stderr.slice(-2000),
            }),
          );
        } else {
          resolve({ captured, workerIdx });
        }
      });

      this.workers.push(proc);
    });
  }

  async _close() {
    for (const w of this.workers) {
      try {
        if (!w.killed) w.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    }
    this.workers = [];
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

module.exports = { ParallelPlaywrightRenderer };
