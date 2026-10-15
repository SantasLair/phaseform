// Classifies survey results against the PHASEFORM v0.1 core and prints a coverage report.
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(process.argv[2] ?? 'survey-results.json', 'utf8'));
const CORE = new Set(['Image', 'Sprite', 'Text', 'Container']);
const BEHAVIOR = ['tweens', 'input', 'animations', 'physics', 'timers', 'updateLoop', 'cameraMotion', 'externalLibs'];
const OUTOFSCOPE = ['filters', 'lighting'];
const cls = { static: [], behavior: [], graphics: [], missingType: [], filtered: [], failed: [] };
const missingTypes = {}, behaviorUse = {}, props = {};
for (const r of d.results) {
  if (r.status !== 'ok') { cls.failed.push(r); continue; }
  const types = new Set(); const p = {};
  for (const s of r.scene.scenes) { for (const t of Object.keys(s.counts)) types.add(t); for (const [k, v] of Object.entries(s.props)) p[k] = 1; }
  r.types = [...types]; r.propKeys = Object.keys(p);
  for (const k of r.propKeys) props[k] = (props[k] || 0) + 1;
  const other = r.types.filter(t => !CORE.has(t) && t !== 'Graphics');
  const beh = BEHAVIOR.filter(k => r.signals[k]);
  const oos = OUTOFSCOPE.filter(k => r.signals[k]);
  r.behavior = beh;
  for (const k of beh) behaviorUse[k] = (behaviorUse[k] || 0) + 1;
  if (other.length) { for (const t of other) missingTypes[t] = (missingTypes[t] || 0) + 1; cls.missingType.push(r); }
  else if (oos.length) cls.filtered.push(r);
  else if (r.types.includes('Graphics')) cls.graphics.push(r);
  else if (beh.length) cls.behavior.push(r);
  else cls.static.push(r);
}
const n = d.results.length;
console.log(`TOTAL ${n}`);
for (const [k, v] of Object.entries(cls)) console.log(String(v.length).padStart(4), k);
console.log('\nMISSING TYPES (examples containing each)'); console.log(Object.entries(missingTypes).sort((a, b) => b[1] - a[1]));
console.log('\nBEHAVIOR SIGNALS (among runnable)'); console.log(Object.entries(behaviorUse).sort((a, b) => b[1] - a[1]));
console.log('\nOBJECT PROPERTIES DIFFERING FROM DEFAULT (examples)'); console.log(Object.entries(props).sort((a, b) => b[1] - a[1]));
const byFolder = {};
for (const [k, v] of Object.entries(cls)) for (const r of v) { const f = r.path.split('/')[2]; (byFolder[f] ??= {})[k] = (byFolder[f][k] || 0) + 1; }
console.log('\nBY FOLDER'); for (const [f, c] of Object.entries(byFolder)) console.log(f.padEnd(11), JSON.stringify(c));
console.log('\nSTATIC (core types only, no behavior):'); for (const r of cls.static) console.log('  ', r.path.replace('src/game objects/', ''), r.types.join(','), r.propKeys.join(','));
console.log('\nFAILED:'); for (const r of cls.failed) console.log('  ', r.status, r.path.replace('src/game objects/', ''), (r.errors[0] || '').slice(0, 80));
