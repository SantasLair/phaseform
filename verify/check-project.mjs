// Checks the docs/PROJECT.md rules that JSON Schema cannot express. Prototype of the loader's validation pass.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { filtersOf } from './check-scene.mjs';

const TEXTURE_TYPES = new Set(['image', 'spritesheet', 'atlas', 'bitmapFont']); // a bitmap font's image is added to the texture manager under its key
const IMAGE_REF_TYPES = new Set(['image', 'spritesheet', 'atlas']);
const FILTER_TEXTURE_FIELDS = ['texture', 'normalMap', 'environmentMap'];

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

  // animations: unique keys, frames point at texture assets
  const animKeys = new Set();
  for (const a of project.animations ?? []) {
    if (animKeys.has(a.key)) errors.push(`duplicate animation key "${a.key}"`);
    animKeys.add(a.key);
    for (const f of a.frames) {
      if (!textures.has(f.key)) warnings.push(`animation "${a.key}" uses texture "${f.key}" not in the manifest`);
    }
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
      for (const f of filtersOf(o)) {
        for (const field of FILTER_TEXTURE_FIELDS) {
          const k = f[field];
          if (k === undefined) continue;
          if (!textures.has(k) || !IMAGE_REF_TYPES.has(textures.get(k).type)) warnings.push(`scene "${entry.key}": object "${o.id}" ${f.type} filter uses texture "${k}" not in the manifest`);
          else if (entry.assets && !entry.assets.includes(k)) warnings.push(`scene "${entry.key}": object "${o.id}" ${f.type} filter uses texture "${k}" not in the scene's asset list`);
        }
      }
      if (o.type === 'bitmapText') {
        const f = textures.get(o.font);
        if (!f || f.type !== 'bitmapFont') warnings.push(`scene "${entry.key}": object "${o.id}" uses font "${o.font}" not a bitmapFont in the manifest`);
        else if (entry.assets && !entry.assets.includes(o.font)) warnings.push(`scene "${entry.key}": object "${o.id}" uses font "${o.font}" not in the scene's asset list`);
        continue;
      }
      if (o.animation && !animKeys.has(o.animation.key)) warnings.push(`scene "${entry.key}": object "${o.id}" plays animation "${o.animation.key}" not in the project`);
      if (o.type !== 'image' && o.type !== 'sprite' && o.type !== 'tileSprite') continue;
      const tex = textures.get(o.key);
      if (!tex || !IMAGE_REF_TYPES.has(tex.type)) { warnings.push(`scene "${entry.key}": object "${o.id}" uses texture "${o.key}" not in the manifest`); continue; }
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
