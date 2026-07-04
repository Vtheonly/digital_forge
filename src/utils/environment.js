/**
 * environment.js — Detect runtime environment (local / Colab / CI / Docker)
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

let _cached = null;

function detect() {
  if (_cached) return _cached;

  const platform = os.platform();
  const isLinux = platform === "linux";
  const isMac = platform === "darwin";
  const isWin = platform === "win32";

  const isColab =
    isLinux &&
    (!!process.env.COLAB_RELEASE_TAG ||
      !!process.env.COLAB_GPU_VERSION ||
      fs.existsSync("/etc/google-startup-scripts") ||
      (fs.existsSync("/content") &&
        fs.existsSync("/usr/local/lib/python3.10/dist-packages/colab")));

  const isDocker =
    fs.existsSync("/.dockerenv") ||
    (fs.existsSync("/proc/1/cgroup") &&
      fs.readFileSync("/proc/1/cgroup", "utf8").includes("docker"));

  const isCI = !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.JENKINS_URL
  );

  // Robust path-independent GPU detection (NVIDIA)
  let hasNvidia = false;
  if (isLinux) {
    hasNvidia =
      fs.existsSync("/dev/nvidia0") ||
      fs.existsSync("/proc/driver/nvidia") ||
      (function () {
        try {
          return spawnSync("which", ["nvidia-smi"]).status === 0;
        } catch {
          return false;
        }
      })();
  } else if (isWin) {
    hasNvidia =
      (function () {
        try {
          return spawnSync("where", ["nvidia-smi"]).status === 0;
        } catch {
          return false;
        }
      })() ||
      fs.existsSync(
        "C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe",
      );
  }

  const hasVaapi = isLinux && fs.existsSync("/dev/dri/renderD128");
  const hasQsv = isLinux && fs.existsSync("/dev/dri/renderD128");

  _cached = {
    platform,
    isLinux,
    isMac,
    isWin,
    isColab,
    isDocker,
    isCI,
    hasNvidia,
    hasVaapi,
    hasQsv,
    hasGpu: hasNvidia || hasVaapi || hasQsv,
    arch: os.arch(),
    home: os.homedir(),
    cpus: os.cpus().length,
    memory: os.totalmem(),
    colabMount: isColab ? "/content" : null,
  };

  return _cached;
}

function _isSnapStub(binPath) {
  if (!binPath) return false;
  if (binPath === "/usr/bin/chromium-browser") {
    try {
      const size = fs.statSync(binPath).size;
      if (size < 5 * 1024 * 1024) return true;
    } catch {
      /* ignore */
    }
    try {
      const content = fs.readFileSync(binPath, "utf8");
      if (
        content.includes("snap") ||
        content.includes("requires the chromium snap")
      ) {
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

/**
 * Find a usable Chromium or Chrome binary.
 * We prioritize system Google Chrome Stable on Linux/Colab because it has
 * native proprietary GPU driver binding support compiled in.
 */
function findChromium() {
  const envInfo = detect();

  // 1. On Linux/Colab, prioritize Google Chrome Stable over Playwright's binary
  if (envInfo.isLinux) {
    const chromePaths = [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
    ];
    for (const c of chromePaths) {
      if (fs.existsSync(c) && !_isSnapStub(c)) {
        return c;
      }
    }
  }

  // 2. Playwright's bundled binary fallback
  try {
    const playwright = require("playwright");
    if (
      playwright.chromium &&
      typeof playwright.chromium.executablePath === "function"
    ) {
      const pwPath = playwright.chromium.executablePath();
      if (pwPath && fs.existsSync(pwPath)) {
        return pwPath;
      }
    }
  } catch {
    /* ignore */
  }

  const pwCacheDirs = [];
  if (envInfo.isLinux) {
    pwCacheDirs.push("/root/.cache/ms-playwright");
    try {
      const homeDirs = fs.readdirSync("/home");
      for (const h of homeDirs) {
        pwCacheDirs.push(`/home/${h}/.cache/ms-playwright`);
      }
    } catch {
      /* ignore */
    }
  } else if (envInfo.isMac) {
    pwCacheDirs.push(path.join(envInfo.home, "Library/Caches/ms-playwright"));
  } else if (envInfo.isWin) {
    pwCacheDirs.push(path.join(envInfo.home, "AppData/Local/ms-playwright"));
  }

  for (const cacheDir of pwCacheDirs) {
    const found = _findPlaywrightChromiumInDir(cacheDir);
    if (found) return found;
  }

  return null;
}

function _findPlaywrightChromiumInDir(cacheDir) {
  if (!fs.existsSync(cacheDir)) return null;
  try {
    const entries = fs.readdirSync(cacheDir);
    for (const name of entries) {
      if (!name.startsWith("chromium-")) continue;
      const fullDir = path.join(cacheDir, name);
      const candidates = [
        path.join(fullDir, "chrome-linux", "chrome"),
        path.join(
          fullDir,
          "chrome-mac",
          "Chromium.app",
          "Contents",
          "MacOS",
          "Chromium",
        ),
        path.join(fullDir, "chrome-win", "chrome.exe"),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Returns recommended Playwright launch args for the current environment.
 */
function recommendedChromiumArgs() {
  const envInfo = detect();
  const args = [
    "--disable-dev-shm-usage",
    "--disable-gpu-sandbox",
    "--disable-setuid-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-features=TranslateUI",
    "--disable-ipc-flooding-protection",
    "--font-render-hinting=none",
    "--disable-extensions",
    "--disable-component-update",
    "--disable-sync",
    "--disable-breakpad",
    "--no-service-autorun",
    "--password-store=basic",
    "--use-mock-keychain",
  ];

  if (envInfo.isColab || envInfo.isDocker || envInfo.isCI) {
    args.push("--no-sandbox", "--disable-setuid-sandbox");
  }

  if (process.env.FORGE_USE_GPU === "1") {
    args.push(
      "--enable-gpu-rasterization",
      "--ignore-gpu-blocklist",
      "--headless=new",
    );

    if (envInfo.isLinux && envInfo.hasNvidia) {
      args.push(
        "--use-gl=angle",
        "--use-angle=vulkan",
        "--enable-features=Vulkan",
        "--disable-vulkan-surface",
        "--disable-software-rasterizer",
        "--allow-chrome-scheme-url",
      );
    } else if (envInfo.isLinux && (envInfo.hasVaapi || envInfo.hasQsv)) {
      args.push(
        "--use-gl=angle",
        "--use-angle=gl",
        "--disable-software-rasterizer",
        "--allow-chrome-scheme-url",
      );
    } else if (envInfo.isWin && envInfo.hasNvidia) {
      args.push(
        "--use-gl=angle",
        "--use-angle=d3d11",
        "--disable-software-rasterizer",
        "--allow-chrome-scheme-url",
      );
    } else if (envInfo.isMac) {
      args.push(
        "--use-gl=angle",
        "--use-angle=metal",
        "--allow-chrome-scheme-url",
      );
    } else {
      args.push("--use-gl=angle", "--allow-chrome-scheme-url");
    }
  } else {
    args.push("--disable-gpu", "--headless");
  }

  return args;
}

module.exports = {
  detect,
  findChromium,
  recommendedChromiumArgs,
  _isSnapStub,
};
