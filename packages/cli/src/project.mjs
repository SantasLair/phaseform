// Validation and release build for a PHASEFORM project. See docs/PROJECT.md, "Release builds".
import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkProject } from './check-project.mjs';
import { checkScene } from './check-scene.mjs';
import { checkObjectParams, defaultsOf, loadParamSchemas } from './check-params.mjs';

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

// Returns { errors, warnings, notes, project, scenes: [{ entry, doc }], paramDefaults }. Script paths that do not resolve to a file are errors.
// `paramDefaults` is { script: { key: default } } from the scripts' params sidecars (docs/SPEC.md, "Script params"); params that
// do not fit a sidecar are warnings, a broken sidecar is an error, and a param with no description is a note.
// Pass { checkScripts: false } to skip the script-file check (the conformance suite has no script files).
export function validateProject(projectPath, { checkScripts = true } = {}) {
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
      for (const s of checkScripts ? o.scripts ?? [] : []) {
        if (!existsSync(join(root, s))) errors.push(`${entry.path}: object "${o.id}" script not found: ${s}`);
      }
    }
  }
  const p = checkProject(projectPath);
  errors.push(...p.errors);
  const warnings = [...p.warnings];
  const { schemas, errors: sidecarErrors, notes } = loadParamSchemas(root, scriptPaths(scenes));
  errors.push(...sidecarErrors);
  for (const { entry, doc } of scenes) {
    for (const o of walk(doc.objects)) warnings.push(...checkObjectParams(o, schemas).map(m => `${entry.path}: ${m}`));
  }
  const paramDefaults = {};
  for (const [script, schema] of schemas) {
    const d = defaultsOf(schema);
    if (Object.keys(d).length) paramDefaults[script] = d;
  }
  return { errors, warnings, notes, project, scenes, paramDefaults };
}

// Schema and scene rules for one scene document. Returns the list of errors.
export function validateSceneDocument(doc) {
  if (!validateSceneSchema(doc)) return validateSceneSchema.errors.map(e => `${e.instancePath}: ${e.message}`);
  return checkScene(doc).errors;
}

export { sidecarPath } from './check-params.mjs';

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

// `paramDefaults` ({ script: { key: default } }) is written as a named export next to the default export (the modules), for
// the loader's `paramDefaults` option; only the listed scripts are kept.
export function registrySource(paths, paramDefaults = {}) {
  const imports = paths.map((p, i) => `import * as s${i} from './${posix.normalize(p)}';`);
  const entries = paths.map((p, i) => `${JSON.stringify(p)}: s${i}`);
  const defaults = Object.fromEntries(paths.filter(p => paramDefaults[p]).map(p => [p, paramDefaults[p]]));
  return `${imports.join('\n')}${imports.length ? '\n' : ''}export const paramDefaults = ${JSON.stringify(defaults)};\nexport default { ${entries.join(', ')} };\n`;
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
// Params sidecars are not copied: their defaults go into the registry.
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
  put('phaseform.registry.js', registrySource(scripts, result.paramDefaults));
  for (const a of assetFiles(result.project)) {
    if (!existsSync(join(root, a))) { result.warnings.push(`asset file not found, not copied: ${a}`); continue; }
    copyInto(root, out, a); written.push(a);
  }
  return { ...result, written };
}
