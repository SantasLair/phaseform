// Checks docs/SPEC.md "Filters and masks" against Phaser 4 through the reference loader and serializer.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const example = JSON.parse(readFileSync(resolve('../examples/10-filters.phaseform.json'), 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e.stack || e)));
await page.addInitScript((ex) => { window.__example = ex; }, example);
await page.goto(pathToFileURL(resolve('filters-test-harness.html')).href);
await page.waitForFunction(() => window.__results !== null, null, { timeout: 30000 }).catch(() => {});
const r = await page.evaluate(() => window.__results);
await browser.close();
if (!r) { console.log('FAIL harness did not finish', errors); process.exit(1); }

// The serializer omits defaults, so an input field may be missing from the output only when it holds the default.
const DEFAULTS = {
  shadow: { color: '#000000' }, gradientMap: { start: 0, middle: 0.5, end: 1, interpolation: 0, colorSpace: 0 }, vignette: { color: '#000000' }, threshold: { edge1: 0.5, edge2: 0.5, invert: false }
};
const diffs = [];
function compare(id, path, a, b, type) {
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return diffs.push(`${id} ${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
    a.forEach((x, i) => compare(id, `${path}[${i}]`, x, b[i], type));
    return;
  }
  if (a && typeof a === 'object') {
    for (const k of Object.keys(a)) {
      const t = a.type || type;
      if (b && k in b) compare(id, `${path}.${k}`, a[k], b[k], t);
      else if (!(DEFAULTS[t] && JSON.stringify(DEFAULTS[t][k]) === JSON.stringify(a[k]))) diffs.push(`${id} ${path}.${k}: ${JSON.stringify(a[k])} -> missing`);
    }
    for (const k of Object.keys(b || {})) if (!(k in a)) diffs.push(`${id} ${path}.${k}: missing -> ${JSON.stringify(b[k])}`);
    return;
  }
  if (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) > 1e-5 : a !== b) diffs.push(`${id} ${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
}
for (const p of r.filterPairs) compare(p.id, 'filters', p.input, p.output);

let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  ' + JSON.stringify(detail)}`); if (!ok) failures++; };
const px = r.pixels;
const is = (p, rgb) => p && p.every((v, i) => Math.abs(v - rgb[i]) <= 2);
check('the filters example loads without warnings', r.exampleWarnings.length === 0, r.exampleWarnings);
check('serializing reports nothing lossy', r.firstLossy.length === 0, r.firstLossy);
check('every filter field survives load and serialize', r.sameObjectCount && diffs.length === 0, diffs);
check('serialize, load, serialize is stable', r.stable, null);
check('a missing mask source is an error', /missing id "ghost"/.test(r.missingSource || ''), r.missingSource);
check('an unknown filter type warns and later filters still load', r.unknownWarns.some(w => w.includes('sparkle')) && r.unknownKeepsLater, r.unknownWarns);
check('a hidden mask source still masks', is(px.hiddenIn, [255, 0, 0]) && is(px.hiddenOut, [0, 0, 0]), [px.hiddenIn, px.hiddenOut]);
check('a mask on a container clips its children', is(px.contIn, [0, 0, 255]) && is(px.contOut, [0, 0, 0]), [px.contIn, px.contOut]);
check('invert flips the mask', is(px.invLeft, [0, 0, 0]) && is(px.invRight, [255, 0, 0]), [px.invLeft, px.invRight]);
check('active: false skips the filter', is(px.inactive, [255, 0, 0]), px.inactive);
check('an active threshold filter changes the output', !is(px.active, [255, 0, 0]), px.active);
check('blend "multiply" renders red x #3366cc inside an image only', is(px.multiply, [51, 0, 0]) && is(px.multiplyOutside, [0, 0, 0]), [px.multiply, px.multiplyOutside]);
check('no page errors', errors.length === 0, errors);
process.exit(failures ? 1 : 0);
