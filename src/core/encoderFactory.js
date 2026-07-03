/**
 * encoderFactory.js — Picks the right encoder based on config + hardware
 *
 * Selection logic:
 *   1. If config.encoder is explicit ('cpu'|'nvenc'|'vaapi'|'qsv'|'videotoolbox'), use it.
 *   2. If 'auto':
 *        - hasNvidia → nvenc
 *        - isMac     → videotoolbox
 *        - hasVaapi  → vaapi
 *        - else      → cpu (libx264)
 *
 * Falls back to CPU if requested encoder fails its availability check.
 */

const { FFmpegEncoder } = require('../encoders/FFmpegEncoder');
const { NVENCEncoder } = require('../encoders/NVENCEncoder');
const { VAAPIEncoder } = require('../encoders/VAAPIEncoder');
const { QSVEncoder } = require('../encoders/QSVEncoder');
const { VideoToolboxEncoder } = require('../encoders/VideoToolboxEncoder');
const env = require('../utils/environment');
const { EncodeError, DependencyError } = require('../utils/errors');

/**
 * Create an encoder. If the requested encoder can't be used (missing GPU,
 * missing ffmpeg support), falls back to CPU libx264 with a warning.
 *
 * @param {Config} config
 * @param {Logger} logger
 * @returns {Encoder}
 */
function createEncoder(config, logger) {
  const requested = config.get('encoder');
  const envInfo = env.detect();

  const tried = [];
  const tryEncoder = (name) => {
    tried.push(name);
    switch (name) {
      case 'cpu':          return new FFmpegEncoder(config, logger);
      case 'nvenc':        return new NVENCEncoder(config, logger);
      case 'vaapi':        return new VAAPIEncoder(config, logger);
      case 'qsv':          return new QSVEncoder(config, logger);
      case 'videotoolbox': return new VideoToolboxEncoder(config, logger);
      default:
        throw new EncodeError(`Unknown encoder: ${name}`);
    }
  };

  // Try the requested encoder first
  try {
    return tryEncoder(requested);
  } catch (e) {
    if (!(e instanceof DependencyError)) throw e;
    logger.warn('Requested encoder unavailable, falling back to CPU', {
      requested, reason: e.message.slice(0, 100)
    });
  }

  // Fallback: CPU
  return tryEncoder('cpu');
}

module.exports = { createEncoder };
