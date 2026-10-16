// Runs the whole suite against the reference implementation (packages/cli, packages/loader).
//   validate/cases.json  every scene and project must be accepted or rejected as listed
//   build/               release build output (see build/expect.json)
//   load/*.case.json     run by run-load.mjs in real Chrome
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { validateProject, validateSceneDocument, buildProject } from 'phaseform-cli/project';

const here = import.meta.dirname;
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
let failures = 0, passes = 0;
const check = (ok, name, detail) => { if (ok) passes++; else { failures++; console.log(`FAIL ${name}${detail ? '  ' + detail : ''}`); } };

for (const c of read(join(here, 'validate/cases.json'))) {
  const file = join(here, '..', c.file);
  const errors = c.kind === 'scene' ? validateSceneDocument(read(file)) : validateProject(file, { checkScripts: false }).errors;
  check((errors.length === 0) === (c.expect === 'valid'), `${c.kind} ${c.file} should be ${c.expect}`, errors[0]);
}
console.log(`validate: ${passes} passed`);

const list = (d) => readdirSync(d, { recursive: true }).filter(f => statSync(join(d, f)).isFile()).map(f => f.split(sep).join('/')).sort();
{
  const expect = read(join(here, 'build/expect.json'));
  const tmp = mkdtempSync(join(tmpdir(), 'phaseform-conf-'));
  const out = join(tmp, 'out');
  const r = buildProject(join(here, 'build/project/phaseform.project.json'), out);
  check(r.errors.length === 0, 'build succeeds', r.errors[0]);
  check(JSON.stringify(list(out)) === JSON.stringify(expect.files), 'build writes the expected files', list(out).join());
  const src = read(join(here, 'build/project/scenes/main.phaseform.json'));
  const got = read(join(out, 'scenes/main.phaseform.json'));
  for (const o of src.objects) delete o.placeholder;
  assert.deepEqual(got, src); passes++;
  const broken = join(tmp, 'broken'); cpSync(join(here, 'build/project'), broken, { recursive: true });
  rmSync(join(broken, expect.failing[0].remove));
  const bad = buildProject(join(broken, 'phaseform.project.json'), join(tmp, 'out2'));
  check(bad.errors.length > 0 && !existsSync(join(tmp, 'out2')), 'missing script: error and no output');
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`build: ${passes} passed total`);

const load = spawnSync(process.execPath, [join(here, 'run-load.mjs')], { stdio: 'inherit' });
if (load.status !== 0) failures++;
console.log(failures ? `${failures} failure(s)` : 'all passed');
process.exit(failures ? 1 : 0);
