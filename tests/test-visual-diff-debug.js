#!/usr/bin/env node
/**
 * test-visual-diff-debug.js — Save diff images to inspect where parallel
 * renderer differs from serial.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { Logger } = require('../src/core/Logger');
const { Config } = require('../src/config/Config');
const { PlaywrightRenderer } = require('../src/renderers/PlaywrightRenderer');
const { ParallelPlaywrightRenderer } = require('../src/renderers/ParallelPlaywrightRenderer');

const SCENE = path.join(__dirname, '..', 'scenes', 'digital-forge-reel-en.html');
const OUT_DIR = path.join(os.tmpdir(), 'forge-diff-' + Date.now());

async function captureSerial(frameIndices, framesDir) {
  const logger = new Logger({ level: 'warn', name: 'serial' });
  const config = new Config({
    htmlPath: SCENE, framesDir, fps: 15,
    width: 1080, height: 1920, captureScale: 0.25,
    frameFormat: 'png', resumeFromDisk: false,
    useGpu: false, verifyGpu: false
  });
  const r = new PlaywrightRenderer(config, logger);
  await r.init();
  try {
    for (const i of frameIndices) {
      await r.renderFrame(i / 15, path.join(framesDir, `serial_${i}.png`));
    }
  } finally { await r.close(); }
}

async function captureParallel(frameIndices, framesDir) {
  const logger = new Logger({ level: 'warn', name: 'parallel' });
  const config = new Config({
    htmlPath: SCENE, framesDir, fps: 15,
    width: 1080, height: 1920, captureScale: 0.25,
    frameFormat: 'png', resumeFromDisk: false,
    useGpu: false, verifyGpu: false, workers: 2
  });
  const r = new ParallelPlaywrightRenderer(config, logger);
  await r.init();
  try {
    await r._renderFramesInRange(frameIndices, framesDir);
  } finally { await r.close(); }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('Out dir:', OUT_DIR);

  const frames = [0, 5, 10, 15, 20, 25];
  await captureSerial(frames, OUT_DIR);
  await captureParallel(frames, OUT_DIR);

  // Build diff PNG for each frame using ffmpeg mix filter
  const { exec } = require('../src/utils/exec');
  for (const i of frames) {
    const a = path.join(OUT_DIR, `serial_${i}.png`);
    const b = path.join(OUT_DIR, `frame_${String(i).padStart(5, '0')}.png`);
    const diff = path.join(OUT_DIR, `diff_${i}.png`);
    if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
    // Amplify diff 10x so it's visible
    await exec(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
      '-i', a, '-i', b,
      '-filter_complex', '[0][1]blend=difference:enable=1[scaled];[scaled]eq=contrast=10:brightness=0[out]',
      '-map', '[out]', diff]);
    console.log(`Wrote diff_${i}.png`);
  }
  console.log('Done. Inspect diff_*.png to see where differences are.');
}

main().catch(e => { console.error(e); process.exit(1); });
