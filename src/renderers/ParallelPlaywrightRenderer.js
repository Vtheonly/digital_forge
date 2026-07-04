/**
 * ParallelPlaywrightRenderer.js — Multi-process parallel frame capture
 *
 * WHY THIS EXISTS
 * ---------------
 * The original PlaywrightRenderer captures frames serially: one Chrome
 * instance, one frame at a time. On Colab T4 this maxes out at ~2-4 fps
 * because the bottleneck is CDP screenshot readback + JPEG encode + disk
 * write — none of which Chrome parallelizes internally.
 *
 * This renderer spawns N independent Chrome processes (Node child_process
 * via the PlaywrightRenderer), each capturing a non-overlapping range of
 * frames. Each process runs on its own CPU core, so the aggregate capture
 * rate becomes ~N × single-process-rate.
 *
 * WHY THIS IS SAFE
 * ----------------
 * Frame capture is deterministic via window.renderAtTime(t) — there is no
 * shared state between frames. So rendering frame 42 in process A and
 * frame 43 in process B produces bit-identical output to rendering them
 * sequentially in one process. The frames are written to disk with their
 * original index (frame_00042.jpg, frame_00043.jpg, ...) so the encoder
 * reads them in the correct order regardless of which worker captured
 * which one.
 *
 * ARCHITECTURE
 * ------------
 *   ┌─────────────────────────────────────────────┐
 *   │  ParallelPlaywrightRenderer (orchestrator)  │
 *   │  - splits frame range into N chunks         │
 *   │  - spawns N WorkerHost child processes      │
 *   │  - aggregates progress + handles resume     │
 *   └─────────────────────────────────────────────┘
 *                │
 *        ┌───────┼───────┐
 *        ▼       ▼       ▼
 *     ┌─────┐ ┌─────┐ ┌─────┐
 *     │ W1  │ │ W2  │ │ W3  │   each = own Chrome
 *     │0-99 │ │100-199│ │200-│
 *     └─────┘ └─────┘ └─────┘
 *
 * The orchestrator shares the scene HTML path, capture config, and GPU
 * flags with all workers via process.argv. Each worker is a thin wrapper
 * around PlaywrightRenderer that processes its assigned frame range.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { fork } = require('child_process');
const { Renderer } = require('../core/Renderer');
const { RenderError, AppError } = require('../utils/errors');
const { ensureDir, fileExists, fileSize, listFiles } = require('../utils/fs');
const env = require('../utils/environment');

class ParallelPlaywrightRenderer extends Renderer {
  constructor(config, logger) {
    super(config, logger);
    this.workers = [];
    this._duration = null;
    this.gpuStatus = null;
  }

  async _init() {
    const c = this.config;
    const envInfo = env.detect();

    // Resolve worker count (0 = auto)
    let workerCount = c.get('workers');
    if (workerCount === 0) {
      workerCount = Math.max(1, Math.min(4, Math.floor(envInfo.cpus / 2)));
    }
    if (workerCount < 1) workerCount = 1;

    this.logger.info('ParallelPlaywrightRenderer init', {
      workers: workerCount,
      cpus: envInfo.cpus,
      useGpu: c.get('useGpu')
    });

    // We don't actually boot any Chrome here — workers do that themselves.
    // We just need to verify the scene HTML exists and the frames dir is writable.
    const htmlPath = path.resolve(c.get('htmlPath'));
    if (!fs.existsSync(htmlPath)) {
      throw new RenderError(`Scene HTML not found: ${htmlPath}`);
    }
    const framesDir = c.get('framesDir');
    ensureDir(framesDir);

    this._workerCount = workerCount;
  }

  /**
   * Get scene duration by launching a single short-lived worker.
   * We don't keep a Chrome instance alive in the orchestrator — workers
   * boot their own Chrome on demand.
   */
  async _getDuration() {
    if (this._duration !== null) return this._duration;

    const c = this.config;
    const htmlPath = path.resolve(c.get('htmlPath'));

    // Quick path: use Playwright directly for a one-off duration probe.
    // (Booting a worker just for duration is wasteful.)
    const { chromium } = require('playwright');
    let browser;
    try {
      const args = c.get('browserArgs') || env.recommendedChromiumArgs();
      const executablePath = c.get('executablePath') || env.findChromium();
      browser = await chromium.launch({ args, headless: true, executablePath });
      const page = await browser.newPage();
      await page.goto('file://' + htmlPath, { waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(
        () => typeof window.renderAtTime === 'function' && typeof window.masterTL === 'object',
        { timeout: 15000 }
      );
      this._duration = await page.evaluate(() => window.masterTL.duration());
    } catch (e) {
      throw new RenderError(`Failed to probe scene duration: ${e.message}`, { cause: e });
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
    return this._duration;
  }

  /**
   * Parallel frame rendering is handled at the Pipeline level (which knows
   * the full frame range and can split work). The orchestrator exposes
   * the worker count so the pipeline can call _spawnWorkers() directly.
   *
   * However, to stay backward-compatible with the Renderer interface
   * (which only knows renderFrame(t, outPath)), we ALSO support a
   * "render all frames" mode triggered by a special outPath sentinel.
   *
   * In practice, the Pipeline will call `renderFrames(start, end, fps, framesDir)`
   * on this renderer via duck-typing. That method is the primary entry point.
   */
  async _renderFrame(t, outPath) {
    // Fallback for single-frame requests: just delegate to a one-shot worker.
    // This is inefficient (boots Chrome for one frame) but keeps the
    // Renderer interface contract intact for testing/debugging.
    await this._renderFramesInRange([Math.round(t * this.config.get('fps'))], path.dirname(outPath));
  }

  /**
   * Primary entry point: render a contiguous range of frames in parallel.
   *
   * @param {number} startFrame - inclusive
   * @param {number} endFrame - exclusive
   * @param {number} fps
   * @param {string} framesDir
   * @param {Object} [opts] - { onProgress: (captured, skipped, total) => void }
   * @returns {Promise<{captured:number, skipped:number, total:number}>}
   */
  async _renderFramesInRange(range, framesDir, opts = {}) {
    // Accept either [start, end] pair or explicit list of frame indices.
    let frameIndices;
    if (Array.isArray(range)) {
      frameIndices = range;
    } else {
      const { startFrame, endFrame } = range;
      frameIndices = [];
      for (let i = startFrame; i < endFrame; i++) frameIndices.push(i);
    }

    // Apply resume filter
    const c = this.config;
    const ext = c.get('frameFormat') === 'jpeg' ? 'jpg' : 'png';
    const toCapture = [];
    let skipped = 0;
    if (c.get('resumeFromDisk')) {
      for (const i of frameIndices) {
        const fp = path.join(framesDir, `frame_${String(i).padStart(5, '0')}.${ext}`);
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
      this.logger.info('All frames already on disk — skipping capture entirely', { skipped, total });
      return { captured: 0, skipped, total };
    }

    // Split toCapture into N contiguous chunks (better cache locality)
    const N = Math.min(this._workerCount, toCapture.length);
    const chunks = new Array(N).fill(null).map(() => []);
    for (let i = 0; i < toCapture.length; i++) {
      chunks[i % N].push(toCapture[i]);
    }

    this.logger.info('Spawning parallel workers', {
      workers: N,
      totalFrames: total,
      toCapture: toCapture.length,
      skipped,
      chunkSizes: chunks.map(c => c.length)
    });

    // Spawn N worker processes
    const workerScript = path.join(__dirname, '_RenderWorker.js');
    const promises = chunks.map((chunk, idx) => this._runWorker(workerScript, idx, chunk, framesDir, opts));

    let captured = 0;
    const results = await Promise.all(promises);
    for (const r of results) captured += r.captured;

    return { captured, skipped, total };
  }

  /**
   * Spawn one worker process for a chunk of frame indices.
   */
  _runWorker(scriptPath, workerIdx, frameIndices, framesDir, opts = {}) {
    return new Promise((resolve, reject) => {
      const c = this.config;

      // Pass config to worker via env vars (FORGE_*) — Config.js auto-reads them.
      const workerEnv = { ...process.env };
      // Already set in parent process — inherited automatically.

      // Pass frame range + paths via argv (parsed by _RenderWorker.js)
      const workerArgs = [
        scriptPath,
        '--html-path', path.resolve(c.get('htmlPath')),
        '--frames-dir', framesDir,
        '--frame-indices', frameIndices.join(','),
        '--fps', String(c.get('fps')),
        '--width', String(c.get('width')),
        '--height', String(c.get('height')),
        '--capture-scale', String(c.get('captureScale')),
        '--frame-format', c.get('frameFormat'),
        '--jpeg-quality', String(c.get('jpegQuality')),
        '--use-gpu', c.get('useGpu') ? '1' : '0',
        '--verify-gpu', c.get('verifyGpu') ? '1' : '0',
        '--theme', c.get('theme') || '',
        '--executable-path', c.get('executablePath') || '',
        '--browser-args', c.get('browserArgs') ? JSON.stringify(c.get('browserArgs')) : '',
        '--log-level', c.get('logLevel') || 'info',
        '--worker-idx', String(workerIdx)
      ];

      const proc = fork(scriptPath, workerArgs.slice(1), {
        env: workerEnv,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
      });

      let captured = 0;
      let stderr = '';

      proc.stdout.on('data', d => {
        // Workers emit JSON log lines on stdout — forward them to the parent logger
        const lines = d.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const msg = JSON.parse(line);
            if (msg.type === 'progress') {
              captured = msg.captured;
              opts.onProgress?.(msg.captured, msg.total, msg.workerIdx);
            } else if (msg.type === 'log') {
              const fn = this.logger[msg.level] || this.logger.info;
              fn.call(this.logger, `[w${msg.workerIdx}] ${msg.msg}`, msg.ctx);
            }
          } catch {
            // Plain text line — log as debug
            this.logger.debug?.(`[w${workerIdx}] ${line}`);
          }
        }
      });

      proc.stderr.on('data', d => { stderr += d.toString(); });

      proc.on('error', err => {
        reject(new RenderError(`Worker ${workerIdx} crashed: ${err.message}`, { cause: err, stderr }));
      });

      proc.on('exit', code => {
        if (code !== 0) {
          reject(new RenderError(`Worker ${workerIdx} exited with code ${code}`, { stderr: stderr.slice(-2000) }));
        } else {
          resolve({ captured, workerIdx });
        }
      });

      this.workers.push(proc);
    });
  }

  async _close() {
    // Workers are short-lived — they exit on their own after their chunk.
    // Just make sure none are still running.
    for (const w of this.workers) {
      try {
        if (!w.killed) w.kill('SIGTERM');
      } catch { /* ignore */ }
    }
    this.workers = [];
  }
}

module.exports = { ParallelPlaywrightRenderer };
