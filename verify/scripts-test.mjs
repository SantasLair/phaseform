// Checks docs/SPEC.md "Scripts and code-driven objects" against Phaser 4 through the reference loader.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(pathToFileURL(resolve('scripts-harness.html')).href);
await page.waitForFunction(() => window.__results !== null, null, { timeout: 30000 });
const r = await page.evaluate(() => window.__results);
await browser.close();

let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  ' + JSON.stringify(detail)}`); if (!ok) failures++; };
const a = r.log.filter(l => l[0] === 'a.create');
check('graphics objects are created', r.types.join() === 'Graphics,Graphics,Graphics', r.types);
check('create runs after every object exists', a.length === 2 && a.every(l => l[3] === 3), a);
check('create receives position, params and size', a[0][1] === 50 && a[0][2] === '{"params":{"max":100},"size":{"width":200,"height":16}}', a[0]);
check('size is null without a placeholder, params default to {}', a[1][2] === '{"params":{},"size":null}', a[1]);
check('ctx is also object.getData("phaseform")', r.sameCtx === true, r.sameCtx);
check('scripts run in list order', r.log.map(l => l[0]).join() === 'a.create,b.create,a.create', r.log);
check('a missing module warns and does not throw', r.warnings.some(w => w.includes('missing.js')), r.warnings);
check('update runs every frame', r.aUpdates > 10, r.aUpdates);
check('update is skipped while the object is inactive', !r.inactiveUpdates, r.inactiveUpdates);
check('the placeholder is not drawn', r.pixelUnderPlaceholder.r === 0 && r.pixelUnderPlaceholder.g === 0 && r.pixelUnderPlaceholder.b === 0, r.pixelUnderPlaceholder);
check('the loader adds no draw commands beyond a fresh Graphics', r.commandsDrawn.every(n => n === r.baselineCommands), [r.baselineCommands, r.commandsDrawn]);
check('graphics serialize as graphics nodes, flagged code-driven, no placeholder', r.serialized.every(o => o.type === 'graphics' && !o.hasPlaceholder) && r.codeDriven === 3, r.serialized);
check('no page errors', errors.length === 0, errors);
process.exit(failures ? 1 : 0);
