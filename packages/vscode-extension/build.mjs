// Copies Phaser and the loader (as a classic script) into media/vendor, where the webview loads them from.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { toGlobalScript } from '../loader/build-global.mjs';

const out = new URL('./media/vendor/', import.meta.url);
mkdirSync(out, { recursive: true });
copyFileSync(new URL('./node_modules/phaser/dist/phaser.min.js', import.meta.url), new URL('phaser.min.js', out));
writeFileSync(new URL('phaseform-load.js', out), toGlobalScript());
console.log('built media/vendor');
