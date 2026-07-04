/**
 * environment.js — Detect runtime environment (local / Colab / CI / Docker)
 *
 * Google Colab doesn't ship with a usable Chromium (the /usr/bin/chromium-browser
 * is a snap stub that doesn't work). So we need to:
 *   1. Prefer Playwright's bundled Chromium (downloaded via npx playwright install)
 *   2. Use Playwright's own executablePath() API for reliable lookup
 *   3. Only fall back to system Chrome if it's NOT a snap stub
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

let _cached = null;

function detect() {
  if (_cached) return _cached;

  const platform = os.platform();
  const isLinux = platform === 'linux';
  const isMac = platform === 'darwin';
  const isWin = platform === 'win32';

  // Colab detection — check multiple signals since /content exists on other envs too
  const isColab = isLinux && (
    !!process.env.COLAB_RELEASE_TAG ||
    !!process.env.COLAB_GPU_VERSION ||
    fs.existsSync('/etc/google-startup-scripts') ||
    (fs.existsSync('/content') && fs.existsSync('/usr/local/lib/python3.10/dist-packages/colab'))
  );

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
    isColab,
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
 * Check if a chromium binary at `path` is a snap stub (which doesn't work on Colab).
 * The snap stub prints "requires the chromium snap to be installed" when run.
 */
function _isSnapStub(binPath) {
  if (!binPath) return false;
  // /usr/bin/chromium-browser on Ubuntu 22+ is a snap stub
  // The real apt chromium is at /usr/bin/chromium
  if (binPath === '/usr/bin/chromium-browser') {
    // Check if it's a small file (stub) vs real binary (100MB+)
    try {
      const size = fs.statSync(binPath).size;
      // Real chromium is 100MB+, snap stub is <1MB
      if (size < 5 * 1024 * 1024) {
        return true;
      }
    } catch { /* ignore */ }
    // Also check the file content for snap marker
    try {
      const content = fs.readFileSync(binPath, 'utf8');
      if (content.includes('snap') || content.includes('requires the chromium snap')) {
        return true;
      }
    } catch { /* not text, probably real binary */ }
  }
  return false;
}

/**
 * Find a usable Chromium binary.
 *
 * Priority:
 *   1. Playwright's bundled Chromium (via playwright.executablePath()) — most reliable
 *   2. Glob for Playwright cache directories
 *   3. System chromium (NOT snap stub)
 *   4. System google-chrome
 *
 * @returns {string|null} absolute path to a usable Chromium, or null if none found
 */
function findChromium() {
  const envInfo = detect();

  // === 1. Try Playwright's API first (most reliable) ===
  try {
    const playwright = require('playwright');
    if (playwright.chromium && typeof playwright.chromium.executablePath === 'function') {
      const pwPath = playwright.chromium.executablePath();
      if (pwPath && fs.existsSync(pwPath)) {
        return pwPath;
      }
    }
  } catch { /* playwright not installed yet */ }

  // === 2. Glob for Playwright cache directories ===
  const pwCacheDirs = [];
  if (envInfo.isLinux) {
    pwCacheDirs.push('/root/.cache/ms-playwright');
    // Also check /home/* for non-root users
    try {
      const homeDirs = fs.readdirSync('/home');
      for (const h of homeDirs) {
        pwCacheDirs.push(`/home/${h}/.cache/ms-playwright`);
      }
    } catch { /* ignore */ }
    // Also check XDG_CACHE_HOME
    if (process.env.XDG_CACHE_HOME) {
      pwCacheDirs.push(path.join(process.env.XDG_CACHE_HOME, 'ms-playwright'));
    }
  } else if (envInfo.isMac) {
    pwCacheDirs.push(path.join(envInfo.home, 'Library/Caches/ms-playwright'));
  } else if (envInfo.isWin) {
    pwCacheDirs.push(path.join(envInfo.home, 'AppData/Local/ms-playwright'));
  }

  for (const cacheDir of pwCacheDirs) {
    const found = _findPlaywrightChromiumInDir(cacheDir);
    if (found) return found;
  }

  // === 3. System chromium (skip snap stubs) ===
  const systemCandidates = envInfo.isLinux
    ? ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
       '/usr/bin/google-chrome-stable']
    : envInfo.isMac
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
       '/Applications/Chromium.app/Contents/MacOS/Chromium']
    : ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
       'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'];

  for (const c of systemCandidates) {
    if (fs.existsSync(c) && !_isSnapStub(c)) {
      return c;
    }
  }

  return null;
}

/**
 * Search a Playwright cache directory for the chromium binary.
 * Uses proper directory enumeration (no buggy glob splitting).
 */
