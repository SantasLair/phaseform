// Writes a small valid PHASEFORM project: one scene with a title, a panel and a score label, and no assets.
// Usage: node write-scene.mjs <output folder>
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'my-game';

const scene = {
  format: 'phaseform',
  version: '0.1.0',
  key: 'Main',
  size: { width: 800, height: 600 },
  background: '#0d0d0d',
  objects: [
    // x and y are positions at the design size; the anchor says which edge the object follows if the game is resized
    { id: 'title', type: 'text', text: 'My Game', x: 400, y: 40, origin: { x: 0.5, y: 0 },
      style: { fontSize: 32, color: '#ffffff' }, anchor: { x: 'center' } },
    { id: 'panel', type: 'rectangle', x: 400, y: 300, width: 240, height: 120, fill: { color: '#2c3e50' } },
    { id: 'score', type: 'text', text: 'Score 0', x: 780, y: 20, origin: { x: 1, y: 0 },
      name: 'scoreLabel', anchor: { x: 'right' } },
  ],
};

const project = {
  format: 'phaseform-project',
  version: '0.1.0',
  name: 'My Game',
  entry: 'Main',
  scenes: [{ key: 'Main', path: 'scenes/main.phaseform.json' }],
  assets: [],
};

// Two-space JSON and a final newline keep diffs small.
const json = (value) => JSON.stringify(value, null, 2) + '\n';

mkdirSync(`${out}/scenes`, { recursive: true });
writeFileSync(`${out}/phaseform.project.json`, json(project));
writeFileSync(`${out}/scenes/main.phaseform.json`, json(scene));
console.log(`wrote ${out}/phaseform.project.json and ${out}/scenes/main.phaseform.json`);
