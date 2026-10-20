// Moves one object in an existing scene file and writes it back without losing anything it does not understand.
// Usage: node edit-scene.mjs <scene file> <object id> <x> <y>
import { readFileSync, writeFileSync } from 'node:fs';

const [file, id, x, y] = process.argv.slice(2);
const scene = JSON.parse(readFileSync(file, 'utf8'));

// Find the object anywhere in the tree: containers hold their children.
const find = (objects) => {
  for (const o of objects) {
    if (o.id === id) return o;
    const hit = o.children && find(o.children);
    if (hit) return hit;
  }
};
const target = find(scene.objects);
if (!target) { console.error(`no object with id "${id}"`); process.exit(1); }

// Change only what you mean to change. Everything else in the parsed document, including fields and types this
// script has never heard of, goes back out exactly as it came in.
target.x = Number(x);
target.y = Number(y);

writeFileSync(file, JSON.stringify(scene, null, 2) + '\n');
console.log(`moved "${id}" to (${x}, ${y})`);
