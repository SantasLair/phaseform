// Reference-implementation runner for the load cases. `node run-load.mjs` checks, `node run-load.mjs --update` writes `expect`.
import { chromium } from 'playwright-core';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const dir = join(import.meta.dirname, 'load');
const update = process.argv.includes('--update');
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let failures = 0;
for (const f of readdirSync(dir).filter(f => f.endsWith('.case.json') && (!process.env.ONLY || f.startsWith(process.env.ONLY))).sort()) {
  const c = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(pathToFileURL(join(import.meta.dirname, 'load-harness.html')).href);
  const got = await Promise.race([page.evaluate((c) => window.runCase(c), c), new Promise(r => setTimeout(() => r({ timeout: errors }), 20000))]);
  await page.close();
  if (update) { c.expect = got; writeFileSync(join(dir, f), JSON.stringify(c, null, 1) + '\n'); console.log(`WROTE ${f}`); continue; }
  try { assert.deepEqual(errors, []); assert.deepEqual(got, c.expect); console.log(`PASS ${f}`); }
  catch (e) { failures++; console.log(`FAIL ${f}\n${e.message.slice(0, 1200)}`); }
}
await browser.close();
process.exit(failures ? 1 : 0);
