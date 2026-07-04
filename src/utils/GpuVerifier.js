/**
 * GpuVerifier.js — Verify that Chrome is actually using the GPU
 *
 * Rather than loading the heavy, privileged chrome://gpu page, we use a
 * high-performance WebGL canvas context probe. This is instant (<10ms) and
 * bypasses Playwright security blocks.
 */

const { RenderError } = require('../utils/errors');

/**
 * Verify the GPU is active by probing a WebGL context directly.
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
    swiftshader: true,
    details: {
      webgl: 'Unverified'
    }
  };

  try {
    // Direct, ultra-fast WebGL probe inside a blank page context
    const probe = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return { err: 'No WebGL context' };

      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (!dbg) return { renderer: gl.getParameter(gl.RENDERER) };

      return {
        vendor: gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL),
        renderer: gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
      };
    });

    if (probe && probe.renderer) {
      result.glRenderer = probe.renderer;
      const rendererLower = probe.renderer.toLowerCase();

      // Check if it is falling back to software (SwiftShader / llvmpipe)
      const isSoftware = rendererLower.includes('swiftshader') || 
                         rendererLower.includes('llvmpipe') ||
                         rendererLower.includes('softpipe') ||
                         (rendererLower.includes('google') && rendererLower.includes('vulkan') && rendererLower.includes('subzero'));

      result.swiftshader = isSoftware;
      result.gpuActive = !isSoftware;
      result.details.webgl = result.gpuActive ? 'Hardware accelerated' : 'Software only';
    } else if (probe && probe.err) {
      result.details.webgl = probe.err;
    }
  } catch (e) {
    log.warn?.('verifyGpu: WebGL canvas probe failed', { err: e.message });
    return result;
  }

  if (result.gpuActive) {
    log.info?.('GPU verification PASSED', {
      glRenderer: result.glRenderer,
      webgl: result.details.webgl
    });
  } else {
    log.warn?.('GPU verification FAILED — Chrome is using CPU rasterization', {
      glRenderer: result.glRenderer,
      swiftshader: result.swiftshader,
      hint: 'If glRenderer contains "SwiftShader" or "llvmpipe", Chrome silently ' +
            'fell back to CPU. Verify that the NVIDIA Vulkan ICD is installed.'
    });
  }

  return result;
}

async function probeWebGLRenderer(page) {
  try {
    return await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return null;
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (!dbg) return gl.getParameter(gl.RENDERER);
      return gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
    });
  } catch {
    return null;
  }
}

async function verifyGpuOrThrow(page, logger) {
  const status = await verifyGpu(page, logger);
  if (!status.gpuActive) {
    throw new RenderError(
      'GPU was requested but Chrome is using CPU rasterization (SwiftShader). GL_RENDERER: ' + status.glRenderer,
      { glRenderer: status.glRenderer }
    );
  }
  return status;
}

module.exports = { verifyGpu, probeWebGLRenderer, verifyGpuOrThrow };