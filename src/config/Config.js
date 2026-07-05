/**
 * Config.js — Centralized, validated configuration
 */

const fs = require("fs");
const path = require("path");
const { ConfigError } = require("../utils/errors");
const env = require("../utils/environment");

const envInfo = env.detect();

const DEFAULTS = {
  // ===== Rendering =====
  htmlPath: null, // required: path to scene HTML
  outputDir: "./output",
  framesDir: "./output/frames", // intermediate frame storage
  fps: 15, // capture fps (source)
  targetFps: 60, // output fps (after interpolation)
  width: 1080, // final video width
  height: 1920, // final video height
  captureScale: 1.0, // 1.0 = native res, 0.5 = half-res
  startFrame: 0, // for resumable rendering
  maxFrames: Infinity, // cap per run (for batching)
  frameFormat: "jpeg", // 'jpeg' or 'png'
  jpegQuality: 92,
  resumeFromDisk: true, // skip already-captured frames

  // ===== Encoder =====
  encoder: "auto", // 'auto' | 'cpu' | 'nvenc' | 'vaapi' | 'qsv' | 'videotoolbox'
  videoCodec: null, // auto-selected from encoder
  videoBitrate: null, // auto from CRF
  crf: 18, // quality (lower = better, 18 = visually lossless)
  preset: "medium", // x264 preset: ultrafast..veryslow
  pixelFormat: "yuv420p",
  audioCodec: "aac",
  audioBitrate: "192k",
  scaleFilter: "lanczos", // upscaler: lanczos | bicubic | bilinear
  interpolate: "duplicate", // 'duplicate' (fast) | 'minterpolate' (smooth but slow)
  nvencHwupload: true, // NVENC: use hwupload_cuda to keep frames on GPU

  // ===== Audio =====
  musicPath: null, // path to wav/mp3
  generateMusic: false, // if true, run music generator

  // ===== Theme =====
  theme: null, // path to theme file (themes/X.js) or inline JSON

  // ===== GPU =====
  useGpu: envInfo.hasGpu, // Auto-enable GPU capture if GPU exists
  gpuRenderer: null, // override chrome --use-gl flag
  verifyGpu: true, // verify chrome://gpu shows HW acceleration
  gpuMonitor: true, // sample nvidia-smi during render
  gpuMonitorIntervalMs: 1000, // nvidia-smi sample interval

  // ===== Parallel capture =====
  workers: 0, // 0 = auto (cpus/2, capped at 4); 1 = serial; 2+ = parallel
  workerStartTimeoutMs: 60000, // per-worker init timeout
  timeScale: 1.0,

  // ===== Behavior =====
  logLevel: "info",
  logFile: null, // optional log file path
  cleanFramesAfterEncode: true,
  timeout: 600000, // 10 min default for long ops

  // ===== Browser =====
  browserArgs: null, // override default Chromium args
  executablePath: null, // override Chromium binary path
};

class Config {
  constructor(opts = {}) {
    this._raw = { ...DEFAULTS, ...opts };
    this._applyEnv();
    this._validate();
  }

  _applyEnv() {
    for (const key of Object.keys(DEFAULTS)) {
      const envKey = "FORGE_" + key.replace(/([A-Z])/g, "_$1").toUpperCase();
      const val = process.env[envKey];
      if (val === undefined) continue;

      const defVal = DEFAULTS[key];
      if (typeof defVal === "number") {
        this._raw[key] = parseFloat(val);
        if (isNaN(this._raw[key])) {
          throw new ConfigError(`Invalid number for ${envKey}: ${val}`);
        }
      } else if (typeof defVal === "boolean") {
        this._raw[key] = val === "1" || val === "true" || val === "yes";
      } else {
        this._raw[key] = val;
      }
    }
  }

