#!/usr/bin/env node
/**
 * _RenderWorker.js — Worker process for ParallelPlaywrightRenderer
 *
 * This is a standalone script that:
 *   1. Parses frame-range + config from process.argv
 *   2. Boots a PlaywrightRenderer instance
 *   3. Captures its assigned frames
 *   4. Emits JSON log lines on stdout (the parent reads these)
 *   5. Exits 0 on success, non-zero on failure
 *
 * Communication protocol (stdout):
 *   {"type":"log","level":"info","msg":"...","ctx":{...},"workerIdx":N}
 *   {"type":"progress","captured":N,"total":M,"workerIdx":N}
 *
 * The parent ParallelPlaywrightRenderer spawns one of these per CPU core,
 * giving each a non-overlapping chunk of frames to capture.
 *
 * This script is intentionally self-contained — it doesn't import anything
 * from the parent process state. All config comes via argv + env vars.
 */

const path = require('path');
const fs = require('fs');

// Parse argv
function parseArgs(argv) {
  const opts = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--html-path': opts.htmlPath = next(); break;
      case '--frames-dir': opts.framesDir = next(); break;
      case '--frame-indices': opts.frameIndices = next().split(',').map(Number); break;
      case '--fps': opts.fps = parseInt(next(), 10); break;
      case '--width': opts.width = parseInt(next(), 10); break;
      case '--height': opts.height = parseInt(next(), 10); break;
      case '--capture-scale': opts.captureScale = parseFloat(next()); break;
      case '--frame-format': opts.frameFormat = next(); break;
      case '--jpeg-quality': opts.jpegQuality = parseInt(next(), 10); break;
      case '--use-gpu': opts.useGpu = next() === '1'; break;
      case '--verify-gpu': opts.verifyGpu = next() === '1'; break;
      case '--time-scale': opts.timeScale = parseFloat(next()); break;
      case '--theme': opts.theme = next() || null; break;
      case '--executable-path': opts.executablePath = next() || null; break;
      case '--browser-args': {
        const raw = next();
        opts.browserArgs = raw ? JSON.parse(raw) : null;
        break;
      }
      case '--log-level': opts.logLevel = next(); break;
      case '--worker-idx': opts.workerIdx = parseInt(next(), 10); break;
    }
  }
  return opts;
}

// Stdout-only JSON logger (so parent can parse)
class WorkerLogger {
  constructor(level, workerIdx) {
    this.level = level || 'info';
    this.workerIdx = workerIdx;
    this.levels = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };
  }
  _shouldLog(l) { return (this.levels[l] || 0) >= (this.levels[this.level] || 0); }
  _emit(level, msg, ctx) {
    if (!this._shouldLog(level)) return;
    process.stdout.write(JSON.stringify({
      type: 'log', level, msg, ctx: ctx || {}, workerIdx: this.workerIdx
    }) + '\n');
  }
  debug(msg, ctx) { this._emit('debug', msg, ctx); }
  info(msg, ctx)  { this._emit('info', msg, ctx); }
  warn(msg, ctx)  { this._emit('warn', msg, ctx); }
  error(msg, ctx) { this._emit('error', msg, ctx); }
  fatal(msg, ctx) { this._emit('fatal', msg, ctx); }
  child() { return this; }
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.htmlPath || !opts.frameIndices || opts.frameIndices.length === 0) {
    console.error(JSON.stringify({ type: 'error', msg: 'Missing required args', opts }));
    process.exit(2);
  }

  const logger = new WorkerLogger(opts.logLevel, opts.workerIdx);
  logger.info('Worker starting', {
    workerIdx: opts.workerIdx,
    frames: opts.frameIndices.length,
    firstFrame: opts.frameIndices[0],
    lastFrame: opts.frameIndices[opts.frameIndices.length - 1],
    useGpu: opts.useGpu
  });

  // Build a Config for this worker
  const { Config } = require('../config/Config');
  const config = new Config({
    htmlPath: opts.htmlPath,
    framesDir: opts.framesDir,
    fps: opts.fps,
    width: opts.width,
    height: opts.height,
    captureScale: opts.captureScale,
    frameFormat: opts.frameFormat,
    jpegQuality: opts.jpegQuality,
    useGpu: opts.useGpu,
    verifyGpu: opts.verifyGpu,
    timeScale: opts.timeScale || 1.0,
    theme: opts.theme,
    executablePath: opts.executablePath,
    browserArgs: opts.browserArgs,
    logLevel: opts.logLevel,
    resumeFromDisk: false,  // parent already filtered; we capture everything we're told to
    cleanFramesAfterEncode: false
  });

  // Boot a single PlaywrightRenderer for this worker
  const { PlaywrightRenderer } = require('./PlaywrightRenderer');
  const renderer = new PlaywrightRenderer(config, logger);
  await renderer.init();

  // Capture frames
  const ext = opts.frameFormat === 'jpeg' ? 'jpg' : 'png';
  let captured = 0;
  const total = opts.frameIndices.length;
  const t0 = Date.now();

  try {
    for (let i = 0; i < opts.frameIndices.length; i++) {
      const frameIdx = opts.frameIndices[i];
      const ts = frameIdx / opts.fps;
      const framePath = path.join(opts.framesDir, `frame_${String(frameIdx).padStart(5, '0')}.${ext}`);

      await renderer.renderFrame(ts, framePath);
      captured++;

      // Emit progress every 5 frames or on last frame
      if (captured % 5 === 0 || i === opts.frameIndices.length - 1) {
        const elapsed = (Date.now() - t0) / 1000;
        const rate = captured / (elapsed || 1);
        process.stdout.write(JSON.stringify({
          type: 'progress',
          captured,
          total,
          rate: +rate.toFixed(2),
          workerIdx: opts.workerIdx,
          lastFrame: frameIdx
        }) + '\n');
      }
    }
  } finally {
    await renderer.close();
  }

  const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
  logger.info('Worker complete', {
    workerIdx: opts.workerIdx,
    captured,
    elapsedSec,
    rate: +(captured / (elapsedSec || 1)).toFixed(2)
  });

  process.exit(0);
}

main().catch(e => {
  process.stderr.write(`Worker fatal: ${e.message}\n${e.stack || ''}\n`);
  process.exit(1);
});
