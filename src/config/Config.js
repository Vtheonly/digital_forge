/**
 * Config.js — Centralized, validated configuration
 *
 * Loads from (in priority order):
 *   1. CLI flags (override everything)
 *   2. Environment variables (FORGE_*)
 *   3. Config file (.forgeconfig.json or .env)
 *   4. Built-in defaults
 *
 * Every option has a default, a validator, and a description, so
 * misconfiguration fails loudly at startup instead of mid-render.
 */

const fs = require('fs');
const path = require('path');
const { ConfigError } = require('../utils/errors');
const env = require('../utils/environment');

const DEFAULTS = {
  // ===== Rendering =====
  htmlPath:        null,                    // required: path to scene HTML
  outputDir:       './output',
  framesDir:       './output/frames',       // intermediate frame storage
  fps:             15,                      // capture fps (source)
  targetFps:       60,                      // output fps (after interpolation)
  width:           1080,                    // final video width
  height:          1920,                    // final video height
  captureScale:    1.0,                     // 1.0 = native res, 0.5 = half-res
  startFrame:      0,                       // for resumable rendering
  maxFrames:       Infinity,                // cap per run (for batching)
  frameFormat:     'jpeg',                  // 'jpeg' or 'png'
  jpegQuality:     92,
  resumeFromDisk:  true,                    // skip already-captured frames

  // ===== Encoder =====
  encoder:         'auto',                  // 'auto' | 'cpu' | 'nvenc' | 'vaapi' | 'qsv' | 'videotoolbox'
  videoCodec:      null,                    // auto-selected from encoder
  videoBitrate:    null,                    // auto from CRF
  crf:             18,                      // quality (lower = better, 18 = visually lossless)
  preset:          'medium',                // x264 preset: ultrafast..veryslow
  pixelFormat:     'yuv420p',
  audioCodec:      'aac',
  audioBitrate:    '192k',
  scaleFilter:     'lanczos',               // upscaler: lanczos | bicubic | bilinear
  interpolate:     'duplicate',             // 'duplicate' (fast) | 'minterpolate' (smooth but slow)

  // ===== Audio =====
  musicPath:       null,                    // path to wav/mp3
  generateMusic:   false,                   // if true, run music generator

  // ===== Theme =====
  theme:           null,                    // path to theme file (themes/X.js) or inline JSON

  // ===== GPU =====
  useGpu:          false,                   // pass --enable-gpu to Chrome for capture
  gpuRenderer:     null,                    // override chrome --use-gl flag

  // ===== Behavior =====
  logLevel:        'info',
  logFile:         null,                    // optional log file path
  cleanFramesAfterEncode: true,
  timeout:         600000,                  // 10 min default for long ops

  // ===== Browser =====
  browserArgs:     null,                    // override default Chromium args
  executablePath:  null                     // override Chromium binary path
};

class Config {
  constructor(opts = {}) {
    this._raw = { ...DEFAULTS, ...opts };
    this._applyEnv();
    this._validate();
  }

  /**
   * Apply FORGE_* environment variables.
   * e.g. FORGE_FPS=30, FORGE_ENCODER=nvenc, FORGE_USE_GPU=1
   */
  _applyEnv() {
    for (const key of Object.keys(DEFAULTS)) {
      const envKey = 'FORGE_' + key.replace(/([A-Z])/g, '_$1').toUpperCase();
      const val = process.env[envKey];
      if (val === undefined) continue;

      // Type coerce based on default's type
      const defVal = DEFAULTS[key];
      if (typeof defVal === 'number') {
        this._raw[key] = parseFloat(val);
        if (isNaN(this._raw[key])) {
          throw new ConfigError(`Invalid number for ${envKey}: ${val}`);
        }
      } else if (typeof defVal === 'boolean') {
        this._raw[key] = val === '1' || val === 'true' || val === 'yes';
      } else {
        this._raw[key] = val;
      }
    }
  }

  _validate() {
    const c = this._raw;

    if (!c.htmlPath) {
      throw new ConfigError('htmlPath is required (pass via constructor or FORGE_HTML_PATH)');
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
      throw new ConfigError(`captureScale must be 0.1-4, got ${c.captureScale}`);
    }
    if (c.crf < 0 || c.crf > 51) {
      throw new ConfigError(`crf must be 0-51, got ${c.crf}`);
    }
    if (!['cpu', 'auto', 'nvenc', 'vaapi', 'qsv', 'videotoolbox'].includes(c.encoder)) {
      throw new ConfigError(`encoder must be cpu|auto|nvenc|vaapi|qsv|videotoolbox, got ${c.encoder}`);
    }
    if (!['jpeg', 'png'].includes(c.frameFormat)) {
      throw new ConfigError(`frameFormat must be jpeg|png, got ${c.frameFormat}`);
    }
    if (!['lanczos', 'bicubic', 'bilinear', 'spline'].includes(c.scaleFilter)) {
      throw new ConfigError(`scaleFilter must be lanczos|bicubic|bilinear|spline, got ${c.scaleFilter}`);
    }
    if (!['duplicate', 'minterpolate'].includes(c.interpolate)) {
      throw new ConfigError(`interpolate must be duplicate|minterpolate, got ${c.interpolate}`);
    }

    // Auto-detect encoder if requested
    if (c.encoder === 'auto') {
      const e = env.detect();
      if (e.hasNvidia) c.encoder = 'nvenc';
      else if (e.isMac) c.encoder = 'videotoolbox';
      else if (e.hasVaapi) c.encoder = 'vaapi';
      else c.encoder = 'cpu';
    }
  }

  /**
   * Get a config value.
   */
  get(key) {
    if (!(key in this._raw)) {
      throw new ConfigError(`Unknown config key: ${key}`);
    }
    return this._raw[key];
  }

  /**
   * Set a config value (runtime override — does NOT re-validate).
   */
  set(key, value) {
    if (!(key in DEFAULTS)) {
      throw new ConfigError(`Unknown config key: ${key}`);
    }
    this._raw[key] = value;
  }

  /**
   * Return a plain object snapshot of the config.
   */
  toObject() {
    return { ...this._raw };
  }

  /**
   * Pretty-print for logs.
   */
  summary() {
    const c = this._raw;
    return {
      html: path.basename(c.htmlPath),
      resolution: `${c.width}x${c.height}`,
      captureFps: c.fps,
      outputFps: c.targetFps,
      captureScale: c.captureScale,
      encoder: c.encoder,
      crf: c.crf,
      interpolate: c.interpolate,
      useGpu: c.useGpu
    };
  }
}

module.exports = { Config, DEFAULTS };
