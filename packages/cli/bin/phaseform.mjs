#!/usr/bin/env node
import { resolve } from 'node:path';
import { validateProject, buildProject } from '../src/project.mjs';

const [cmd, ...args] = process.argv.slice(2);
const usage = () => { console.error('usage: phaseform validate <phaseform.project.json>\n       phaseform build <phaseform.project.json> --out <dir>'); process.exit(2); };
const flag = (n) => { const i = args.indexOf(n); return i < 0 ? undefined : args.splice(i, 2)[1]; };

const out = flag('--out');
const file = args[0];
if (!file || (cmd !== 'validate' && cmd !== 'build') || (cmd === 'build' && !out)) usage();
const projectPath = resolve(file);
const r = cmd === 'build' ? buildProject(projectPath, resolve(out)) : validateProject(projectPath);
for (const w of r.warnings) console.warn(`warning: ${w}`);
for (const n of r.notes ?? []) console.log(`note: ${n}`);
for (const e of r.errors) console.error(`error: ${e}`);
if (r.errors.length) { console.error(`${r.errors.length} error(s)`); process.exit(1); }
console.log(cmd === 'build' ? `built ${r.written.length} file(s) into ${resolve(out)}` : `valid (${r.warnings.length} warning(s))`);
