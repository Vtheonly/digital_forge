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
  const { FFmpegEncoder } = require('../src/encoders/FFmpegEncoder');
  const { NVENCEncoder } = require('../src/encoders/NVENCEncoder');
  const { VAAPIEncoder } = require('../src/encoders/VAAPIEncoder');
  const { QSVEncoder } = require('../src/encoders/QSVEncoder');
  const { VideoToolboxEncoder } = require('../src/encoders/VideoToolboxEncoder');
  const { MusicGenerator } = require('../src/audio/MusicGenerator');
  const env = require('../src/utils/environment');
  const errors = require('../src/utils/errors');
  const fs = require('../src/utils/fs');
  console.log('   ✓ all modules load');

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

  console.log('\n✓ All smoke tests passed\n');
}

main().catch(e => {
  console.error('\n✗ Test failed:', e.message);
  console.error(e.stack);
  process.exit(1);
});
