// Regenerates validate/cases.json from the spec examples. Run after adding an example.
import { readdirSync, writeFileSync } from 'node:fs';
const ls = (d, re) => readdirSync(new URL(`../examples/${d}`, import.meta.url)).filter(f => re.test(f)).sort();
const cases = [
  ...ls('', /\.phaseform\.json$/).map(f => ({ kind: 'scene', file: `examples/${f}`, expect: 'valid' })),
  ...ls('invalid', /\.json$/).map(f => ({ kind: 'scene', file: `examples/invalid/${f}`, expect: 'invalid' })),
  { kind: 'project', file: 'examples/phaseform.project.json', expect: 'valid' },
  ...ls('invalid-project', /\.project\.json$/).map(f => ({ kind: 'project', file: `examples/invalid-project/${f}`, expect: 'invalid' })),
];
writeFileSync(new URL('./validate/cases.json', import.meta.url), JSON.stringify(cases, null, 1) + '\n');
console.log(`${cases.length} cases`);
