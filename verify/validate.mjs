// Validates examples against both schemas, then runs the cross-file project rules.
//   examples/*.phaseform.json            scenes, must pass
//   examples/invalid/*.json              scenes, must fail
//   examples/phaseform.project.json      project, must pass schema and rules with no errors or warnings
//   examples/invalid-project/*.project.json  projects, must fail the schema or the rules
import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkProject } from './check-project.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ajv = new Ajv2020({ allErrors: true, strict: false });
const compile = (f) => ajv.compile(JSON.parse(readFileSync(join(root, f), 'utf8')));
const validateScene = compile('phaseform.schema.json');
const validateProject = compile('phaseform.project.schema.json');
const load = (...p) => JSON.parse(readFileSync(join(root, ...p), 'utf8'));
let failures = 0;
const report = (pass, label, name, detail) => {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label.padEnd(16)} ${name}${detail ? '  ' + detail : ''}`);
  if (!pass) failures++;
};

for (const f of readdirSync(join(root, 'examples')).filter(f => f.endsWith('.phaseform.json'))) {
  const ok = validateScene(load('examples', f));
  report(ok, 'valid scene', f, ok ? '' : JSON.stringify(validateScene.errors));
}
for (const f of readdirSync(join(root, 'examples', 'invalid')).filter(f => f.endsWith('.json'))) {
  report(!validateScene(load('examples', 'invalid', f)), 'invalid scene', f);
}

{
  const f = 'phaseform.project.json';
  const schemaOk = validateProject(load('examples', f));
  const { errors, warnings } = checkProject(join(root, 'examples', f));
  report(schemaOk && !errors.length && !warnings.length, 'valid project', f,
    schemaOk ? [...errors, ...warnings].join('; ') : JSON.stringify(validateProject.errors));
}

for (const f of readdirSync(join(root, 'examples', 'invalid-project')).filter(f => f.endsWith('.project.json'))) {
  const schemaOk = validateProject(load('examples', 'invalid-project', f));
  let why = 'schema';
  let failed = !schemaOk;
  if (schemaOk) {
    const { errors } = checkProject(join(root, 'examples', 'invalid-project', f));
    failed = errors.length > 0;
    why = errors[0] ?? 'NOT REJECTED';
  }
  report(failed, 'invalid project', f, `(${why})`);
}

process.exit(failures ? 1 : 0);
