// Webview side of the PHASEFORM scene editor. Renders the scene with the reference loader and turns clicks, drags and
// form changes into edit messages; the extension writes them to the file and sends the new document back.
(function () {
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const ids = new Map();        // scene object id -> display object
  const idOf = new Map();       // display object -> scene object id
  let doc = null, project = { assets: [], animations: [] }, game = null, scene = null, overlay = null;
  let problems = [], selected = null, zoom = 1, drag = null, sizeKey = '', assetKey = '';

  const send = (m) => vscode.postMessage(m);
  const status = (text, bad) => { const s = $('status'); s.textContent = text; s.className = bad ? 'bad' : ''; };

  function find(objects, id) {
    for (const o of objects || []) {
      if (o.id === id) return o;
      const hit = find(o.children, id);
      if (hit) return hit;
    }
    return null;
  }

  // ---- canvas ----------------------------------------------------------------------------------------------
  function applyZoom() {
    if (game && game.canvas) {
      game.canvas.style.width = Math.round(doc.size.width * zoom) + 'px';
      game.canvas.style.height = Math.round(doc.size.height * zoom) + 'px';
    }
    $('zoom-label').textContent = Math.round(zoom * 100) + '%';
  }

  function fit() {
    const wrap = $('stage-wrap');
    zoom = Math.max(0.1, Math.min(4, (wrap.clientWidth - 40) / doc.size.width, (wrap.clientHeight - 40) / doc.size.height));
    zoom = Math.round(zoom * 20) / 20;
    applyZoom();
  }

  function drawSelection() {
    if (!scene) return;
    if (!overlay || !overlay.scene) overlay = scene.add.graphics().setDepth(1e9);
    overlay.clear();
    const o = selected && ids.get(selected);
    if (!o) return;
    const m = o.getWorldTransformMatrix();
    const b = o.getBounds ? o.getBounds() : { x: m.tx, y: m.ty, width: 0, height: 0 };
    overlay.lineStyle(2 / zoom, 0x00aaff, 1).strokeRect(b.x, b.y, b.width, b.height);
    overlay.fillStyle(0x00aaff, 1).fillRect(m.tx - 3 / zoom, m.ty - 3 / zoom, 6 / zoom, 6 / zoom);
  }

  function rebuild() {
    PhaseformLoader.clear(scene);
    overlay = null;
    ids.clear(); idOf.clear();
    try {
      const built = PhaseformLoader.build(scene, doc, { animations: project.animations });
      for (const [id, o] of built.byId) { ids.set(id, o); idOf.set(o, id); }
      if (problems.length) status(problems.length + ' problem(s): ' + problems[0], true);
      else status(built.warnings.length ? built.warnings.length + ' warning(s): ' + built.warnings[0] : '', false);
    } catch (e) {
      status(String(e.message || e), true);
    }
    scene.cameras.main.setBackgroundColor(doc.background || '#000000');
    if (selected && !ids.has(selected)) selected = null;
    drawSelection();
    renderTree(); renderProps();
  }

  function createGame() {
    if (game) { game.destroy(true); game = null; scene = null; }
    $('stage').textContent = '';
    window.__ready = false;
    class EditorScene extends Phaser.Scene {
      constructor() { super('Editor'); }
      preload() { PhaseformLoader.loadAssets(this, project); }
      create() {
        scene = this;
        rebuild();
        this.events.on('update', drawSelection);
        window.__ready = true;
      }
    }
    game = new Phaser.Game({
      type: Phaser.WEBGL, parent: 'stage', width: doc.size.width, height: doc.size.height,
      backgroundColor: doc.background || '#000000', scene: EditorScene, audio: { noAudio: true }, input: { mouse: false, touch: false, keyboard: false },
    });
    game.events.once('ready', () => { fit(); bindCanvas(); });
  }

  // ---- picking and dragging ---------------------------------------------------------------------------------
  function drawOrder() {
    const out = [];
    const walk = (list) => { for (const o of list) { out.push(o); if (o.type === 'Container') walk(o.list); } };
    walk([...scene.children.list].map((o, i) => [o, i]).filter(p => p[0] !== overlay).sort((a, b) => a[0].depth - b[0].depth || a[1] - b[1]).map(p => p[0]));
    return out;
  }

  function pick(p) {
    const order = drawOrder();
    for (let i = order.length - 1; i >= 0; i--) {
      const o = order[i];
      if (!idOf.has(o) || !o.visible || !o.getBounds) continue; // Graphics has no bounds: code-driven objects are selected from the tree
      if (o.getBounds().contains(p.x, p.y)) return idOf.get(o);
    }
    return null;
  }

  const point = (e) => {
    const r = game.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (doc.size.width / r.width), y: (e.clientY - r.top) * (doc.size.height / r.height) };
  };
  const toLocal = (parent, p) => (parent ? parent.getWorldTransformMatrix().applyInverse(p.x, p.y) : p);

  function select(id) {
    selected = id;
    drawSelection(); renderTree(); renderProps();
  }

  let bound = null;
  function bindCanvas() {
    const c = game.canvas;
    if (bound === c) return;
    bound = c;
    c.addEventListener('pointerdown', (e) => {
      const p = point(e);
      const id = pick(p);
      select(id);
      if (!id) return;
      const o = ids.get(id), l = toLocal(o.parentContainer, p);
      drag = { id, o, p0: p, off: { x: o.x - l.x, y: o.y - l.y }, moved: false };
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = point(e);
      if (!drag.moved && Math.hypot(p.x - drag.p0.x, p.y - drag.p0.y) * zoom < 3) return;
      const l = toLocal(drag.o.parentContainer, p);
      drag.o.x = Math.round(l.x + drag.off.x);
      drag.o.y = Math.round(l.y + drag.off.y);
      drag.moved = true;
      renderProps();
    });
    c.addEventListener('pointerup', () => {
      if (drag && drag.moved) send({ type: 'set-many', id: drag.id, values: [{ path: ['x'], value: drag.o.x }, { path: ['y'], value: drag.o.y }] });
      drag = null;
    });
  }

  document.addEventListener('keydown', (e) => {
    if (!selected || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const od = find(doc.objects, selected);
    const step = e.shiftKey ? 10 : 1;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (move && od) {
      e.preventDefault();
      send({ type: 'set-many', id: selected, values: [{ path: ['x'], value: (od.x || 0) + move[0] }, { path: ['y'], value: (od.y || 0) + move[1] }] });
    } else if (e.key === 'Delete') {
      send({ type: 'remove', id: selected });
    }
  });

  // ---- tree and properties ------------------------------------------------------------------------------------
  function renderTree() {
    const t = $('tree');
    t.textContent = '';
    const walk = (objects, depth) => {
      for (const o of objects || []) {
        const row = document.createElement('div');
        row.className = 'row' + (o.id === selected ? ' sel' : '');
        row.style.paddingLeft = 4 + depth * 14 + 'px';
        row.textContent = o.id;
        const ty = document.createElement('span');
        ty.className = 'type'; ty.textContent = o.type;
        row.append(ty);
        row.addEventListener('click', () => select(o.id));
        t.append(row);
        walk(o.children, depth + 1);
      }
    };
    walk(doc.objects, 0);
  }

  function field(label, value, onChange, kind) {
    const l = document.createElement('label');
    l.append(label);
    const i = document.createElement('input');
    i.type = kind === 'number' ? 'number' : kind === 'check' ? 'checkbox' : 'text';
    if (kind === 'check') i.checked = !!value; else i.value = value === undefined ? '' : value;
    if (kind === 'number') i.step = 'any';
    i.addEventListener('change', () => onChange(kind === 'check' ? i.checked : kind === 'number' ? (i.value === '' ? undefined : Number(i.value)) : i.value));
    l.append(i);
    return l;
  }

  function renderProps() {
    const p = $('props');
    p.textContent = '';
    const od = selected && find(doc.objects, selected);
    if (!od) { const h = document.createElement('div'); h.className = 'hint'; h.textContent = 'Click an object to edit it. Drag to move, arrow keys nudge, Delete removes.'; p.append(h); return; }
    const live = ids.get(selected);
    const h = document.createElement('h3'); h.textContent = od.id + ' (' + od.type + ')'; p.append(h);
    const set = (path, value) => send({ type: 'set', id: selected, path, value });
    const num = (label, path, get, dflt) => p.append(field(label, get(), (v) => set(path, v), 'number'));
    p.append(field('name', od.name, (v) => set(['name'], v || undefined)));
    num('x', ['x'], () => (drag && live ? live.x : od.x ?? 0));
    num('y', ['y'], () => (drag && live ? live.y : od.y ?? 0));
    if (od.type !== 'graphics') num('rotation', ['rotation'], () => od.rotation ?? 0);
    num('alpha', ['alpha'], () => od.alpha ?? 1);
    for (const axis of ['x', 'y']) p.append(field('scale ' + axis, (od.scale || {})[axis] ?? 1, (v) => set(['scale'], { x: 1, y: 1, ...(od.scale || {}), [axis]: v ?? 1 }), 'number'));
    if ('width' in od || od.type === 'tileSprite' || od.type === 'rectangle' || od.type === 'ellipse') { num('width', ['width'], () => od.width); num('height', ['height'], () => od.height); }
    if (od.type === 'text' || od.type === 'bitmapText') p.append(field('text', od.text, (v) => set(['text'], v)));
    if (od.key !== undefined) p.append(field('key', od.key, (v) => set(['key'], v)));
    if (live && !live.parentContainer) num('depth', ['depth'], () => od.depth);
    p.append(field('visible', od.visible !== false, (v) => set(['visible'], v ? undefined : false), 'check'));
  }

  // ---- messages ----------------------------------------------------------------------------------------------
  window.addEventListener('message', (e) => {
    const m = e.data;
    if (m.type === 'error') { status(m.message, true); return; }
    if (m.type !== 'load') return;
    const first = !doc;
    doc = m.doc;
    project = m.project || { assets: [], animations: [] };
    problems = m.problems || [];
    const sk = doc.size.width + 'x' + doc.size.height + (doc.background || '');
    const ak = JSON.stringify(project.assets);
    if (!game || sk !== sizeKey || ak !== assetKey) {
      sizeKey = sk; assetKey = ak;
      createGame();
    } else {
      rebuild();
    }
  });

  $('zoom-in').addEventListener('click', () => { zoom = Math.min(8, zoom * 1.25); applyZoom(); });
  $('zoom-out').addEventListener('click', () => { zoom = Math.max(0.1, zoom / 1.25); applyZoom(); });
  $('zoom-fit').addEventListener('click', fit);

  window.__editor = { get selected() { return selected; }, get doc() { return doc; }, ids, select, pick, get game() { return game; } };
  send({ type: 'ready' });
})();
