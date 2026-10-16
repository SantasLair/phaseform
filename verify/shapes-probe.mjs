// Runs shapes-harness.html in real Chrome and prints the probe results as JSON.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(pathToFileURL(resolve('shapes-harness.html')).href);
await page.waitForFunction(() => window.__results !== null, null, { timeout: 30000 });
console.log(JSON.stringify(await page.evaluate(() => window.__results), null, 1), errors);
await browser.close();
