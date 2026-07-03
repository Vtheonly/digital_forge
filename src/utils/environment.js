/**
 * environment.js — Detect runtime environment (local / Colab / CI / Docker)
 *
 * Google Colab doesn't ship with Chromium, so the renderer needs to know
 * when it's running there and auto-install system deps + Playwright browser.
 * This module centralizes all environment detection so the rest of the
 * codebase just asks `env.isColab` / `env.platform` / `env.chromePath`.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('./exec');

let _cached = null;

function detect() {
  if (_cached) return _cached;

  const platform = os.platform();
  const isLinux = platform === 'linux';
  const isMac = platform === 'darwin';
  const isWin = platform === 'win32';

  // Colab detection: /content dir + Google metadata + apt-get available
  const isColab = isLinux && (
    fs.existsSync('/content') &&
    fs.existsSync('/content/drive') === false &&  // not just mounted Drive
    (fs.existsSync('/etc/google-startup-scripts') ||
     process.env.COLAB_RELEASE_TAG ||
     fs.existsSync('/usr/local/lib/python3.10/dist-packages/colab'))
  );

  // Backup Colab detection
  const isColabAlt = isLinux && process.env.COLAB_RELEASE_TAG !== undefined;

  // Docker detection
  const isDocker = fs.existsSync('/.dockerenv') ||
                   (fs.existsSync('/proc/1/cgroup') &&
                    fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker'));

  // CI detection
  const isCI = !!(process.env.CI || process.env.GITHUB_ACTIONS ||
                  process.env.GITLAB_CI || process.env.JENKINS_URL);

  // GPU detection (NVIDIA)
  const hasNvidia = isLinux && (
    fs.existsSync('/dev/nvidia0') ||
    fs.existsSync('/proc/driver/nvidia') ||
    fs.existsSync('/usr/bin/nvidia-smi')
  );

  // Intel/AMD GPU detection (VAAPI)
  const hasVaapi = isLinux && fs.existsSync('/dev/dri/renderD128');

  // QSV detection
  const hasQsv = isLinux && fs.existsSync('/dev/dri/renderD128');

  _cached = {
    platform,
    isLinux, isMac, isWin,
    isColab: isColab || isColabAlt,
    isDocker,
    isCI,
    hasNvidia, hasVaapi, hasQsv,
    hasGpu: hasNvidia || hasVaapi || hasQsv,
    arch: os.arch(),
    home: os.homedir(),
    cpus: os.cpus().length,
    memory: os.totalmem(),
    colabMount: isColab ? '/content' : null
  };

  return _cached;
}

/**
 * Find the Playwright-bundled Chromium binary path.
 * Colab needs special handling — Playwright's install puts it under
 * /root/.cache/ms-playwright on Linux.
 */
function findChromium() {
  const env = detect();
  const candidates = [];

  if (env.isLinux) {
    candidates.push(
      '/root/.cache/ms-playwright/chromium-*/chrome-linux/chrome',
      '/home/*/.cache/ms-playwright/chromium-*/chrome-linux/chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome'
    );
  } else if (env.isMac) {
    candidates.push(
      '/Users/*/Library/Caches/ms-playwright/chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    );
  } else if (env.isWin) {
    candidates.push(
      'C:\\Users\\*\\AppData\\Local\\ms-playwright\\chromium-*\\chrome-win\\chrome.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    );
  }

  for (const pattern of candidates) {
    // Handle glob-style patterns by trying to expand manually (no glob dep)
    if (pattern.includes('*')) {
      const parts = pattern.split('*');
      const base = parts[0];
      const suffix = parts.slice(1).join('');
      try {
        if (fs.existsSync(path.dirname(base))) {
          const dirs = fs.readdirSync(path.dirname(base));
          for (const d of dirs) {
            const candidate = base + d + suffix;
            if (fs.existsSync(candidate)) return candidate;
          }
        }
      } catch { /* ignore */ }
    } else {
      if (fs.existsSync(pattern)) return pattern;
    }
  }

  return null;
}

/**
 * Returns recommended Playwright launch args for the current environment.
 * Colab needs --no-sandbox and other flags; local can be more permissive.
 */
function recommendedChromiumArgs() {
  const env = detect();
  const args = [
    '--disable-dev-shm-usage',     // Critical for Docker/Colab (small /dev/shm)
    '--disable-gpu-sandbox',
    '--disable-setuid-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-features=TranslateUI',
    '--disable-ipc-flooding-protection',
    '--font-render-hinting=none'
  ];

  if (env.isColab || env.isDocker || env.isCI) {
    args.push('--no-sandbox', '--disable-setuid-sandbox');
  }

  // GPU-enabled Chrome (user opt-in via env var)
  if (process.env.FORGE_USE_GPU === '1') {
    // Remove the disable-gpu flags that some templates add; let Chrome use GPU
    args.push('--enable-gpu-rasterization', '--ignore-gpu-blocklist');
  } else {
    args.push('--disable-gpu');  // software rasterizer — more reliable for headless
  }

  return args;
}

module.exports = {
  detect,
  findChromium,
  recommendedChromiumArgs
};
