// Serves the built game (npm run build first) and checks it renders in real Chrome.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const dist = join(import.meta.dirname, 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const srv = createServer((req, res) => {
  const f = join(dist, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (req.url === '/favicon.ico') { res.writeHead(204).end(); return; }
  if (!existsSync(f)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }).end(readFileSync(f));
}).listen(0);
const url = `http://localhost:${srv.address().port}/`;

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const problems = [];
page.on('pageerror', e => problems.push(String(e)));
page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') problems.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await page.waitForTimeout(1200);
const shot = async () => (await page.locator('canvas').screenshot()).toString('base64');
const a = await shot();
await page.waitForTimeout(400);
const b = await shot();
if (process.env.SHOT) await page.locator('canvas').screenshot({ path: process.env.SHOT });
await browser.close(); srv.close();

const check = (ok, name) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) process.exitCode = 1; };
check(problems.length === 0, `no warnings or errors${problems.length ? ': ' + problems.join(' | ') : ''}`);
check(a !== b, 'the frame changes over time (coin animation and timer bar)');
