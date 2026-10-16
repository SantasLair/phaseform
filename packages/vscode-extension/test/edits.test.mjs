import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { findPath, editsFor, apply } = createRequire(import.meta.url)('../src/edits.js');

const text = `{
  // keep this comment
  "key": "S",
  "objects": [
    { "id": "a", "type": "image", "key": "k", "x": 1 },
    { "id": "grp", "type": "container", "children": [
      { "id": "b", "type": "text", "text": "hi", "y": 5 }
    ] }
  ]
}`;
const doc = JSON.parse(text.replace(/^\s*\/\/.*$/m, ''));
const set = (id, path, value) => apply(text, editsFor(text, doc, { type: 'set', id, path, value }));
let n = 0; const t = (name, fn) => { fn(); console.log('PASS ' + name); n++; };

t('findPath finds roots and nested children', () => {
  assert.deepEqual(findPath(doc.objects, 'a'), ['objects', 0]);
  assert.deepEqual(findPath(doc.objects, 'b'), ['objects', 1, 'children', 0]);
  assert.equal(findPath(doc.objects, 'zzz'), null);
});
t('set changes one value and keeps comments', () => {
  const out = set('a', ['x'], 42);
  assert.ok(out.includes('// keep this comment'));
  assert.equal(JSON.parse(out.replace(/^\s*\/\/.*$/m, '')).objects[0].x, 42);
});
t('set adds a missing field and a nested one', () => {
  const o = JSON.parse(set('b', ['scale'], { x: 2, y: 2 }).replace(/^\s*\/\/.*$/m, ''));
  assert.deepEqual(o.objects[1].children[0].scale, { x: 2, y: 2 });
});
t('an undefined value removes the field', () => {
  assert.equal('x' in JSON.parse(set('a', ['x'], undefined).replace(/^\s*\/\/.*$/m, '')).objects[0], false);
});
t('remove deletes the object from its array', () => {
  const out = apply(text, editsFor(text, doc, { type: 'remove', id: 'b' }));
  assert.deepEqual(JSON.parse(out.replace(/^\s*\/\/.*$/m, '')).objects[1].children, []);
});
t('an unknown id makes no edits', () => assert.deepEqual(editsFor(text, doc, { type: 'set', id: 'nope', path: ['x'], value: 1 }), []));
console.log(`${n} passed`);
