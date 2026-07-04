#!/usr/bin/env node
/**
 * Test that Chrome can launch with the new GPU flags (no actual GPU needed).
 * This is a smoke test to verify the flags don't crash Chrome.
 */
process.env.FORGE_USE_GPU = '1';
process.env.FORGE_FORCE_NVIDIA = '1';  // For testing — pretend we have NVIDIA

const { chromium } = require('playwright');
const env = require('../src/utils/environment');

(async () => {
  const e = env.detect();
  console.log('Environment:', { isLinux: e.isLinux, hasNvidia: e.hasNvidia });

  const args = env.recommendedChromiumArgs();
  console.log('Args:', args);

  const executablePath = env.findChromium();
  console.log('Executable:', executablePath);

  let browser;
  try {
    browser = await chromium.launch({ args, headless: true, executablePath });
    console.log('✓ Chrome launched successfully with GPU flags');

    const page = await browser.newPage();
    await page.goto('about:blank');
    console.log('✓ Page navigation works');

    // Try chrome://gpu — should work since we added --allow-chrome-scheme-url
    try {
      await page.goto('chrome://gpu', { waitUntil: 'domcontentloaded', timeout: 5000 });
      const text = await page.evaluate(() => document.body.innerText.slice(0, 500));
      console.log('✓ chrome://gpu accessible');
      console.log('chrome://gpu first 500 chars:');
      console.log(text);
    } catch (e) {
      console.log('⚠ chrome://gpu navigation failed:', e.message);
    }

    await browser.close();
    console.log('✓ Chrome closed cleanly');
  } catch (e) {
    console.log('✗ Chrome launch failed:', e.message);
    if (browser) await browser.close();
    process.exit(1);
  }
})();
