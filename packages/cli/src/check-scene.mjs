// Checks the docs/SPEC.md scene rules that JSON Schema cannot express: unique ids, object references in filters,
// and mask cycles (an object whose mask source is itself or one of its ancestors).
const REF_FIELDS = { mask: ['source'], imageLight: ['modelRotationSource'], normalTools: ['rotationSource'] };

function* walk(objects, ancestors = []) {
  for (const o of objects ?? []) {
    yield { o, ancestors };
    if (Array.isArray(o.children)) yield* walk(o.children, [...ancestors, o.id]);
  }
}

// Every filter in an object's filters, including those nested in parallel filters.
export function* filtersOf(o) {
  function* list(l) {
    for (const f of l ?? []) {
      if (!f || typeof f !== 'object') continue;
      yield f;
      if (f.type === 'parallel') { yield* list(f.top); yield* list(f.bottom); }
    }
  }
  if (o.filters) { yield* list(o.filters.internal); yield* list(o.filters.external); }
}

export function checkScene(scene) {
  const errors = [];
  const ids = new Set();
  const entries = [...walk(scene.objects)];
  for (const { o } of entries) {
    if (ids.has(o.id)) errors.push(`duplicate id "${o.id}"`);
    ids.add(o.id);
  }
  for (const { o, ancestors } of entries) {
    for (const f of filtersOf(o)) {
      for (const field of REF_FIELDS[f.type] ?? []) {
        const ref = f[field];
        if (ref === undefined) continue;
        if (!ids.has(ref)) errors.push(`object "${o.id}": ${f.type}.${field} refers to missing id "${ref}"`);
        else if (f.type === 'mask' && (ref === o.id || ancestors.includes(ref))) errors.push(`object "${o.id}": mask source "${ref}" is the object or one of its ancestors`);
      }
    }
  }
  return { errors };
}
