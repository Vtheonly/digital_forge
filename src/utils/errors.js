/**
 * errors.js — Custom error types for precise error handling
 *
 * Each error class carries a `code` string and structured `context` object
 * so callers can catch by type and inspect details without parsing messages.
 */

class AppError extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = opts.code || 'APP_ERROR';
    this.context = opts.context || {};
    this.cause = opts.cause;
    if (opts.cause && opts.cause.stack) {
      this.stack = this.stack + '\nCaused by: ' + opts.cause.stack;
    }
  }
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      cause: this.cause ? (this.cause.message || String(this.cause)) : undefined
    };
  }
}

class ConfigError extends AppError {
  constructor(message, context = {}) { super(message, { code: 'CONFIG_ERROR', context }); }
}

class RenderError extends AppError {
  constructor(message, context = {}) { super(message, { code: 'RENDER_ERROR', context }); }
}

class EncodeError extends AppError {
  constructor(message, context = {}) { super(message, { code: 'ENCODE_ERROR', context }); }
}

class DependencyError extends AppError {
  constructor(message, context = {}) { super(message, { code: 'DEPENDENCY_ERROR', context }); }
}

class TimeoutError extends AppError {
  constructor(message, context = {}) { super(message, { code: 'TIMEOUT_ERROR', context }); }
}

/**
 * Wrap an async function with try/catch and convert unknown errors to AppError.
 * @param {Function} fn - async function
 * @param {string} op - operation name for context
 * @returns {Promise<*>}
 */
async function guard(fn, op = 'operation') {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(`${op} failed: ${e.message}`, { cause: e, context: { op } });
  }
}

module.exports = {
  AppError,
  ConfigError,
  RenderError,
  EncodeError,
  DependencyError,
  TimeoutError,
  guard
};
