/**
 * GpuVerifier.js — Verify that Chrome is actually using the GPU
 *
 * After launching Chrome with the recommended GPU flags, this module
 * navigates to chrome://gpu and inspects the rendered page to confirm:
 *
 *   1. The GL renderer string mentions the actual GPU (e.g. "Tesla T4")
 *      and NOT "SwiftShader" (which is the silent CPU fallback).
 *   2. "Graphics Feature Status" entries say "Hardware accelerated"
 *      rather than "Software only".
 *
 * This exists because — prior to the Chrome-131+ flag fix — Chrome would
 * silently fall back to SwiftShader when --use-gl=egl was rejected, and
 * the project shipped for months claiming "GPU accelerated" while
 * actually rendering everything on CPU.
 *
 * Usage:
 *   const { verifyGpu } = require('./GpuVerifier');
 *   const status = await verifyGpu(page, logger);
 *   if (!status.gpuActive) {
 *     logger.warn('GPU NOT ACTIVE — falling back to CPU rasterization', status);
 *   }
 */

const { RenderError } = require('../utils/errors');

/**
 * Verify the GPU is actually being used by the given Playwright page.
 *
 * @param {import('playwright').Page} page — already-launched page
 * @param {Object} [logger] — optional logger
 * @returns {Promise<{gpuActive: boolean, glRenderer: string, swiftshader: boolean, details: Object}>}
 */
async function verifyGpu(page, logger) {
  const log = logger || console;
  const result = {
    gpuActive: false,
    glRenderer: '(unknown)',
    swiftshader: true,           // assume worst case until proven otherwise
    details: {
      gl: '',
      rasterization: '',
      webgl: '',
      webgl2: '',
      vulkan: '',
      gpuCompositing: ''
    },
    raw: ''
  };

  try {
    // chrome://gpu requires the --allow-chrome-scheme-url flag at launch
    await page.goto('chrome://gpu', { waitUntil: 'domcontentloaded', timeout: 10000 });
    // Wait for the feature status list to render
    await page.waitForSelector('.feature-status-list', { timeout: 5000 }).catch(() => {});

    // Pull the entire GPU page text — easy to grep and self-contained
    result.raw = await page.evaluate(() => {
      const list = document.querySelector('.feature-status-list');
      return list ? list.innerText : document.body.innerText;
    });
  } catch (e) {
    log.warn?.('verifyGpu: could not navigate to chrome://gpu', { err: e.message });
    return result;
  }

  // Parse the feature-status-list text. Each line is like:
  //   "WebGL: Hardware accelerated"
  //   "WebGL2: Software only, hardware acceleration unavailable"
  //   "Raster: Hardware accelerated"
  //   "Vulkan: Disabled"
  //   "GL_RENDERER: ANGLE (NVIDIA Corporation, Tesla T4/PCIe/SSE2, ...)"
  const lines = result.raw.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('gl_renderer')) {
      result.glRenderer = line.split(':').slice(1).join(':').trim();
    } else if (lower.startsWith('webgl2')) {
      result.details.webgl2 = line;
    } else if (lower.startsWith('webgl') && !lower.startsWith('webgl2')) {
      result.details.webgl = line;
    } else if (lower.startsWith('raster')) {
      result.details.rasterization = line;
    } else if (lower.startsWith('vulkan')) {
      result.details.vulkan = line;
    } else if (lower.startsWith('gpu compositing') || lower.startsWith('compositing')) {
      result.details.gpuCompositing = line;
    } else if (lower.startsWith('opengl')) {
      result.details.gl = line;
    }
  }

  // Decide if the GPU is actually engaged:
  // 1. GL_RENDERER must NOT contain "swiftshader" or "llvmpipe"
  // 2. At least one of WebGL/WebGL2/Raster must say "Hardware accelerated"
  const renderer = result.glRenderer.toLowerCase();
  const looksLikeSwiftShader = renderer.includes('swiftshader')
                            || renderer.includes('llvmpipe')
                            || renderer.includes('google')
                            && renderer.includes('vulkan')
                            && renderer.includes('subzero');

  // Heuristic: "Hardware accelerated" anywhere in the status means at least
  // one pipeline stage is on the GPU. The most decisive single signal is
  // GL_RENDERER, because SwiftShader's renderer string contains the word
  // "SwiftShader" or "llvmpipe".
  const anyHardware = /hardware accelerated/i.test(result.raw);

  result.swiftshader = looksLikeSwiftShader;
  result.gpuActive = !looksLikeSwiftShader && anyHardware && !renderer.includes('(unknown)');

  if (result.gpuActive) {
    log.info?.('GPU verification PASSED', {
      glRenderer: result.glRenderer,
      rasterization: result.details.rasterization,
      webgl: result.details.webgl
    });
  } else {
    log.warn?.('GPU verification FAILED — Chrome is using CPU rasterization', {
      glRenderer: result.glRenderer,
      swiftshader: looksLikeSwiftShader,
      rasterization: result.details.rasterization,
      webgl: result.details.webgl,
      hint: 'If glRenderer contains "SwiftShader" or "llvmpipe", Chrome silently ' +
            'fell back to CPU. Check that --use-gl=angle --use-angle=vulkan ' +
            '--enable-features=Vulkan --disable-vulkan-surface are all passed ' +
            'and that the NVIDIA Vulkan ICD is installed (apt install libnvidia-gl-525).'
    });
  }

  return result;
}

/**
 * Quick WebGL probe — faster than chrome://gpu, can be run from any page.
 * Returns the UNMASKED_RENDERER_WEBGL string from a throwaway canvas.
 *
 * Useful as a secondary check inside the actual scene page.
 */
async function probeWebGLRenderer(page) {
  try {
    return await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl')
              || canvas.getContext('experimental-webgl');
      if (!gl) return null;
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (!dbg) return gl.getParameter(gl.RENDERER);
      return gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
    });
  } catch {
    return null;
  }
}

/**
 * Convenience: throw a RenderError if GPU is requested but not active.
 */
async function verifyGpuOrThrow(page, logger) {
  const status = await verifyGpu(page, logger);
  if (!status.gpuActive) {
    throw new RenderError(
      'GPU was requested but Chrome is using CPU rasterization (SwiftShader). ' +
      'GL_RENDERER: ' + status.glRenderer,
      {
        glRenderer: status.glRenderer,
        details: status.details,
        fix: 'Install NVIDIA Vulkan ICD: apt install -y libnvidia-gl-525 libvulkan1 ' +
             'vulkan-tools. Verify with: vulkaninfo --summary'
      }
    );
  }
  return status;
}

module.exports = { verifyGpu, probeWebGLRenderer, verifyGpuOrThrow };