  _validate() {
    const c = this._raw;

    if (!c.htmlPath) {
      throw new ConfigError(
        "htmlPath is required (pass via constructor or FORGE_HTML_PATH)",
      );
    }
    if (!fs.existsSync(c.htmlPath)) {
      throw new ConfigError(`htmlPath not found: ${c.htmlPath}`);
    }

    if (c.fps < 1 || c.fps > 120) {
      throw new ConfigError(`fps must be 1-120, got ${c.fps}`);
    }
    if (c.targetFps < 1 || c.targetFps > 120) {
      throw new ConfigError(`targetFps must be 1-120, got ${c.targetFps}`);
    }
    if (c.width < 16 || c.width > 8192) {
      throw new ConfigError(`width must be 16-8192, got ${c.width}`);
    }
    if (c.height < 16 || c.height > 8192) {
      throw new ConfigError(`height must be 16-8192, got ${c.height}`);
    }
    if (c.captureScale < 0.1 || c.captureScale > 4) {
      throw new ConfigError(
        `captureScale must be 0.1-4, got ${c.captureScale}`,
      );
    }
    if (c.crf < 0 || c.crf > 51) {
      throw new ConfigError(`crf must be 0-51, got ${c.crf}`);
    }
    if (
      !["cpu", "auto", "nvenc", "vaapi", "qsv", "videotoolbox"].includes(
        c.encoder,
      )
    ) {
      throw new ConfigError(
        `encoder must be cpu|auto|nvenc|vaapi|qsv|videotoolbox, got ${c.encoder}`,
      );
    }
    if (!["jpeg", "png"].includes(c.frameFormat)) {
      throw new ConfigError(
        `frameFormat must be jpeg|png, got ${c.frameFormat}`,
      );
    }
    if (!["lanczos", "bicubic", "bilinear", "spline"].includes(c.scaleFilter)) {
      throw new ConfigError(
        `scaleFilter must be lanczos|bicubic|bilinear|spline, got ${c.scaleFilter}`,
      );
    }
    if (!["duplicate", "minterpolate"].includes(c.interpolate)) {
      throw new ConfigError(
        `interpolate must be duplicate|minterpolate, got ${c.interpolate}`,
      );
    }
    if (!Number.isInteger(c.workers) || c.workers < 0 || c.workers > 32) {
      throw new ConfigError(
        `workers must be an integer 0-32 (0=auto), got ${c.workers}`,
      );
    }
    if (typeof c.verifyGpu !== "boolean") {
      throw new ConfigError(`verifyGpu must be boolean, got ${c.verifyGpu}`);
    }
    if (c.timeScale < 0.1 || c.timeScale > 4) {
      throw new ConfigError(`timeScale must be 0.1-4, got ${c.timeScale}`);
    }

    // Auto-detect encoder if requested
    if (c.encoder === "auto") {
      const e = env.detect();
      if (e.hasNvidia) c.encoder = "nvenc";
      else if (e.isMac) c.encoder = "videotoolbox";
      else if (e.hasVaapi) c.encoder = "vaapi";
      else c.encoder = "cpu";
    }

    // Dynamic resolution & generation fallback for background music
    if (!c.musicPath) {
      const defaultPaths = [
        path.resolve(process.cwd(), "audio", "forge_theme.wav"),
        path.resolve(process.cwd(), "forge_theme.wav"),
        path.resolve(__dirname, "../../audio/forge_theme.wav"),
      ];
      for (const p of defaultPaths) {
        if (fs.existsSync(p)) {
          c.musicPath = p;
          break;
        }
      }
    }

    if (!c.musicPath) {
      c.generateMusic = true;
      c.musicPath = path.resolve(
        c.outputDir || "./output",
        "generated_theme.wav",
      );
    } else {
      c.musicPath = path.resolve(c.musicPath);
    }

    // Auto-select worker count
    if (c.workers === 0) {
      const e = env.detect();
      c.workers = Math.max(1, Math.min(4, Math.floor(e.cpus / 2)));
    }
  }

  get(key) {
    if (!(key in this._raw)) {
      throw new ConfigError(`Unknown config key: ${key}`);
    }
    return this._raw[key];
  }

  set(key, value) {
    if (!(key in DEFAULTS)) {
      throw new ConfigError(`Unknown config key: ${key}`);
    }
    this._raw[key] = value;
  }

  toObject() {
    return { ...this._raw };
  }

  summary() {
    const c = this._raw;
    return {
      html: path.basename(c.htmlPath),
      resolution: `${c.width}x${c.height}`,
      captureFps: c.fps,
      outputFps: c.targetFps,
      captureScale: c.captureScale,
      timeScale: c.timeScale,
      encoder: c.encoder,
      crf: c.crf,
      interpolate: c.interpolate,
      useGpu: c.useGpu,
      verifyGpu: c.verifyGpu,
      workers: c.workers,
      nvencHwupload: c.nvencHwupload,
      musicPath: c.musicPath,
      generateMusic: c.generateMusic,
    };
  }
}

module.exports = { Config, DEFAULTS };
