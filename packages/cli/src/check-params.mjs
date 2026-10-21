// Script params: the sidecar files that describe a script's params (scripts/x.js -> scripts/x.params.json), and the checks that
// compare an object's params with them. See docs/SPEC.md, "Script params".
import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addFormat('color', /^#[0-9a-fA-F]{6}$/);
const validateSidecar = ajv.compile(JSON.parse(readFileSync(join(pkg, 'phaseform.script-params.schema.json'), 'utf8')));

// The sidecar of a script path: the last extension is replaced by `.params.json`.
export const sidecarPath = (script) => script.replace(/\.[^./]+$/, '') + '.params.json';

const hasOwn = (o, k) => Object.hasOwn(o, k);
const why = (v) => ajv.errorsText(v.errors, { dataVar: 'value', separator: ', ' });
const validators = new WeakMap();
const check = (prop, value) => {
  let v = validators.get(prop);
  if (!v) { v = ajv.compile(prop); validators.set(prop, v); }
  return v(value) ? null : why(v);
};

// { key: default } for the params of a schema that have a default.
export function defaultsOf(schema) {
  const out = {};
  for (const [k, p] of Object.entries(schema.properties ?? {})) if (hasOwn(p, 'default')) out[k] = p.default;
  return out;
}

// Reads and checks the sidecar of every script that has one. Returns { schemas: Map(script -> schema), errors, notes }.
// A sidecar that is not valid JSON, breaks the restricted vocabulary or has a default that does not fit its param is an error.
// A param without a description is only a note.
export function loadParamSchemas(root, scripts) {
  const schemas = new Map(), errors = [], notes = [];
  for (const script of scripts) {
    const rel = sidecarPath(script);
    const file = join(root, rel);
    if (!existsSync(file)) continue;
    let schema;
    try { schema = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { errors.push(`${rel}: ${e.message}`); continue; }
    if (!validateSidecar(schema)) { errors.push(...validateSidecar.errors.map(e => `${rel}${e.instancePath}: ${e.message}`)); continue; }
    let ok = true;
    for (const [k, p] of Object.entries(schema.properties)) {
      if (hasOwn(p, 'default')) {
        const bad = check(p, p.default);
        if (bad) { errors.push(`${rel}: default of "${k}": ${bad}`); ok = false; }
      }
      if (p.description === undefined) notes.push(`${rel}: param "${k}" has no description`);
    }
    for (const r of schema.required ?? []) {
      if (!hasOwn(schema.properties, r)) { errors.push(`${rel}: required key "${r}" is not in properties`); ok = false; }
    }
    if (ok) schemas.set(script, schema);
  }
  return { schemas, errors, notes };
}

// Warnings for one object. The effective params are the scripts' defaults, then the object's own params. Each known schema
// checks the keys it knows; a key is "unknown" only when every attached script has a closed schema (additionalProperties false)
// and none of them lists it, because an attached script without a schema may read any key.
export function checkObjectParams(obj, schemas) {
  const scripts = Array.isArray(obj.scripts) ? obj.scripts : [];
  const known = scripts.filter(s => schemas.has(s));
  if (!known.length) return [];
  const own = obj.params && typeof obj.params === 'object' && !Array.isArray(obj.params) ? obj.params : {};
  const effective = {};
  for (const s of known) Object.assign(effective, defaultsOf(schemas.get(s)));
  Object.assign(effective, own);
  const warnings = [];
  const listed = new Set();
  for (const s of known) {
    const schema = schemas.get(s);
    for (const [k, p] of Object.entries(schema.properties)) {
      listed.add(k);
      if (!hasOwn(effective, k)) continue;
      const bad = check(p, effective[k]);
      if (bad) warnings.push(`"${obj.id}": param "${k}": ${bad} (${s})`);
    }
    for (const r of schema.required ?? []) if (!hasOwn(effective, r)) warnings.push(`"${obj.id}": param "${r}" is required by ${s}`);
  }
  if (scripts.every(s => schemas.has(s) && schemas.get(s).additionalProperties === false)) {
    for (const k of Object.keys(own)) if (!listed.has(k)) warnings.push(`"${obj.id}": param "${k}" is not described by ${known.join(', ')}`);
  }
  return warnings;
}
