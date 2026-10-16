// Turns src/loader.js into a classic script that defines window.PhaseformLoader (for pages that load Phaser with a script tag).
import { readFileSync } from 'node:fs';
export function toGlobalScript() {
  const src = readFileSync(new URL('./src/loader.js', import.meta.url), 'utf8');
  return src.replace('export function createLoader(Phaser) {', 'window.PhaseformLoader = (function () {\n  const Phaser = window.Phaser;')
    .replace(/\n\}\n$/, '\n})();\n');
}
