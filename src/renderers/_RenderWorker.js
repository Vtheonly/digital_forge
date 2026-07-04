#!/usr/bin/env node

/**
 * _RenderWorker.js — Worker process for ParallelPlaywrightRenderer
 *
 * This script is executed as a child process. It parses command-line
 * arguments assigned to this worker, initializes a local PlaywrightRenderer
 * instance, captures its subset of frames, and reports progress/logs
 * back to the parent process using JSON-formatted standard output.
 */

const path = require("path");
const fs = require("fs");
const { Config } = require("../config/Config");
const { PlaywrightRenderer } = require("./PlaywrightRenderer");

class WorkerLogger {
  constructor(workerIdx) {
    this.workerIdx = workerIdx;
  }

  _log(level, msg, ctx = {}) {
    console.log(
      JSON.stringify({
        type: "log",
        level,
        msg,
        ctx,
      }),
    );
  }

  debug(msg, ctx) {
    this._log("debug", msg, ctx);
  }
  info(msg, ctx) {
    this._log("info", msg, ctx);
  }
  warn(msg, ctx) {
    this._log("warn", msg, ctx);
  }
  error(msg, ctx) {
    this._log("error", msg, ctx);
  }
  fatal(msg, ctx) {
    this._log("fatal", msg, ctx);
  }
  child() {
    return this;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i]
        .slice(2)
        .replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      const val = args[i + 1];
      if (val && !val.startsWith("--")) {
        options[key] = val;
        i++;
      } else {
        options[key] = true;
      }
    }
  }
  return options;
}

async function main() {
  const rawOpts = parseArgs();
  const workerIdx = parseInt(rawOpts.workerIdx || "0", 10);
  const logger = new WorkerLogger(workerIdx);

  try {
    // Map options to configuration properties
    const configOpts = {
      htmlPath: rawOpts.htmlPath,
      framesDir: rawOpts.framesDir,
      fps: parseInt(rawOpts.fps, 10),
      width: parseInt(rawOpts.width, 10),
      height: parseInt(rawOpts.height, 10),
      captureScale: parseFloat(rawOpts.captureScale),
      frameFormat: rawOpts.frameFormat,
      jpegQuality: parseInt(rawOpts.jpegQuality, 10),
      useGpu: rawOpts.useGpu === "1",
      verifyGpu: rawOpts.verifyGpu === "1",
      timeScale: parseFloat(rawOpts.timeScale),
      logLevel: rawOpts.logLevel || "info",
      workers: 1, // Execute sequentially within this child process
    };

    if (rawOpts.theme) {
      configOpts.theme = rawOpts.theme;
    }
    if (rawOpts.executablePath) {
      configOpts.executablePath = rawOpts.executablePath;
    }
    if (rawOpts.browserArgs) {
      try {
        configOpts.browserArgs = JSON.parse(rawOpts.browserArgs);
      } catch (e) {
        logger.warn("Failed to parse browserArgs JSON", { err: e.message });
      }
    }

    const config = new Config(configOpts);
    const renderer = new PlaywrightRenderer(config, logger);

    await renderer.init();

    const frameIndices = rawOpts.frameIndices
      ? rawOpts.frameIndices.split(",").map(Number)
      : [];

    const ext = configOpts.frameFormat === "jpeg" ? "jpg" : "png";
    let capturedCount = 0;

    for (const idx of frameIndices) {
      const framePath = path.join(
        configOpts.framesDir,
        `frame_${String(idx).padStart(5, "0")}.${ext}`,
      );
      const ts = idx / configOpts.fps;

      await renderer.renderFrame(ts, framePath);
      capturedCount++;

      // Send structured progress back to the parent process
      console.log(
        JSON.stringify({ type: "progress", captured: capturedCount }),
      );
    }

    await renderer.close();
    process.exit(0);
  } catch (err) {
    logger.error("Worker process failed during execution", {
      err: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

main();
