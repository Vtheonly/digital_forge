/**
 * Pipeline.js — Orchestrates the full render + encode flow
 *
 * This is the brain of the project. Given a Config, it:
 *   1. Sets up the renderer (browser, page, scene)
 *   2. Captures all frames (with resume support)
 *   3. Encodes the final MP4 (with audio)
 *   4. Cleans up intermediate frames
 *   5. Reports stats (total time, fps, file size)
 *
 * Each phase is its own method so it can be called independently —
 * e.g. you can re-encode existing frames without re-capturing them.
 *
 * ERROR HANDLING
 * --------------
 * Every phase is wrapped in try/finally so the browser always gets closed.
 * Failures throw AppError subclasses with full context for debugging.
 *
 * RESUME SUPPORT
 * --------------
 * If config.resumeFromDisk is true (default), frames already on disk are
 * skipped. This lets you split a long render across multiple runs.
 */

const fs = require("fs");
const path = require("path");
const { Logger } = require("./Logger");
const { Config } = require("../config/Config");
const { createRenderer } = require("./rendererFactory");
const { createEncoder } = require("./encoderFactory");
const { AppError, RenderError, EncodeError } = require("../utils/errors");
const {
  ensureDir,
  cleanDir,
  listFiles,
  fileExists,
  fileSize,
  humanSize,
  rmrf,
} = require("../utils/fs");
const { GpuMonitor } = require("../utils/GpuMonitor");

class Pipeline {
  constructor(config, logger) {
    if (!(config instanceof Config)) {
      throw new AppError("Pipeline requires a Config instance");
    }
    this.config = config;
    this.logger = logger || new Logger({ level: config.get("logLevel") });
    this.renderer = null;
    this.encoder = null;
    this.gpuMonitor = null;
    this.stats = {
      captureStartedAt: null,
      captureEndedAt: null,
      encodeStartedAt: null,
      encodeEndedAt: null,
      framesCaptured: 0,
      framesSkipped: 0,
      finalSizeBytes: 0,
      gpuStats: null,
    };
  }

  /**
   * Run the full pipeline: setup → capture → encode → cleanup.
   */

  /**
   * Run the full pipeline: setup → capture → encode → cleanup.
   */
  async run() {
    const summary = this.config.summary();
    this.logger.info("Pipeline starting", summary);

    // Auto-generate music dynamically if required or missing from workspace
    if (this.config.get("generateMusic")) {
      const genPath = this.config.get("musicPath");
      if (!fs.existsSync(genPath)) {
        this.logger.info(
          "Auto-generating custom music track (no static music file detected)...",
        );
        ensureDir(path.dirname(genPath));
        const { MusicGenerator } = require("../audio/MusicGenerator");
        const generator = new MusicGenerator(this.logger);
        await generator.generate({
          outputPath: genPath,
          bpm: 128,
          bars: 17,
        });
      } else {
        this.logger.debug("Auto-generated music track already exists", {
          path: genPath,
        });
      }
    }

    // Start GPU monitor if enabled
    if (this.config.get("gpuMonitor")) {
      this.gpuMonitor = new GpuMonitor({
        intervalMs: this.config.get("gpuMonitorIntervalMs"),
        logger: this.logger,
      });
      await this.gpuMonitor.start();
    }

    try {
      await this.capture();
      this.gpuMonitor?.markPhase("encode");
      await this.encode();
      if (this.config.get("cleanFramesAfterEncode")) {
        this.cleanup();
      }

      // Stop GPU monitor and attach stats
      if (this.gpuMonitor) {
        this.stats.gpuStats = await this.gpuMonitor.stop();
        this._logGpuStats();
      }

      this.logger.info("Pipeline complete ✓", this._finalStats());
      return this.stats;
    } catch (e) {
      if (this.gpuMonitor) {
        this.stats.gpuStats = await this.gpuMonitor.stop().catch(() => null);
      }
      this.logger.error("Pipeline failed", {
        err: e.message,
        code: e.code,
        context: e.context,
      });
      throw e;
    }
}

