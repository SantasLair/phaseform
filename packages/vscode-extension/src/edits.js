// Pure helpers: find an object in a scene document and turn an edit into minimal text edits (keeps comments and layout).
const { modify, applyEdits } = require('jsonc-parser');

const FORMAT = { formattingOptions: { insertSpaces: true, tabSize: 2 } };

// Path of the object with `id`, as a JSON path such as ['objects', 1, 'children', 0], or null.
function findPath(objects, id, base = ['objects']) {
  for (let i = 0; i < (objects || []).length; i++) {
    const o = objects[i];
    if (o.id === id) return [...base, i];
    const hit = Array.isArray(o.children) ? findPath(o.children, id, [...base, i, 'children']) : null;
    if (hit) return hit;
  }
  return null;
}

// Text edits for `op`: { type: 'set', id, path: [...], value } (value undefined removes the field) or { type: 'remove', id }.
// Returns [] when the id does not exist.
function editsFor(text, doc, op) {
  const at = findPath(doc.objects, op.id);
  if (!at) return [];
  if (op.type === 'remove') return modify(text, at, undefined, FORMAT);
  if (op.type === 'set') return modify(text, [...at, ...op.path], op.value, FORMAT);
  return [];
}

function apply(text, edits) { return applyEdits(text, edits); }

module.exports = { findPath, editsFor, apply };
