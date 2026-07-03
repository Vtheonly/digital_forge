/**
 * Logger.js — Centralized logging system
 *
 * Provides structured, leveled logging with timestamps, color coding,
 * and optional file output. Used by every module in the project so
 * logs have a consistent format and can be grepped/filtered easily.
 *
 * Log levels (in order of severity):
 *   DEBUG  → verbose trace info, only shown when logLevel=debug
 *   INFO   → normal operation milestones (frame captured, step done)
 *   WARN   → recoverable issues (slow frame, retry, fallback)
 *   ERROR  → operation failed but pipeline can continue
 *   FATAL  → unrecoverable, pipeline aborts
 *
 * Usage:
 *   const log = new Logger({ level: 'info', file: 'render.log' });
 *   log.info('Starting render', { frames: 310 });
 *   log.error('Frame failed', { frame: 42, err: e.message });
 */

const fs = require('fs');
const path = require('path');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };
const COLORS = {
  debug:  '\x1b[90m',  // gray
  info:   '\x1b[36m',  // cyan
  warn:   '\x1b[33m',  // yellow
  error:  '\x1b[31m',  // red
  fatal:  '\x1b[35m',  // magenta
  reset:  '\x1b[0m'
};

class Logger {
  /**
   * @param {Object} opts
   * @param {string} [opts.level='info']  — Minimum level to print
   * @param {string} [opts.file]          — Optional log file path
   * @param {boolean} [opts.color=true]   — ANSI color in stdout
   * @param {string}  [opts.name='app']   — Logger name prefix
   */
  constructor(opts = {}) {
    this.level = LEVELS[opts.level || 'info'] || LEVELS.info;
    this.color = opts.color !== false;
    this.name = opts.name || 'app';
    this.fileStream = opts.file ? fs.createWriteStream(opts.file, { flags: 'a' }) : null;
    this._startTime = Date.now();
  }

  _elapsed() {
    const ms = Date.now() - this._startTime;
    const s = Math.floor(ms / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    const mmm = String(ms % 1000).padStart(3, '0');
    return `${mm}:${ss}.${mmm}`;
  }

  _emit(level, msg, meta) {
    if (LEVELS[level] < this.level) return;
    const ts = this._elapsed();
    const tag = level.toUpperCase().padEnd(5);
    const metaStr = meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    const line = `[${ts}] ${tag} ${msg}${metaStr}`;

    // Stdout (with color)
    if (this.color) {
      const c = COLORS[level] || '';
      process.stdout.write(`${c}${line}${COLORS.reset}\n`);
    } else {
      process.stdout.write(line + '\n');
    }

    // File (no color)
    if (this.fileStream) {
      this.fileStream.write(line + '\n');
    }
  }

  debug(msg, meta) { this._emit('debug', msg, meta); }
  info(msg, meta)  { this._emit('info', msg, meta); }
  warn(msg, meta)  { this._emit('warn', msg, meta); }
  error(msg, meta) { this._emit('error', msg, meta); }
  fatal(msg, meta) { this._emit('fatal', msg, meta); }

  /** Create a child logger with a prefixed name. */
  child(name) {
    const child = Object.create(Logger.prototype);
    Object.assign(child, this);
    child.name = `${this.name}:${name}`;
    return child;
  }

  /** Close file stream. Safe to call multiple times. */
  close() {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }
  }
}

module.exports = { Logger, LEVELS };