  /**
   * Log a one-line summary of GPU utilization per phase.
   * This is the single most useful diagnostic for confirming the fix:
   *   "GPU avg 18% (peak 42%) during capture, avg 87% (peak 95%) during encode"
   * Before the fix, capture would show ~0% (CPU was doing all the work).
   */
  _logGpuStats() {
    const s = this.stats.gpuStats;
    if (!s || !s.active) {
      this.logger.info("GPU monitor inactive (no nvidia-smi available)", {});
      return;
    }
    const cap = s.byPhase.capture;
    const enc = s.byPhase.encode;
    if (cap) {
      this.logger.info("GPU utilization during CAPTURE", {
        avg: cap.gpuUtilAvg + "%",
        peak: cap.gpuUtilPeak + "%",
        memPeakMib: cap.memPeakMib,
        powerPeakW: cap.powerPeakW,
        samples: cap.count,
        verdict:
          cap.gpuUtilAvg < 5
            ? "⚠️  GPU idle during capture — Chrome fell back to SwiftShader (CPU). Run forge-gpu-check to debug."
            : "✓ GPU active during capture",
      });
    }
    if (enc) {
      this.logger.info("GPU utilization during ENCODE", {
        avg: enc.gpuUtilAvg + "%",
        peak: enc.gpuUtilPeak + "%",
        memPeakMib: enc.memPeakMib,
        samples: enc.count,
      });
    }
  }

  /**
   * PHASE 1: Capture frames from the scene HTML.
   *
   * Two code paths:
   *   - Serial renderer (PlaywrightRenderer): captures one frame at a time
   *     in this process — the original behavior.
   *   - Parallel renderer (ParallelPlaywrightRenderer): exposes a
   *     `_renderFramesInRange()` method that spawns N child Chrome
   *     processes, each capturing a non-overlapping chunk of frames.
   */
  async capture() {
    this.stats.captureStartedAt = Date.now();
    this.logger.info("=== CAPTURE PHASE ===");

    const framesDir = this.config.get("framesDir");
    const frameFormat = this.config.get("frameFormat");
    const ext = frameFormat === "jpeg" ? "jpg" : "png";

    ensureDir(framesDir);

    // Create renderer + init
    this.renderer = createRenderer(this.config, this.logger);
    await this.renderer.init();

    // Get scene duration
    const duration = await this.renderer.getDuration();
    const fps = this.config.get("fps");
    const totalFrames = Math.ceil(duration * fps);

    // Apply start/max bounds
    const startFrame = this.config.get("startFrame");
    const maxFrames = this.config.get("maxFrames");
    const endFrame = Math.min(startFrame + maxFrames, totalFrames);

    this.logger.info("Capture plan", {
      duration: duration.toFixed(2) + "s",
      totalFrames,
      willCapture: endFrame - startFrame,
      range: `${startFrame}..${endFrame - 1}`,
      resumeFromDisk: this.config.get("resumeFromDisk"),
      renderer: this.renderer.constructor.name,
    });

    let captured = 0;
    let skipped = 0;
    try {
      // Detect parallel renderer (duck-typing: it has _renderFramesInRange)
      if (typeof this.renderer._renderFramesInRange === "function") {
        const result = await this.renderer._renderFramesInRange(
          { startFrame, endFrame },
          framesDir,
          {
            onProgress: (cap, tot, workerIdx) => {
              this.logger.info("Parallel capture progress", {
                worker: workerIdx,
                captured: cap,
                total: tot,
              });
            },
          },
        );
        captured = result.captured;
        skipped = result.skipped;
      } else {
        // Original serial path
        const t0 = Date.now();
        for (let i = startFrame; i < endFrame; i++) {
          const framePath = path.join(
            framesDir,
            `frame_${String(i).padStart(5, "0")}.${ext}`,
          );

          // Resume support: skip if already on disk
          if (
            this.config.get("resumeFromDisk") &&
            fileExists(framePath) &&
            fileSize(framePath) > 3000
          ) {
            skipped++;
            continue;
          }

          const ts = i / fps;
          const result = await this.renderer.renderFrame(ts, framePath);
          captured++;

          // Progress log every 10 frames or on last frame
          if (captured % 10 === 0 || i === endFrame - 1) {
            const elapsed = (Date.now() - t0) / 1000;
            const rate = captured / (elapsed || 1);
            const eta = (endFrame - i - 1) / (rate || 1);
            this.logger.info("Capture progress", {
              frame: `${i + 1}/${totalFrames}`,
              time: ts.toFixed(2) + "s",
              rate: rate.toFixed(2) + " fps",
              eta: eta.toFixed(0) + "s",
              captured,
              skipped,
            });
          }
        }
      }

      this.stats.framesCaptured = captured;
      this.stats.framesSkipped = skipped;
      this.stats.captureEndedAt = Date.now();

      const totalOnDisk = listFiles(framesDir, (f) =>
        f.endsWith("." + ext),
      ).length;
      this.logger.info("Capture phase complete", {
        captured,
        skipped,
        totalOnDisk,
        totalFrames,
        elapsedSec: (
          (this.stats.captureEndedAt - this.stats.captureStartedAt) /
          1000
        ).toFixed(1),
      });
    } finally {
      await this.renderer.close();
    }
  }

