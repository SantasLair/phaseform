// Regenerates verify/phaseform-load.js (the classic-script form the harness pages load) from packages/loader/src/loader.js.
import { writeFileSync } from 'node:fs';
import { toGlobalScript } from '../packages/loader/build-global.mjs';
writeFileSync(new URL('./phaseform-load.js', import.meta.url), toGlobalScript());
