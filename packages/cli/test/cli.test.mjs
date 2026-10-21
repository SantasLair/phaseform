import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProject, buildProject, registrySource, sidecarPath } from '../src/project.mjs';

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

// ---- script params (docs/SPEC.md, "Script params")
let copies = 0;
// A copy of the fixture whose `bar` object gets `params` and an optional sidecar (a schema object, or raw text).
const withParams = ({ sidecar, params, scripts }) => {
  const dir = join(tmp, `p${copies++}`);
  cpSync(fx, dir, { recursive: true });
  const file = join(dir, 'scenes/main.phaseform.json');
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  if (params !== undefined) doc.objects[1].params = params;
  if (scripts) { doc.objects[1].scripts = scripts; for (const s of scripts) if (s !== 'scripts/bar.js') cpSync(join(fx, 'scripts/bar.js'), join(dir, s)); }
  writeFileSync(file, JSON.stringify(doc));
  if (sidecar !== undefined) writeFileSync(join(dir, 'scripts/bar.params.json'), typeof sidecar === 'string' ? sidecar : JSON.stringify(sidecar));
  return join(dir, 'phaseform.project.json');
};
const schema = (properties, extra = {}) => ({ type: 'object', properties, ...extra });
const result = (o) => validateProject(withParams(o));

t('sidecar path replaces the last extension', () => {
  assert.equal(sidecarPath('scripts/health-bar.js'), 'scripts/health-bar.params.json');
  assert.equal(sidecarPath('a.b/c.d.ts'), 'a.b/c.d.params.json');
});
t('a valid sidecar gives defaults, no warnings, and notes for params without a description', () => {
  const r = result({ params: { speed: 3 }, sidecar: schema({
    speed: { type: 'number', default: 1, minimum: 0, description: 'Pixels per frame.' },
    color: { type: 'string', format: 'color', default: '#ffcc33' },
  }) });
  assert.deepEqual(r.errors, []); assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.paramDefaults, { 'scripts/bar.js': { speed: 1, color: '#ffcc33' } });
  assert.deepEqual(r.notes, ['scripts/bar.params.json: param "color" has no description']);
});
t('no sidecar: no defaults, no checks', () => {
  const r = result({ params: { anything: [1, 'x'] } });
  assert.deepEqual(r.errors, []); assert.deepEqual(r.warnings, []); assert.deepEqual(r.paramDefaults, {});
});
t('params that do not fit are warnings, not errors', () => {
  const r = result({ params: { speed: -2, color: 'red', mode: 'sideways', extra: 1 }, sidecar: schema({
    speed: { type: 'number', minimum: 0 }, color: { type: 'string', format: 'color' }, mode: { enum: ['drain', 'fill'] }, n: { type: 'integer' },
  }, { required: ['n'], additionalProperties: false }) });
  assert.deepEqual(r.errors, []);
  const w = r.warnings.join('\n');
  for (const part of ['param "speed"', 'param "color"', 'param "mode"', 'param "n" is required', 'param "extra" is not described']) assert.ok(w.includes(part), `${part} in:\n${w}`);
  assert.equal(r.warnings.length, 5);
});
t('a required param satisfied by its default is not reported; an unknown key is allowed unless every script is closed', () => {
  const open = result({ params: { extra: 1 }, sidecar: schema({ n: { type: 'integer', default: 2 } }, { required: ['n'] }) });
  assert.deepEqual(open.warnings, []);
  const mixed = result({ params: { extra: 1 }, scripts: ['scripts/bar.js', 'scripts/other.js'], sidecar: schema({ n: { type: 'integer' } }, { additionalProperties: false }) });
  assert.deepEqual(mixed.warnings, []); // other.js has no sidecar and may read "extra"
});
t('a default is applied across scripts in list order', () => {
  const dir = withParams({ scripts: ['scripts/bar.js', 'scripts/other.js'], sidecar: schema({ n: { type: 'integer', default: 1 } }) });
  writeFileSync(join(dir, '../scripts/other.params.json'), JSON.stringify(schema({ n: { type: 'integer', default: 9 }, m: { type: 'boolean', default: true } })));
  const r = validateProject(dir);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.paramDefaults, { 'scripts/bar.js': { n: 1 }, 'scripts/other.js': { n: 9, m: true } });
});
t('a broken sidecar is an error', () => {
  assert.ok(result({ sidecar: '{ nope' }).errors.some(e => e.startsWith('scripts/bar.params.json:')));
  assert.ok(result({ sidecar: { type: 'object' } }).errors.length > 0); // properties is required
  assert.ok(result({ sidecar: schema({ n: { type: 'integer', default: 'x' } }) }).errors.some(e => e.includes('default of "n"')));
  assert.ok(result({ sidecar: schema({ c: { type: 'number', format: 'color' } }) }).errors.length > 0);
  assert.ok(result({ sidecar: schema({ n: { type: 'integer' } }, { required: ['missing'] }) }).errors.some(e => e.includes('required key "missing"')));
});
t('build puts the defaults in the registry and does not copy the sidecar', () => {
  const proj = withParams({ sidecar: schema({ n: { type: 'integer', default: 4, description: 'n' } }) });
  const out = join(tmp, 'out-params');
  const r = buildProject(proj, out);
  assert.deepEqual(r.errors, []);
  assert.equal(readFileSync(join(out, 'phaseform.registry.js'), 'utf8'), registrySource(['scripts/bar.js'], { 'scripts/bar.js': { n: 4 } }));
  assert.match(readFileSync(join(out, 'phaseform.registry.js'), 'utf8'), /export const paramDefaults = \{"scripts\/bar.js":\{"n":4\}\};/);
  assert.equal(existsSync(join(out, 'scripts/bar.params.json')), false);
});
rmSync(tmp, { recursive: true, force: true });
console.log(`${n} passed`);
