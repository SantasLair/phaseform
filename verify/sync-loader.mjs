// Regenerates verify/phaseform-load.js (the classic-script form the harness pages load) from packages/loader/src/loader.js.
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('../packages/loader/src/loader.js', import.meta.url), 'utf8');
const out = src.replace('export function createLoader(Phaser) {', 'window.PhaseformLoader = (function () {\n  const Phaser = window.Phaser;')
  .replace(/\n\}\n$/, '\n})();\n');
writeFileSync(new URL('./phaseform-load.js', import.meta.url), out);
