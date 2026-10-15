// Checks the docs/PROJECT.md rules that JSON Schema cannot express. Prototype of the loader's validation pass.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const TEXTURE_TYPES = new Set(['image', 'spritesheet', 'atlas']);

function* walk(objects) {
  for (const o of objects ?? []) {
    yield o;
    if (Array.isArray(o.children)) yield* walk(o.children);
  }
}

export function checkProject(projectPath) {
  const errors = [];
  const warnings = [];
  const project = JSON.parse(readFileSync(projectPath, 'utf8'));
  const root = dirname(projectPath);

  // asset keys: unique within the texture namespace, and within audio
  const assets = new Map(); // key -> asset (texture or audio)
  const textures = new Map();
  const audio = new Map();
  const allKeys = new Set();
  for (const a of project.assets) {
    allKeys.add(a.key);
    const ns = TEXTURE_TYPES.has(a.type) ? textures : a.type === 'audio' ? audio : null;
    if (!ns) continue;
    if (ns.has(a.key)) errors.push(`duplicate ${ns === textures ? 'texture' : 'audio'} key "${a.key}"`);
    ns.set(a.key, a);
  }

  // scenes
  const sceneKeys = new Set();
  const sizes = new Set();
  for (const entry of project.scenes) {
    if (sceneKeys.has(entry.key)) errors.push(`duplicate scene key "${entry.key}"`);
    sceneKeys.add(entry.key);

    for (const k of entry.assets ?? []) {
      if (!allKeys.has(k)) errors.push(`scene "${entry.key}" lists unknown asset "${k}"`);
    }

    const file = join(root, entry.path);
    if (!existsSync(file)) { errors.push(`scene file not found: ${entry.path}`); continue; }
    const scene = JSON.parse(readFileSync(file, 'utf8'));
    if (scene.key !== entry.key) errors.push(`scene entry "${entry.key}" points to a file with key "${scene.key}"`);
    sizes.add(`${scene.size?.width}x${scene.size?.height}`);

    // texture references and frames (warnings)
    for (const o of walk(scene.objects)) {
      if (o.type !== 'image' && o.type !== 'sprite') continue;
      const tex = textures.get(o.key);
      if (!tex) { warnings.push(`scene "${entry.key}": object "${o.id}" uses texture "${o.key}" not in the manifest`); continue; }
      if (entry.assets && !entry.assets.includes(o.key)) {
        warnings.push(`scene "${entry.key}": object "${o.id}" uses texture "${o.key}" not in the scene's asset list`);
      }
      if (o.frame !== undefined && tex.type === 'spritesheet') {
        if (typeof o.frame !== 'number') warnings.push(`scene "${entry.key}": object "${o.id}" uses frame name "${o.frame}" on a spritesheet`);
        else if (tex.frames !== undefined && o.frame >= tex.frames) warnings.push(`scene "${entry.key}": object "${o.id}" frame ${o.frame} is outside 0..${tex.frames - 1}`);
      }
    }
  }
  if (!sceneKeys.has(project.entry)) errors.push(`entry "${project.entry}" is not a scene key`);
  if (sizes.size > 1) warnings.push(`scenes disagree on size: ${[...sizes].join(', ')}`);

  return { errors, warnings };
}
