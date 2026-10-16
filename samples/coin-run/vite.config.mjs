import { defineConfig } from 'vite';
import phaseform from 'phaseform-vite-plugin';

export default defineConfig({
  plugins: [phaseform({ project: 'phaseform.project.json' })],
  // the toolkit packages are linked from outside this folder, so make them share this game's copy of Phaser
  resolve: { dedupe: ['phaser'] },
});
