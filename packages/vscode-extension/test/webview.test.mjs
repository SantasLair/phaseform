// Loads the editor page in real Chrome with a stubbed VS Code API, and drives it with the mouse and keyboard.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, extname, resolve } from 'node:path';
import assert from 'node:assert/strict';

const { html } = createRequire(import.meta.url)('../src/html.js');
const ext = resolve(import.meta.dirname, '..');
const sample = resolve(ext, '../../samples/coin-run');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }).end(html({ cspSource: "'self'", nonce: 'n', uris: { css: '/media/editor.css', phaser: '/media/vendor/phaser.min.js', loader: '/media/vendor/phaseform-load.js', editor: '/media/editor.js' } }).replaceAll("nonce-n", "nonce-n")); return; }
  const f = u.startsWith('/sample/') ? join(sample, u.slice(8)) : join(ext, u);
  if (!existsSync(f)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[extname(f)] ?? 'text/plain' }).end(readFileSync(f));
}).listen(0);
const base = `http://localhost:${srv.address().port}`;

const project = JSON.parse(readFileSync(join(sample, 'phaseform.project.json'), 'utf8'));
for (const a of project.assets) a.url = `${base}/sample/${a.url}`;
const doc = JSON.parse(readFileSync(join(sample, 'scenes/main.phaseform.json'), 'utf8'));
doc.objects.push({ id: 'panel', type: 'container', x: 60, y: 60, children: [{ id: 'chip', type: 'rectangle', width: 40, height: 20, x: 10, y: 5, fill: { color: '#ff3366' } }] });

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(() => { window.__sent = []; window.acquireVsCodeApi = () => ({ postMessage: (m) => window.__sent.push(m) }); });
await page.goto(base + '/');
await page.evaluate(([doc, project]) => window.postMessage({ type: 'load', doc, project, problems: [] }, '*'), [doc, project]);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await page.waitForTimeout(300);

let n = 0; const t = (name, ok, detail) => { assert.ok(ok, name + (detail ? ' ' + JSON.stringify(detail) : '')); console.log('PASS ' + name); n++; };
const sent = () => page.evaluate(() => window.__sent.splice(0));
const toScreen = (x, y) => page.evaluate(([x, y]) => { const r = window.__editor.game.canvas.getBoundingClientRect(); return { x: r.left + x * r.width / window.__editor.doc.size.width, y: r.top + y * r.height / window.__editor.doc.size.height }; }, [x, y]);

t('the tree lists every object, children included', (await page.locator('#tree .row').allTextContents()).join('|').includes('chip'));
t('sent ready on startup', (await sent()).some(m => m.type === 'ready'));

let p = await toScreen(160, 100);          // the coin (a sprite at 160,100, scale 3)
await page.mouse.click(p.x, p.y);
t('clicking an object selects it', await page.evaluate(() => window.__editor.selected) === 'coin');
t('the properties panel shows it', (await page.locator('#props h3').textContent()).startsWith('coin'));

await sent();
await page.mouse.move(p.x, p.y); await page.mouse.down();
const q = await toScreen(180, 110);
await page.mouse.move((p.x + q.x) / 2, (p.y + q.y) / 2); await page.mouse.move(q.x, q.y); await page.mouse.up();
const drag = (await sent()).find(m => m.type === 'set-many');
t('dragging sends the new position', drag && drag.id === 'coin' && drag.values[0].value === 180 && drag.values[1].value === 110, drag);

p = await toScreen(70, 65);                // inside the chip (child of panel, which sits at 60,60 + 10,5)
await page.mouse.click(p.x, p.y);
t('a child inside a container can be picked', await page.evaluate(() => window.__editor.selected) === 'chip');
await sent();
await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 20, p.y + 10); await page.mouse.move(p.x + 40, p.y + 20); await page.mouse.up();
const cd = (await sent()).find(m => m.type === 'set-many');
const zoom = await page.evaluate(() => window.__editor.game.canvas.getBoundingClientRect().width / window.__editor.doc.size.width);
t('dragging a child sends container-local coordinates (screen delta / zoom, plus the old local position)', cd && cd.values[0].value === Math.round(10 + 40 / zoom) && cd.values[1].value === Math.round(5 + 20 / zoom), { cd, zoom });

await page.locator('#tree .row', { hasText: 'title' }).click();
t('clicking the tree selects', await page.evaluate(() => window.__editor.selected) === 'title');
await sent();
await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowDown');
const keys = await sent();
t('arrow keys nudge by 1, shift by 10', keys[0].values[0].value === 161 && keys[1].values[1].value === 30, keys);

await page.locator('#props label', { hasText: 'alpha' }).locator('input').fill('0.5');
await page.locator('#props label', { hasText: 'alpha' }).locator('input').press('Tab');
const form = (await sent()).find(m => m.type === 'set');
t('a form field sends a set', form && form.id === 'title' && form.path[0] === 'alpha' && form.value === 0.5, form);

await page.locator('#tree .row', { hasText: 'title' }).click();
await page.keyboard.press('Delete');
t('Delete sends a remove', (await sent()).some(m => m.type === 'remove' && m.id === 'title'));

doc.objects[1].x = 40;
await page.evaluate((doc) => window.postMessage({ type: 'load', doc, project: null, problems: ['x: bad'] }, '*'), doc);
await page.waitForTimeout(300);
t('a changed document re-renders, keeping the selection', await page.evaluate(() => window.__editor.ids.get('coin').x) === 40);
t('problems show in the status bar', (await page.locator('#status').textContent()).includes('1 problem'));

if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
await browser.close(); srv.close();
t('no page errors', errors.length === 0, errors);
console.log(`${n} passed`);
