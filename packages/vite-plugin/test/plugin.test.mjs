import assert from 'node:assert/strict';
import { build } from 'vite';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import phaseform from '../src/index.mjs';

const fx = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'cli', 'test', 'fixture');
const tmp = mkdtempSync(join(tmpdir(), 'phaseform-vite-'));
const entry = join(tmp, 'main.js');
writeFileSync(entry, "import { project, scenes, scripts } from 'virtual:phaseform'; console.log(project.assets[0].url, scenes.Main.objects.length, Object.keys(scripts));");
const out = join(tmp, 'dist');
await build({
  root: tmp, logLevel: 'silent', plugins: [phaseform({ project: join(fx, 'phaseform.project.json') })],
  build: { outDir: out, minify: false, assetsInlineLimit: 0, rollupOptions: { input: entry, output: { entryFileNames: 'bundle.js' } } },
  server: { fs: { strict: false } },
});
const js = readFileSync(join(out, 'bundle.js'), 'utf8');
if (process.env.KEEP) console.log(js);
const assets = readdirSync(join(out, 'assets'));
assert.ok(assets.some(f => /^hero.*\.png$/.test(f)), `hero.png emitted: ${assets}`);
assert.ok(!js.includes('placeholder'), 'placeholder stripped in a build');
assert.ok(js.includes('scripts/bar.js') && js.includes('fillRect'), 'script bundled via the registry');
assert.ok(/"url": ?[a-z]/i.test(js) || /url: ?[a-z]/i.test(js), 'asset url is an import, not a literal path');
console.log('PASS vite build bundles scenes, scripts and assets');
if (process.env.KEEP) console.log(js);
rmSync(tmp, { recursive: true, force: true });
