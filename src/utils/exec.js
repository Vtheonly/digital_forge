/**
 * exec.js — Promise-wrapped child_process with logging + timeout
 *
 * Used to call ffmpeg, ffprobe, and other CLI tools from Node.
 * Captures stdout/stderr separately and returns them in a structured
 * result so callers can inspect output without parsing strings.
 */

const { spawn } = require('child_process');
const { AppError } = require('./errors');

/**
 * Run a command and return its output.
 *
 * @param {string[]} args - argv array (args[0] is the binary)
 * @param {Object} opts
 * @param {number} [opts.timeout=0] - ms, 0 = no timeout
 * @param {stream} [opts.stdin] - writable to pipe stdin
 * @param {boolean} [opts.captureStderr=true]
 * @param {Logger} [opts.logger]
 * @returns {Promise<{code:number, stdout:string, stderr:string}>}
 */
function exec(args, opts = {}) {
  const bin = args[0];
  const rest = args.slice(1);
  const timeout = opts.timeout || 0;
  const logger = opts.logger;

  if (logger && logger.debug) {
    logger.debug('exec', { cmd: args.join(' '), timeout });
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(bin, rest, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env
    });

    let stdout = '';
    let stderr = '';
    let killed = false;
    let timer = null;

    if (timeout > 0) {
      timer = setTimeout(() => {
        killed = true;
        proc.kill('SIGKILL');
      }, timeout);
    }

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('error', err => {
      if (timer) clearTimeout(timer);
      reject(new AppError(`Failed to spawn "${bin}": ${err.message}`, {
        code: 'SPAWN_ERROR', cause: err, context: { bin, args: rest }
      }));
    });

    proc.on('close', code => {
      if (timer) clearTimeout(timer);
      if (killed) {
        return reject(new AppError(`Command timed out after ${timeout}ms: ${args.join(' ')}`, {
          code: 'TIMEOUT_ERROR', context: { cmd: args, timeout }
        }));
      }
      if (code !== 0 && opts.rejectOnNonZero !== false) {
        return reject(new AppError(`"${bin}" exited with code ${code}`, {
          code: 'EXIT_NONZERO', context: { cmd: args, code, stderr: stderr.slice(-2000) }
        }));
      }
      resolve({ code, stdout, stderr });
    });
  });
}

/**
 * Check if a binary is available on PATH.
 * @returns {Promise<boolean>}
 */
async function which(bin) {
  try {
    await exec(['which', bin], { rejectOnNonZero: true });
    return true;
  } catch {
    return false;
  }
}

module.exports = { exec, which };
