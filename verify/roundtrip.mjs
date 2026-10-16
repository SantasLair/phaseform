// Round-trip conformance test: example scene -> PHASEFORM -> rebuilt scene, compared by rendered pixels.
//   node roundtrip.mjs <examples-public-dir> <out.json> <subfolder-under-src> [more subfolders...]
// For each example: let create() finish, pause the scene, snapshot, serialize, validate against the schema,
// clear the scene, rebuild it from the JSON with the reference loader, snapshot again, count differing pixels.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import Ajv2020 from 'ajv/dist/2020.js';
import { startServer } from './example-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const [publicDirArg, outFile, ...folders] = process.argv.slice(2);
if (!publicDirArg || !outFile || !folders.length) { console.error('usage: node roundtrip.mjs <public-dir> <out.json> <folder>...'); process.exit(2); }
const publicDir = resolve(publicDirArg);
const docsDir = join(here, 'roundtrip-docs');
mkdirSync(docsDir, { recursive: true });

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(JSON.parse(readFileSync(join(here, '..', 'phaseform.schema.json'), 'utf8')));
const validateProject = ajv.compile(JSON.parse(readFileSync(join(here, '..', 'phaseform.project.schema.json'), 'utf8')));
const srv = await startServer(publicDir, ['phaseform-serialize.js', 'phaseform-load.js']);

function listScripts(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listScripts(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

// Runs inside the example page.
const ROUNDTRIP = async () => {
  const g = window.__game;
  if (!g) return { skip: 'no game' };
  if (g.scene.scenes.length !== 1) return { skip: `${g.scene.scenes.length} scenes` };
  const sc = g.scene.scenes[0];
  if (sc.sys.settings.status < 5) return { skip: 'scene not running (status ' + sc.sys.settings.status + ')' };
  const frames = (n) => new Promise((res) => { let i = 0; const f = () => { if (++i >= n) res(); else g.events.once('postrender', f); }; g.events.once('postrender', f); setTimeout(res, 400); });
  const snap = () => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('snapshot timeout')), 4000); g.renderer.snapshot((img) => { clearTimeout(t);
    const go = () => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); res(x.getImageData(0, 0, c.width, c.height)); };
    if (img.complete && img.naturalWidth) go(); else img.onload = go;
  }); });
  g.scene.pause(sc.sys.settings.key);
  await frames(2);
  const A = await snap();
  const { doc, report } = PhaseformSerializer.serialize(sc);
  const json = JSON.parse(JSON.stringify(doc));
  // animations are rebuilt from their definitions as well, so the definitions are tested
  const animations = JSON.parse(JSON.stringify(PhaseformSerializer.animations(g)));
  let loadError = null, warnings = [];
  PhaseformLoader.clear(sc);
  for (const a of animations) g.anims.remove(a.key);
  try { warnings = PhaseformLoader.build(sc, json, { animations }).warnings; } catch (e) { loadError = String(e); }
  await frames(2);
  const B = await snap();
  let diff = 0, big = 0, lit = 0;
  if (A.width !== B.width || A.height !== B.height) diff = -1;
  else for (let i = 0; i < A.data.length; i += 4) {
    if (A.data[i] || A.data[i + 1] || A.data[i + 2]) lit++;
    const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]), Math.abs(A.data[i + 3] - B.data[i + 3]));
    if (d > 0) diff++;
    if (d > 8) big++;
  }
  return { doc: json, animations, report, loadError, warnings, diff, bigDiff: big, lit, pixels: A.width * A.height };
};

const files = folders.flatMap(f => listScripts(join(publicDir, 'src', f))).sort();
console.log(`${files.length} examples`);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const results = new Array(files.length);
let next = 0;

async function runOne(i) {
  const rel = files[i].slice(publicDir.length + 1).split(sep).join('/');
  const r = { id: i, path: rel };
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  try {
    await page.goto(`${srv.base}/__run?src=${encodeURIComponent(rel)}`, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(1500);
    const out = await Promise.race([page.evaluate(ROUNDTRIP), new Promise((_, rej) => setTimeout(() => rej(new Error('example timeout (15s)')), 15000))]);
    Object.assign(r, out);
    if (out.doc) {
      r.schemaValid = validate(out.doc);
      if (!r.schemaValid) r.schemaErrors = validate.errors.slice(0, 3).map(e => `${e.instancePath} ${e.message}`);
      const project = { format: 'phaseform-project', version: '0.1.0', name: 'roundtrip', entry: out.doc.key, scenes: [{ key: out.doc.key, path: 'scene.json' }], assets: [], animations: out.animations };
      if (!validateProject(project)) { r.schemaValid = false; r.schemaErrors = (r.schemaErrors || []).concat(validateProject.errors.slice(0, 3).map(e => `project${e.instancePath} ${e.message}`)); }
      r.animationCount = out.animations.length;
      delete r.animations;
      r.objectCount = JSON.stringify(out.doc).split('"id"').length - 1;
      writeFileSync(join(docsDir, `${String(i).padStart(4, '0')}.phaseform.json`), JSON.stringify(out.doc, null, 2));
      delete r.doc;
    }
  } catch (e) {
    r.error = String(e).slice(0, 300);
  }
  if (errors.length) r.pageErrors = errors;
  await page.close();
  r.status = r.skip ? 'skipped' : r.error || r.loadError ? 'error' : !r.schemaValid ? 'schema-invalid'
    : r.report.codeDriven.length ? 'code-driven'
    : r.diff !== 0 ? 'diff' : r.lit === 0 ? 'blank-frame' : r.report.unsupported.length || r.report.lossy.some(l => !l.benign) ? 'exact-but-lossy' : 'exact';
  results[i] = r;
}

async function worker() {
  while (next < files.length) {
    const i = next++;
    await runOne(i);
    console.log(`${String(i + 1).padStart(3)}/${files.length} ${results[i].status.padEnd(15)} ${files[i].split(/[\/]/).pop()}`);
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
await browser.close();
srv.close();

const summary = {};
for (const r of results) summary[r.status] = (summary[r.status] || 0) + 1;
writeFileSync(join(here, outFile), JSON.stringify({ date: new Date().toISOString(), phaser: '4.2.1', publicDir, folders, summary, results }, null, 1));
console.log(JSON.stringify(summary));
