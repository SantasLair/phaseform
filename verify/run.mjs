// Runs harness.html in real Chrome and prints the probe results as JSON.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const logs = [];
page.on('console', m => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', e => logs.push(`pageerror: ${e}`));

await page.goto(pathToFileURL(resolve('harness.html')).href);
await page.waitForFunction(() => window.__results !== null, null, { timeout: 30000 });
const results = await page.evaluate(() => window.__results);
await browser.close();

const out = { date: new Date().toISOString(), results, logs };
writeFileSync('results.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
