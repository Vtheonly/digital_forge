/**
 * test-pipeline.js — Basic smoke test for the pipeline
 *
 * Doesn't test the full render (too slow for CI), but verifies:
 *   - Config validation works
 *   - All modules can be required without errors
 *   - Encoder factory picks the right encoder
 *   - Environment detection runs
 *
 * Run: npm test
 */

const path = require('path');
const assert = require('assert');

async function main() {
  console.log('Running smoke tests...\n');

  // 1. Module loading
  console.log('1. Module loading');
  const { Logger } = require('../src/core/Logger');
  const { Config } = require('../src/config/Config');
  const { Pipeline } = require('../src/core/Pipeline');
  const { Setup } = require('../src/core/Setup');
  const { Renderer } = require('../src/core/Renderer');
  const { Encoder } = require('../src/core/Encoder');
  const { createRenderer } = require('../src/core/rendererFactory');
  const { createEncoder } = require('../src/core/encoderFactory');
  const { PlaywrightRenderer } = require('../src/renderers/PlaywrightRenderer');
  const { ParallelPlaywrightRenderer } = require('../src/renderers/ParallelPlaywrightRenderer');
  const { FFmpegEncoder } = require('../src/encoders/FFmpegEncoder');
  const { NVENCEncoder } = require('../src/encoders/NVENCEncoder');
  const { VAAPIEncoder } = require('../src/encoders/VAAPIEncoder');
  const { QSVEncoder } = require('../src/encoders/QSVEncoder');
  const { VideoToolboxEncoder } = require('../src/encoders/VideoToolboxEncoder');
  const { MusicGenerator } = require('../src/audio/MusicGenerator');
  const { GpuMonitor } = require('../src/utils/GpuMonitor');
  const { verifyGpu, probeWebGLRenderer } = require('../src/utils/GpuVerifier');
  const env = require('../src/utils/environment');
  const errors = require('../src/utils/errors');
  const fs = require('../src/utils/fs');
  console.log('   ✓ all modules load (incl. new GpuMonitor, GpuVerifier, ParallelPlaywrightRenderer)');

  // 2. Logger
  console.log('2. Logger');
  const log = new Logger({ level: 'error', color: false });
  log.info('test (should not appear with level=error)');
  log.error('test error (should appear)');
  const child = log.child('test');
  assert.strictEqual(child.name, 'app:test', 'child logger name');
  console.log('   ✓ logger works');

  // 3. Config validation
  console.log('3. Config validation');
  assert.throws(() => new Config({}), /htmlPath is required/, 'should require htmlPath');
  assert.throws(() => new Config({ htmlPath: '/nonexistent' }), /htmlPath not found/);

  // Use the minimal example scene
  const scenePath = path.resolve(__dirname, '..', 'examples', 'minimal-scene.html');
  const config = new Config({ htmlPath: scenePath, logLevel: 'error' });
  assert.strictEqual(config.get('fps'), 15, 'default fps');
  assert.strictEqual(config.get('targetFps'), 60, 'default target fps');
  assert.strictEqual(config.get('encoder'), 'cpu' || 'nvenc' || 'videotoolbox' || 'vaapi', 'auto-selected encoder');
  console.log('   ✓ config validates and auto-selects encoder:', config.get('encoder'));

  // 4. Environment detection
  console.log('4. Environment detection');
  const envInfo = env.detect();
  assert.strictEqual(typeof envInfo.platform, 'string');
  assert.strictEqual(typeof envInfo.isColab, 'boolean');
  assert.strictEqual(typeof envInfo.hasNvidia, 'boolean');
  console.log('   ✓ env detection works:', { platform: envInfo.platform, isColab: envInfo.isColab, hasNvidia: envInfo.hasNvidia });

  // 5. Encoder factory
  console.log('5. Encoder factory');
  const cpuEncoder = createEncoder(new Config({ htmlPath: scenePath, encoder: 'cpu', logLevel: 'error' }), log);
  assert(cpuEncoder instanceof FFmpegEncoder, 'cpu → FFmpegEncoder');
  console.log('   ✓ encoder factory returns correct type:', cpuEncoder.name);

  // 6. Errors
  console.log('6. Error types');
  const { AppError, ConfigError, RenderError, EncodeError } = errors;
  const e1 = new RenderError('frame failed', { frame: 42 });
  assert.strictEqual(e1.code, 'RENDER_ERROR');
  assert.strictEqual(e1.context.frame, 42);
  assert(e1 instanceof AppError);
  console.log('   ✓ error hierarchy works');

  // 7. fs utils
  console.log('7. fs utils');
  assert.strictEqual(typeof fs.humanSize(1024), 'string');
  assert.strictEqual(fs.humanSize(1024), '1.0 KB');
  assert.strictEqual(fs.fileExists('/nonexistent'), false);
  console.log('   ✓ fs utils work');

  // 8. New GPU modules
  console.log('8. New GPU modules (GpuMonitor, GpuVerifier)');
  const mon = new GpuMonitor({ intervalMs: 1000, logger: log });
  assert.strictEqual(typeof mon.start, 'function');
  assert.strictEqual(typeof mon.stop, 'function');
  assert.strictEqual(typeof mon.markPhase, 'function');
  assert.strictEqual(typeof verifyGpu, 'function');
  assert.strictEqual(typeof probeWebGLRenderer, 'function');
  console.log('   ✓ GpuMonitor + GpuVerifier load and expose expected API');

  // 9. Parallel renderer factory selection
  console.log('9. Renderer factory (parallel selection)');
  const serialRenderer = createRenderer(
    new Config({ htmlPath: scenePath, workers: 1, logLevel: 'error' }), log);
  assert(serialRenderer instanceof PlaywrightRenderer, 'workers=1 → PlaywrightRenderer');
  const parallelRenderer = createRenderer(
    new Config({ htmlPath: scenePath, workers: 4, logLevel: 'error' }), log);
  assert(parallelRenderer instanceof ParallelPlaywrightRenderer, 'workers=4 → ParallelPlaywrightRenderer');
  console.log('   ✓ renderer factory selects parallel renderer when workers > 1');

  // 10. New config options
  console.log('10. New config options');
  const cfg = new Config({ htmlPath: scenePath, logLevel: 'error' });
  // workers=0 means "auto" — gets resolved to cpus/2 (capped 1-4) during validation
  assert(cfg.get('workers') >= 1 && cfg.get('workers') <= 4,
    `workers should be auto-resolved to 1-4, got ${cfg.get('workers')}`);
  assert.strictEqual(cfg.get('verifyGpu'), true, 'default verifyGpu = true');
  assert.strictEqual(cfg.get('gpuMonitor'), true, 'default gpuMonitor = true');
  assert.strictEqual(cfg.get('nvencHwupload'), true, 'default nvencHwupload = true');
  // Explicit workers=1 should be preserved
  const cfg2 = new Config({ htmlPath: scenePath, workers: 1, logLevel: 'error' });
  assert.strictEqual(cfg2.get('workers'), 1, 'explicit workers=1 preserved');
  console.log(`   ✓ new config options have correct defaults (workers auto-resolved to ${cfg.get('workers')})`);

  // 11. Chrome GPU flags (the critical fix)
  console.log('11. Chrome GPU flags (critical fix verification)');
  process.env.FORGE_USE_GPU = '1';
  const gpuArgs = env.recommendedChromiumArgs();
  // These flags are always on when FORGE_USE_GPU=1:
  assert(gpuArgs.includes('--use-gl=angle'), 'must include --use-gl=angle (NOT --use-gl=egl)');
  assert(gpuArgs.includes('--enable-gpu-rasterization'), 'must include --enable-gpu-rasterization');
  assert(gpuArgs.includes('--ignore-gpu-blocklist'), 'must include --ignore-gpu-blocklist');
  assert(gpuArgs.includes('--headless=new'), 'must include --headless=new');
  assert(!gpuArgs.includes('--use-gl=egl'), 'must NOT include the broken --use-gl=egl flag');
  // These NVIDIA-specific flags only appear when hasNvidia is true.
  // In this test environment we may or may not have a GPU, so just verify
  // that if hasNvidia is true, the vulkan flags are present.
  if (envInfo.hasNvidia) {
    assert(gpuArgs.includes('--use-angle=vulkan'), 'NVIDIA: must include --use-angle=vulkan');
    assert(gpuArgs.includes('--enable-features=Vulkan'), 'NVIDIA: must include --enable-features=Vulkan');
    assert(gpuArgs.includes('--disable-vulkan-surface'), 'NVIDIA: must include --disable-vulkan-surface');
    assert(gpuArgs.includes('--disable-software-rasterizer'), 'NVIDIA: must include --disable-software-rasterizer');
  }
  delete process.env.FORGE_USE_GPU;
  console.log('   ✓ Chrome GPU flags are correct (Chrome 131+ compatible; --use-gl=egl is gone)');

  console.log('\n✓ All smoke tests passed\n');
}

main().catch(e => {
  console.error('\n✗ Test failed:', e.message);
  console.error(e.stack);
  process.exit(1);
});
