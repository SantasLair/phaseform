// Runs a filters probe page (default filters-harness.html; also filters2-, filters3-, filters4-harness.html) in real Chrome and prints its results as JSON.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e.stack || e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(resolve(process.argv[2] || 'filters-harness.html')).href);
try {
  await page.waitForFunction(() => window.__results !== null, null, { timeout: 30000 });
  console.log(JSON.stringify(await page.evaluate(() => window.__results), null, 1));
} catch (e) { console.log('timed out'); }
console.log(errors);
await browser.close();