  /**
   * PHASE 2: Encode captured frames into a final MP4.
   */
  async encode() {
    this.stats.encodeStartedAt = Date.now();
    this.logger.info("=== ENCODE PHASE ===");

    const framesDir = this.config.get("framesDir");
    const frameFormat = this.config.get("frameFormat");
    const ext = frameFormat === "jpeg" ? "jpg" : "png";
    const frameCount = listFiles(framesDir, (f) =>
      f.endsWith("." + ext),
    ).length;

    if (frameCount === 0) {
      throw new EncodeError("No frames to encode", { framesDir });
    }

    const audioPath = this.config.get("musicPath");
    const outputPath =
      this.config.get("outputPath") ||
      path.join(this.config.get("outputDir"), "output.mp4");

    ensureDir(path.dirname(outputPath));

    this.encoder = createEncoder(this.config, this.logger);
    const result = await this.encoder.encode({
      framesDir,
      outputPath,
      frameCount,
      audioPath,
    });

    this.stats.finalSizeBytes = result.sizeBytes;
    this.stats.encodeEndedAt = Date.now();

    this.logger.info("Encode phase complete", {
      outputPath,
      size: humanSize(result.sizeBytes),
      elapsedSec: result.durationSec.toFixed(1),
    });

    return result;
  }

  /**
   * PHASE 3: Remove intermediate frames.
   */
  cleanup() {
    this.logger.info("=== CLEANUP PHASE ===");
    const framesDir = this.config.get("framesDir");
    if (fs.existsSync(framesDir)) {
      rmrf(framesDir);
      this.logger.info("Removed frames dir", { dir: framesDir });
    }
  }

  _finalStats() {
    const totalMs =
      (this.stats.encodeEndedAt || Date.now()) - this.stats.captureStartedAt;
    const captureMs =
      (this.stats.captureEndedAt || 0) - (this.stats.captureStartedAt || 0);
    const encodeMs =
      (this.stats.encodeEndedAt || 0) - (this.stats.encodeStartedAt || 0);
    const out = {
      totalTime: (totalMs / 1000).toFixed(1) + "s",
      captureTime: (captureMs / 1000).toFixed(1) + "s",
      encodeTime: (encodeMs / 1000).toFixed(1) + "s",
      framesCaptured: this.stats.framesCaptured,
      framesSkipped: this.stats.framesSkipped,
      finalSize: humanSize(this.stats.finalSizeBytes),
      captureRate:
        this.stats.framesCaptured > 0
          ? (this.stats.framesCaptured / (captureMs / 1000 || 1)).toFixed(2) +
            " fps"
          : "0 fps",
    };
    if (this.stats.gpuStats && this.stats.gpuStats.active) {
      const cap = this.stats.gpuStats.byPhase.capture || {};
      const enc = this.stats.gpuStats.byPhase.encode || {};
      out.gpuCaptureAvg = (cap.gpuUtilAvg || 0) + "%";
      out.gpuCapturePeak = (cap.gpuUtilPeak || 0) + "%";
      out.gpuEncodeAvg = (enc.gpuUtilAvg || 0) + "%";
      out.gpuEncodePeak = (enc.gpuUtilPeak || 0) + "%";
    }
    return out;
  }
}

module.exports = { Pipeline };
