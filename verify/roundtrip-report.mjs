// Summarizes roundtrip results: pass rate by folder, loss reasons, unsupported types, failures.
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(process.argv[2] ?? 'roundtrip-results.json', 'utf8'));
const CORE_ONLY = (r) => !r.report || r.report.unsupported.length === 0;
console.log('SUMMARY', d.summary, 'total', d.results.length);
const by = {};
for (const r of d.results) { const f = r.path.split('/')[2]; (by[f] ??= {})[r.status] = (by[f][r.status] || 0) + 1; }
console.log('\nBY FOLDER'); for (const [f, c] of Object.entries(by)) console.log(f.padEnd(12), JSON.stringify(c));
const core = d.results.filter(r => r.report && CORE_ONLY(r));
console.log(`\nCORE-TYPES-ONLY examples (no unsupported object types): ${core.length}`);
const cs = {}; for (const r of core) cs[r.status] = (cs[r.status] || 0) + 1; console.log(cs);
const unsup = {}; for (const r of d.results) for (const u of new Set((r.report?.unsupported ?? []).map(u => u.type))) unsup[u] = (unsup[u] || 0) + 1;
console.log('\nUNSUPPORTED TYPES (examples)'); console.log(Object.entries(unsup).sort((a, b) => b[1] - a[1]));
const loss = {}; for (const r of d.results) for (const l of r.report?.lossy ?? []) { const k = `${l.field}: ${l.why}${l.benign ? ' (benign)' : ''}`; loss[k] = (loss[k] || 0) + 1; }
console.log('\nLOSS REASONS (occurrences)'); console.log(Object.entries(loss).sort((a, b) => b[1] - a[1]));
console.log('\nCORE-ONLY NON-EXACT:');
for (const r of core.filter(r => r.status !== 'exact')) console.log(' ', r.status.padEnd(15), r.path.replace('src/game objects/', ''), 'diff=' + r.diff, r.loadError || r.error || r.skip || '', (r.schemaErrors || []).join('; '), JSON.stringify((r.report?.lossy ?? []).filter(l => !l.benign).map(l => l.field)));
console.log('\nSKIPPED/ERROR:'); for (const r of d.results.filter(r => r.status === 'skipped' || r.status === 'error')) console.log(' ', r.status.padEnd(8), r.path.replace('src/game objects/', ''), r.skip || r.loadError || r.error || '');
console.log('\nSCHEMA-INVALID:'); for (const r of d.results.filter(r => r.status === 'schema-invalid')) console.log(' ', r.path.replace('src/game objects/', ''), r.schemaErrors);
