// Runs Phaser examples unmodified on the local Phaser 4 build and records what each scene contains.
//   node survey.mjs <examples-public-dir> <out.json> <subfolder-under-src> [more subfolders...]
// Example: node survey.mjs E:/ThirdParty/examples/public survey-results.json "game objects/images" "game objects/text"
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';

import { join, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServer } from './example-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const [publicDirArg, outFile, ...folders] = process.argv.slice(2);
if (!publicDirArg || !outFile || !folders.length) { console.error('usage: node survey.mjs <public-dir> <out.json> <folder>...'); process.exit(2); }
const publicDir = resolve(publicDirArg);
const shotsDir = join(here, 'survey-shots');
mkdirSync(shotsDir, { recursive: true });

const srv = await startServer(publicDir);
const base = srv.base;

function listScripts(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listScripts(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

// Static source signals: behavior and API areas the scene data cannot express.
const SIGNALS = {
  tweens: /\.tweens\.(add|chain|addCounter|timeline)/,
  input: /\.input\.|setInteractive|\.keyboard/,
  animations: /\.anims\.|\.play\(|createFromConfig/,
  physics: /\.physics\.|physics:/,
  timers: /\.time\.(addEvent|delayedCall)|setTimeout|setInterval/,
  cameraMotion: /cameras\.(main|add)[^;]*\.(scroll|zoom|startFollow|shake|fade|flash|pan|rotate)/,
  random: /Math\.Between|Phaser\.Math\.(Between|FloatBetween|RND)|Math\.random|Utils\.Array\.Shuffle/,
  updateLoop: /^\s*update\s*\(/m,
  filters: /\.filters\b|addMask|\.preFX|\.postFX|setPipeline|setPostPipeline/,
  lighting: /setLighting|lights\./,
  externalLibs: /dat\.GUI|datgui|new Tweakpane|jQuery|\$\(/,
  groups: /\.add\.group|\.physics\.add\.group|createMultiple/,
  loops: /\bfor\s*\(|\.forEach\(|\.map\(|\.times\(/
};

const INTROSPECT = () => {
  const g = window.__game;
  if (!g) return { game: false };
  const DEF = { originX: 0.5, originY: 0.5 };
  const scenes = [];
  for (const sc of g.scene.scenes) {
    const counts = {};
    const props = {};
    const mark = (k) => { props[k] = (props[k] || 0) + 1; };
    const walk = (list) => {
      for (const o of list) {
        counts[o.type] = (counts[o.type] || 0) + 1;
        if (o.originX !== undefined && (o.originX !== (o.type === 'Text' ? 0 : 0.5) || o.originY !== (o.type === 'Text' ? 0 : 0.5)) && o.type !== 'Container') mark('origin');
        if (o.isTinted) mark('tint');
        if (o.tintMode) mark('tintMode');
        if (o.rotation) mark('rotation');
        if (o.scaleX !== undefined && (o.scaleX !== 1 || o.scaleY !== 1)) mark('scale');
        if (o.alpha !== undefined && o.alpha !== 1) mark('alpha');
        if (o.visible === false) mark('visible=false');
        if (o.depth) mark('depth');
        if (o.scrollFactorX !== undefined && (o.scrollFactorX !== 1 || o.scrollFactorY !== 1)) mark('scrollFactor');
        if (o.blendMode) mark('blendMode');
        if (o.flipX || o.flipY) mark('flip');
        if (o.name) mark('name');
        if (o.data) mark('data');
        if (o.input) mark('input');
        if (o.body) mark('physicsBody');
        if (o.mask) mark('mask');
        if (o.filters && ((o.filters.internal && o.filters.internal.list && o.filters.internal.list.length) || (o.filters.external && o.filters.external.list && o.filters.external.list.length))) mark('filters');
        if (o.frame && o.frame.name !== undefined && o.frame.name !== '__BASE' && o.frame.name !== 0) mark('frame');
        if (o.anims && o.anims.isPlaying) mark('animPlaying');
        if (o.list) walk(o.list);
      }
    };
    try { walk(sc.children.list); } catch (e) { counts.__walkError = String(e); }
    scenes.push({
      key: sc.sys.settings.key,
      status: sc.sys.settings.status,
      counts, props,
      hasUpdate: typeof sc.update === 'function' && sc.update !== Phaser.Scene.prototype.update,
      tweens: (() => { try { return sc.tweens.getTweens().length; } catch (e) { return -1; } })(),
      timers: (() => { try { return sc.time._active.length; } catch (e) { return -1; } })(),
      camera: { w: sc.cameras.main.width, h: sc.cameras.main.height, scrollX: sc.cameras.main.scrollX, scrollY: sc.cameras.main.scrollY, zoom: sc.cameras.main.zoom }
    });
  }
  return {
    game: true,
    size: { w: g.scale.gameSize.width, h: g.scale.gameSize.height },
    renderer: g.renderer && g.renderer.type,
    background: g.config.backgroundColor && g.config.backgroundColor.rgba,
    animations: g.anims.anims.size,
    scenes
  };
};

const files = folders.flatMap(f => listScripts(join(publicDir, 'src', f))).sort();
console.log(`${files.length} examples`);

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const results = new Array(files.length);
let next = 0;

async function runOne(i) {
  const file = files[i];
  const rel = file.slice(publicDir.length + 1).split(sep).join('/');
  const source = readFileSync(file, 'utf8');
  const signals = Object.fromEntries(Object.entries(SIGNALS).map(([k, re]) => [k, re.test(source)]));
  const r = { id: i, path: rel, lines: source.split('\n').length, signals, status: 'ok', errors: [], warnings: [], failedRequests: [] };
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on('console', m => { const t = m.text(); if (m.type() === 'error') { if (!/Failed to load resource/.test(t)) r.errors.push(t.slice(0, 300)); } else if (m.type() === 'warning' && !/GPU stall|GL Driver/.test(t)) r.warnings.push(t.slice(0, 300)); });
  page.on('pageerror', e => r.errors.push(String(e).slice(0, 300)));
  page.on('response', resp => { if (resp.status() >= 400) r.failedRequests.push(resp.url().replace(base, '').slice(0, 200)); });
  try {
    await page.goto(`${base}/__run?src=${encodeURIComponent(rel)}`, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(1800);
    r.scene = await page.evaluate(INTROSPECT);
    await page.screenshot({ path: join(shotsDir, `${String(i).padStart(4, '0')}.png`) });
    if (!r.scene.game) r.status = 'no-game';
    else if (r.errors.length) r.status = 'error';
  } catch (e) {
    r.status = 'timeout-or-crash';
    r.errors.push(String(e).slice(0, 300));
  }
  await page.close();
  results[i] = r;
}

async function worker() {
  while (next < files.length) {
    const i = next++;
    await runOne(i);
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${files.length}`);
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
await browser.close();
srv.close();

const summary = {};
for (const r of results) summary[r.status] = (summary[r.status] || 0) + 1;
writeFileSync(join(here, outFile), JSON.stringify({ date: new Date().toISOString(), phaser: '4.2.1', publicDir, folders, summary, results }, null, 1));
console.log(JSON.stringify(summary));