function _findPlaywrightChromiumInDir(cacheDir) {
  if (!cacheDir) return null;
  let entries;
  try {
    entries = fs.readdirSync(cacheDir);
  } catch { return null; }

  // Look for chromium-* directories
  for (const name of entries) {
    if (!name.startsWith('chromium-')) continue;
    const fullDir = path.join(cacheDir, name);
    if (!fs.statSync(fullDir).isDirectory()) continue;

    // Linux: chromium-XXXX/chrome-linux/chrome
    // Mac:   chromium-XXXX/chrome-mac/Chromium.app/Contents/MacOS/Chromium
    // Win:   chromium-XXXX/chrome-win/chrome.exe
    const candidates = [
      path.join(fullDir, 'chrome-linux', 'chrome'),
      path.join(fullDir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
      path.join(fullDir, 'chrome-win', 'chrome.exe')
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }
  return null;
}

/**
 * Returns recommended Playwright launch args for the current environment.
 * Colab needs --no-sandbox and other flags; local can be more permissive.
 *
 * GPU behavior is controlled by the FORGE_USE_GPU env var:
 *   FORGE_USE_GPU=1  → enable GPU rasterization (requires GPU + drivers)
 *   (not set)        → disable GPU (software rasterizer, more reliable for headless)
 *
 * The renderer sets FORGE_USE_GPU=1 when the --gpu CLI flag is passed.
 *
 * ⚠️  CRITICAL BUG FIX (Chrome 131+, affects Colab T4 as of 2024-2025)
 * ---------------------------------------------------------------
 * The previous implementation passed `--use-gl=egl` on Linux+NVIDIA. That
 * flag is REJECTED by Chrome 131+ headless shell (the gpu_factory allowlist
 * now only accepts `gl=egl-angle, angle=default`), which causes the GPU
 * process to exit and Chrome to *silently* fall back to SwiftShader — a
 * CPU-based software rasterizer that pretends to be a GPU.
 *
 * Symptom: `--gpu` is passed, no error is raised, but `nvidia-smi` shows
 * 0% utilization during capture and the entire render runs on the CPU.
 *
 * Fix: use `--use-gl=angle --use-angle=vulkan --enable-features=Vulkan
 * --disable-vulkan-surface` (the modern, Chrome-131+-compatible GPU stack
 * verified on Colab T4/V100 by the Chrome team and multiple 2025 reports).
 * Also add `--disable-software-rasterizer` so any future fallback FAILS
 * LOUDLY instead of silently degrading to SwiftShader.
 *
 * References:
 *   - https://github.com/heygen-com/hyperframes/issues/1493
 *   - https://developer.chrome.com/blog/supercharge-web-ai-testing
 *   - https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md
 */
function recommendedChromiumArgs() {
  const envInfo = detect();
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
    '--font-render-hinting=none',
    '--disable-extensions',
    '--disable-component-update',
    '--disable-sync',
    '--disable-breakpad',
    '--no-service-autorun',
    '--password-store=basic',
    '--use-mock-keychain'
  ];

  if (envInfo.isColab || envInfo.isDocker || envInfo.isCI) {
    args.push('--no-sandbox', '--disable-setuid-sandbox');
  }

  // GPU flag: check the FORGE_USE_GPU env var (set by renderer when --gpu is passed)
  if (process.env.FORGE_USE_GPU === '1') {
    // === GPU RASTERIZATION (Chrome 131+ compatible) ===
    // Always-on flags:
    args.push(
      '--enable-gpu-rasterization',  // Allow Skia GPU backend for layer tiles
      '--ignore-gpu-blocklist',      // Don't let Chrome's blocklist disable GPU
      '--headless=new'               // New headless mode (old --headless forces software)
    );

    if (envInfo.isLinux && envInfo.hasNvidia) {
      // ✅ CORRECT GPU stack for Chrome 131+ on Linux + NVIDIA (Colab T4/V100/L4):
      //    - --use-gl=angle           : ANGLE translates GLES to a backend
      //    - --use-angle=vulkan       : Use Vulkan as the ANGLE backend (NVIDIA Vulkan ICD)
      //    - --enable-features=Vulkan : Enable Vulkan for compositing + rasterization
      //    - --disable-vulkan-surface : Use bitblt present (no VK_KHR_surface, headless-safe)
      //    - --disable-software-rasterizer : FAIL LOUDLY instead of silent SwiftShader fallback
      //    - --allow-chrome-scheme-url : Allow navigation to chrome://gpu for verification
      //
      // ❌ DO NOT USE --use-gl=egl — it's rejected by Chrome 131+ headless shell
      //    and causes silent SwiftShader (CPU) fallback. See file header.
      args.push(
        '--use-gl=angle',
        '--use-angle=vulkan',
        '--enable-features=Vulkan',
        '--disable-vulkan-surface',
        '--disable-software-rasterizer',
        '--allow-chrome-scheme-url'
      );
    } else if (envInfo.isLinux && (envInfo.hasVaapi || envInfo.hasQsv)) {
      // Intel/AMD GPU via ANGLE EGL backend
      args.push(
        '--use-gl=angle',
        '--use-angle=gl',
        '--disable-software-rasterizer',
        '--allow-chrome-scheme-url'
      );
    } else if (envInfo.isMac) {
      // macOS — Metal-backed ANGLE is the default
      args.push(
        '--use-gl=angle',
        '--use-angle=metal',
        '--allow-chrome-scheme-url'
      );
    } else {
      // Unknown GPU — try ANGLE default backend, allow software fallback
      args.push(
        '--use-gl=angle',
        '--allow-chrome-scheme-url'
      );
    }
  } else {
    // CPU mode: software rasterizer (more reliable for headless capture)
    args.push('--disable-gpu', '--headless');
  }

  return args;
}

module.exports = {
  detect,
  findChromium,
  recommendedChromiumArgs,
  _isSnapStub  // exported for testing
};
