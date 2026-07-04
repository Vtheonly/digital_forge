/**
 * GpuMonitor.js — Sample GPU utilization during rendering
 *
 * Spawns `nvidia-smi --query-gpu=... --format=csv -l <interval>` in the
 * background, collects samples, and reports aggregate stats when stopped.
 *
 * Why this exists:
 *   The whole point of the GPU pipeline fix is to make `nvidia-smi` show
 *   non-zero utilization during *capture* (not just during encode). Before
 *   the fix, capture was 100% on CPU (SwiftShader), so GPU sat at 0% the
 *   whole time and only spiked briefly for NVENC encode.
 *
 *   This monitor lets the pipeline log a one-line summary at the end:
 *     "GPU avg 18% (peak 42%) during capture, avg 87% (peak 95%) during encode"
 *   which is the single most useful diagnostic for confirming the fix.
 *
 * Usage:
 *   const mon = new GpuMonitor({ intervalMs: 1000, logger });
 *   await mon.start();
 *   ... do render ...
 *   mon.markPhase('encode');
 *   ... do encode ...
 *   const stats = await mon.stop();
 *   // stats = { sampleCount, avg, peak, byPhase: { capture: {...}, encode: {...} } }
 */

const { spawn } = require('child_process');

class GpuMonitor {
  /**
   * @param {Object} opts
   * @param {number} [opts.intervalMs=1000] — sampling interval
   * @param {Object} [opts.logger]
   */
  constructor(opts = {}) {
    this.intervalMs = opts.intervalMs || 1000;
    this.logger = opts.logger;
    this.proc = null;
    this.samples = [];
    this.currentPhase = 'capture';
    this.phaseBoundaries = [{ phase: 'capture', startIndex: 0 }];
    this._onExit = null;
  }

  /**
   * Start sampling nvidia-smi in the background.
   * If nvidia-smi is not available, this is a no-op (monitor is "inactive").
   */
  async start() {
    try {
      // Probe nvidia-smi availability first
      const probe = spawn('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader']);
      const available = await new Promise(resolve => {
        probe.on('error', () => resolve(false));
        probe.on('exit', code => resolve(code === 0));
        setTimeout(() => { probe.kill(); resolve(false); }, 3000);
      });
      if (!available) {
        this.logger?.debug?.('GpuMonitor: nvidia-smi not available — monitor inactive');
        this._active = false;
        return;
      }
    } catch {
      this._active = false;
      return;
    }

    this._active = true;
    // Sample: timestamp, utilization.gpu (%), memory.used (MiB), power.draw (W)
    this.proc = spawn('nvidia-smi', [
      '--query-gpu=timestamp,utilization.gpu,memory.used,power.draw',
      '--format=csv,noheader,nounits',
      '-l', String(Math.max(1, Math.round(this.intervalMs / 1000)))
    ]);

    this.proc.stdout.on('data', d => {
      const lines = d.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        const parts = line.split(',').map(s => s.trim());
        if (parts.length < 4) continue;
        const sample = {
          ts: new Date(parts[0]).getTime() || Date.now(),
          gpuUtil: parseFloat(parts[1]) || 0,
          memUsedMib: parseFloat(parts[2]) || 0,
          powerW: parseFloat(parts[3]) || 0,
          phase: this.currentPhase
        };
        this.samples.push(sample);
      }
    });

    this.proc.stderr.on('data', d => {
      this.logger?.debug?.('GpuMonitor nvidia-smi stderr', { msg: d.toString().slice(0, 200) });
    });

    this.proc.on('error', err => {
      this.logger?.warn?.('GpuMonitor process error', { err: err.message });
      this._active = false;
    });

    this.logger?.info?.('GpuMonitor started', { intervalMs: this.intervalMs });
  }

  /**
   * Mark the start of a new phase (e.g. 'capture' → 'encode').
   * Samples after this call are tagged with the new phase.
   */
  markPhase(name) {
    if (!this._active) return;
    this.currentPhase = name;
    this.phaseBoundaries.push({ phase: name, startIndex: this.samples.length });
  }

  /**
   * Stop sampling and return aggregate stats.
   */
  async stop() {
    if (!this._active) {
      return { active: false, sampleCount: 0, byPhase: {} };
    }
    if (this.proc) {
      this._onExit = new Promise(resolve => {
        this.proc.once('exit', () => resolve());
        this.proc.kill('SIGTERM');
        setTimeout(() => { this.proc?.kill('SIGKILL'); resolve(); }, 2000);
      });
      await this._onExit;
      this.proc = null;
    }

    return this.stats();
  }

  /**
   * Compute aggregate stats from collected samples (without stopping).
   */
  stats() {
    if (!this.samples.length) {
      return { active: this._active, sampleCount: 0, byPhase: {} };
    }

    const byPhase = {};
    for (const s of this.samples) {
      if (!byPhase[s.phase]) {
        byPhase[s.phase] = { count: 0, gpuUtilSum: 0, gpuUtilPeak: 0, memPeakMib: 0, powerPeakW: 0 };
      }
      const p = byPhase[s.phase];
      p.count++;
      p.gpuUtilSum += s.gpuUtil;
      if (s.gpuUtil > p.gpuUtilPeak) p.gpuUtilPeak = s.gpuUtil;
      if (s.memUsedMib > p.memPeakMib) p.memPeakMib = s.memUsedMib;
      if (s.powerW > p.powerPeakW) p.powerPeakW = s.powerW;
    }
    for (const p of Object.values(byPhase)) {
      p.gpuUtilAvg = +(p.gpuUtilSum / p.count).toFixed(1);
      p.gpuUtilPeak = +p.gpuUtilPeak.toFixed(1);
      p.memPeakMib = +p.memPeakMib.toFixed(0);
      p.powerPeakW = +p.powerPeakW.toFixed(1);
      delete p.gpuUtilSum;
    }

    return {
      active: true,
      sampleCount: this.samples.length,
      byPhase
    };
  }
}

module.exports = { GpuMonitor };
