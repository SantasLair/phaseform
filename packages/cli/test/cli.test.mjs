import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProject, buildProject, registrySource } from '../src/project.mjs';

const fx = join(dirname(fileURLToPath(import.meta.url)), 'fixture');
const tmp = mkdtempSync(join(tmpdir(), 'phaseform-cli-'));
let n = 0;
const t = (name, fn) => { fn(); console.log(`PASS ${name}`); n++; };

t('fixture validates', () => {
  const r = validateProject(join(fx, 'phaseform.project.json'));
  assert.deepEqual(r.errors, []); assert.deepEqual(r.warnings, []);
});
t('build strips placeholder only, writes registry, copies scripts and assets', () => {
  const out = join(tmp, 'out');
  const r = buildProject(join(fx, 'phaseform.project.json'), out);
  assert.deepEqual(r.errors, []);
  const scene = JSON.parse(readFileSync(join(out, 'scenes/main.phaseform.json'), 'utf8'));
  assert.equal(scene.objects[1].placeholder, undefined);
  assert.deepEqual(scene.objects[1].scripts, ['scripts/bar.js']);
  assert.equal(scene.objects[0].x, 10);
  assert.equal(readFileSync(join(out, 'phaseform.registry.js'), 'utf8'), registrySource(['scripts/bar.js']));
  assert.ok(existsSync(join(out, 'scripts/bar.js')) && existsSync(join(out, 'assets/hero.png')));
  assert.deepEqual(validateProject(join(out, 'phaseform.project.json')).errors, []); // a stripped build is still valid
});
t('missing script is an error and nothing is written', () => {
  const copy = join(tmp, 'broken');
  cpSync(fx, copy, { recursive: true });
  rmSync(join(copy, 'scripts/bar.js'));
  const out = join(tmp, 'out2');
  const r = buildProject(join(copy, 'phaseform.project.json'), out);
  assert.ok(r.errors.some(e => e.includes('script not found: scripts/bar.js')));
  assert.equal(existsSync(out), false);
});
rmSync(tmp, { recursive: true, force: true });
console.log(`${n} passed`);
