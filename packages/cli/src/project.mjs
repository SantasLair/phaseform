// Validation and release build for a PHASEFORM project. See docs/PROJECT.md, "Release builds".
import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkProject } from './check-project.mjs';
import { checkScene } from './check-scene.mjs';

// Schemas live at the repository root; a published package would copy them in at pack time.
const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ajv = new Ajv2020({ allErrors: true, strict: false });
const schema = (f) => ajv.compile(JSON.parse(readFileSync(join(pkg, f), 'utf8')));
const validateSceneSchema = schema('phaseform.schema.json');
const validateProjectSchema = schema('phaseform.project.schema.json');
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));

function* walk(objects) {
  for (const o of objects ?? []) {
    yield o;
    if (Array.isArray(o.children)) yield* walk(o.children);
  }
}

// Returns { errors, warnings, project, scenes: [{ entry, doc }] }. Script paths that do not resolve to a file are errors.
export function validateProject(projectPath) {
  const errors = [];
  const root = dirname(projectPath);
  let project;
  try { project = readJson(projectPath); } catch (e) { return { errors: [`${projectPath}: ${e.message}`], warnings: [], scenes: [] }; }
  if (!validateProjectSchema(project)) {
    return { errors: validateProjectSchema.errors.map(e => `${projectPath}${e.instancePath}: ${e.message}`), warnings: [], project, scenes: [] };
  }
  const scenes = [];
  for (const entry of project.scenes) {
    const file = join(root, entry.path);
    if (!existsSync(file)) continue; // checkProject reports it
    const doc = readJson(file);
    scenes.push({ entry, doc });
    if (!validateSceneSchema(doc)) {
      errors.push(...validateSceneSchema.errors.map(e => `${entry.path}${e.instancePath}: ${e.message}`));
      continue;
    }
    errors.push(...checkScene(doc).errors.map(m => `${entry.path}: ${m}`));
    for (const o of walk(doc.objects)) {
      for (const s of o.scripts ?? []) {
        if (!existsSync(join(root, s))) errors.push(`${entry.path}: object "${o.id}" script not found: ${s}`);
      }
    }
  }
  const p = checkProject(projectPath);
  errors.push(...p.errors);
  return { errors, warnings: p.warnings, project, scenes };
}

export function scriptPaths(scenes) {
  const paths = new Set();
  for (const { doc } of scenes) for (const o of walk(doc.objects)) for (const s of o.scripts ?? []) paths.add(s);
  return [...paths].sort();
}

// A manifest asset's files: url, atlasUrl, dataUrl, urls[].
export function assetFiles(project) {
  const files = new Set();
  for (const a of project.assets) {
    for (const k of ['url', 'atlasUrl', 'dataUrl']) if (typeof a[k] === 'string') files.add(a[k]);
    if (Array.isArray(a.urls)) for (const u of a.urls) files.add(u);
  }
  return [...files].sort();
}

export function registrySource(paths) {
  const imports = paths.map((p, i) => `import * as s${i} from './${posix.normalize(p)}';`);
  const entries = paths.map((p, i) => `${JSON.stringify(p)}: s${i}`);
  return `${imports.join('\n')}${imports.length ? '\n' : ''}export default { ${entries.join(', ')} };\n`;
}

// Removes editor-only data. Only `placeholder` is stripped; everything else is kept.
export function stripScene(doc) {
  const copy = JSON.parse(JSON.stringify(doc));
  for (const o of walk(copy.objects)) delete o.placeholder;
  return copy;
}

const copyInto = (root, out, rel) => {
  const dest = join(out, rel);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(join(root, rel), dest);
};

// Writes the release files to `out`: project file, stripped scenes, assets, scripts and phaseform.registry.js.
export function buildProject(projectPath, out) {
  const result = validateProject(projectPath);
  if (result.errors.length) return { ...result, written: [] };
  const root = dirname(projectPath);
  const written = [];
  const put = (rel, text) => { const d = join(out, rel); mkdirSync(dirname(d), { recursive: true }); writeFileSync(d, text); written.push(rel); };
  put('phaseform.project.json', JSON.stringify(result.project, null, 2) + '\n');
  for (const { entry, doc } of result.scenes) put(entry.path, JSON.stringify(stripScene(doc), null, 2) + '\n');
  const scripts = scriptPaths(result.scenes);
  for (const s of scripts) { copyInto(root, out, s); written.push(s); }
  put('phaseform.registry.js', registrySource(scripts));
  for (const a of assetFiles(result.project)) {
    if (!existsSync(join(root, a))) { result.warnings.push(`asset file not found, not copied: ${a}`); continue; }
    copyInto(root, out, a); written.push(a);
  }
  return { ...result, written };
}
