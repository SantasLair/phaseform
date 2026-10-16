// Prototype PHASEFORM reference loader: PHASEFORM v0.1 scene document -> objects in a live Phaser 4 scene.
// Follows docs/SPEC.md: defaults, validation of blend/tint names and frames, container draw order, script hooks.
// build(scene, doc, { modules, animations }) takes modules as { 'scripts/x.js': { create, update } } and the project's
// animation definitions, which are created in the game's animation manager if missing. The placeholder is ignored.
window.PhaseformLoader = (function () {
  const BLEND = { normal: 'NORMAL', add: 'ADD', multiply: 'MULTIPLY', screen: 'SCREEN' };
  const SHAPES = new Set(['rectangle', 'ellipse', 'triangle', 'line', 'polygon', 'star', 'arc']);
  const ALIGN = { left: 0, center: 1, right: 2 };
  const flat = (pts) => pts.flatMap(p => [p.x, p.y]);
  const TINT = { multiply: 'MULTIPLY', fill: 'FILL', add: 'ADD', screen: 'SCREEN', overlay: 'OVERLAY', 'hard-light': 'HARD_LIGHT' };

  function clear(scene) {
    for (const o of scene.children.list.slice()) o.destroy();
  }

  function build(scene, doc, opts) {
    const modules = (opts && opts.modules) || {};
    const warnings = [];
    const ids = new Set();
    const scripted = [];
    for (const a of (opts && opts.animations) || []) if (!scene.anims.exists(a.key)) scene.anims.create(JSON.parse(JSON.stringify(a)));

    function make(d, parent) {
      if (ids.has(d.id)) throw new Error(`duplicate id "${d.id}"`);
      ids.add(d.id);
      const x = d.x || 0, y = d.y || 0;
      let o;
      switch (d.type) {
        case 'image':
        case 'sprite':
        case 'tileSprite': {
          const tex = scene.textures.exists(d.key) ? scene.textures.get(d.key) : null;
          if (!tex) { warnings.push(`${d.id}: texture "${d.key}" not loaded`); }
          else if (d.frame !== undefined && !tex.has(d.frame)) throw new Error(`${d.id}: texture "${d.key}" has no frame ${JSON.stringify(d.frame)}`);
          if (d.type === 'tileSprite') {
            o = scene.add.tileSprite(x, y, d.width, d.height, d.key, d.frame);
            if (d.tilePosition) o.setTilePosition(d.tilePosition.x, d.tilePosition.y);
            if (d.tileScale) o.setTileScale(d.tileScale.x, d.tileScale.y);
            if (d.tileRotation) o.setTileRotation(d.tileRotation);
          } else o = d.type === 'image' ? scene.add.image(x, y, d.key, d.frame) : scene.add.sprite(x, y, d.key, d.frame);
          break;
        }
        case 'text':
          o = scene.add.text(x, y, d.text, JSON.parse(JSON.stringify(d.style || {})));
          break;
        case 'container':
          o = scene.add.container(x, y);
          break;
        case 'graphics':
          o = scene.add.graphics({ x, y });
          break;
        case 'bitmapText': {
          if (!scene.cache.bitmapFont.exists(d.font)) throw new Error(`${d.id}: bitmap font "${d.font}" not loaded`);
          o = scene.add.bitmapText(x, y, d.font, d.text, d.size, ALIGN[d.align || 'left']);
          if (d.letterSpacing) o.setLetterSpacing(d.letterSpacing);
          if (d.lineSpacing) o.setLineSpacing(d.lineSpacing);
          if (d.maxWidth) o.setMaxWidth(d.maxWidth);
          if (d.dropShadow) o.setDropShadow(d.dropShadow.x, d.dropShadow.y, d.dropShadow.color === undefined ? 0 : parseInt(d.dropShadow.color.slice(1), 16), d.dropShadow.alpha === undefined ? 0.5 : d.dropShadow.alpha);
          break;
        }
        case 'rectangle':
          o = scene.add.rectangle(x, y, d.width, d.height);
          break;
        case 'ellipse':
          o = scene.add.ellipse(x, y, d.width, d.height);
          if (d.smoothness !== undefined) o.smoothness = d.smoothness;
          break;
        case 'triangle': {
          const [a, b, c] = d.points;
          o = scene.add.triangle(x, y, a.x, a.y, b.x, b.y, c.x, c.y);
          break;
        }
        case 'line': {
          const [a, b] = d.points;
          o = scene.add.line(x, y, a.x, a.y, b.x, b.y);
          break;
        }
        case 'polygon':
          o = scene.add.polygon(x, y, flat(d.points));
          break;
        case 'star':
          o = scene.add.star(x, y, d.pointCount === undefined ? 5 : d.pointCount, d.innerRadius, d.outerRadius);
          break;
        case 'arc':
          o = scene.add.arc(x, y, d.radius, d.startAngle, d.endAngle, d.anticlockwise);
          if (d.iterations !== undefined) o.iterations = d.iterations;
          break;
        default:
          warnings.push(`${d.id}: unsupported type "${d.type}" skipped`);
          return null;
      }
      if (d.name !== undefined) o.name = d.name;
      if (!parent && d.depth !== undefined) o.setDepth(d.depth);
      if (d.alpha !== undefined) o.setAlpha(d.alpha);
      if (d.visible === false) o.setVisible(false);
      if (d.active === false) o.setActive(false);
      if (d.scrollFactor) o.setScrollFactor(d.scrollFactor.x, d.scrollFactor.y);
      if (d.data) for (const [k, v] of Object.entries(d.data)) o.setData(k, v);
      if (d.rotation !== undefined) o.setRotation(d.rotation);
      if (d.scale) o.setScale(d.scale.x, d.scale.y);
      if (SHAPES.has(d.type)) {
        // a shape drawn without fill or stroke is invisible, so the document must say so explicitly
        o.isFilled = false; o.isStroked = false;
        if (d.fill) o.setFillStyle(parseInt(d.fill.color.slice(1), 16), d.fill.alpha);
        if (d.stroke) {
          const w = d.stroke.width === undefined ? 1 : d.stroke.width;
          o.setStrokeStyle(w, parseInt(d.stroke.color.slice(1), 16), d.stroke.alpha);
          // a WebGL line renders from its own start and end widths, so setStrokeStyle alone leaves it 1px wide
          if (d.type === 'line') o.setLineWidth(w, d.stroke.endWidth === undefined ? w : d.stroke.endWidth);
        }
        if (d.origin) o.setOrigin(d.origin.x, d.origin.y);
      }
      if (d.type !== 'container' && d.type !== 'graphics' && !SHAPES.has(d.type)) {
        if (d.origin) o.setOrigin(d.origin.x, d.origin.y);
        if (d.flipX) o.setFlipX(true);
        if (d.flipY) o.setFlipY(true);
        if (d.tint !== undefined) o.setTint(parseInt(d.tint.slice(1), 16));
        if (d.tintMode !== undefined) {
          if (!TINT[d.tintMode]) throw new Error(`${d.id}: unknown tintMode "${d.tintMode}"`);
          o.setTintMode(Phaser.TintModes[TINT[d.tintMode]]);
        }
      }
      if (d.blendMode !== undefined) {
        if (!BLEND[d.blendMode]) throw new Error(`${d.id}: unknown blendMode "${d.blendMode}"`);
        o.setBlendMode(Phaser.BlendModes[BLEND[d.blendMode]]);
      }
      if (d.animation) {
        if (!scene.anims.exists(d.animation.key)) warnings.push(`${d.id}: animation "${d.animation.key}" not defined`);
        else o.play({ key: d.animation.key, startFrame: d.animation.startFrame || 0 });
      }
      if (d.type === 'container') {
        for (const c of d.children || []) { const child = make(c, o); if (child) o.add(child); }
      }
      const p = d.placeholder;
      const ctx = { params: d.params ? JSON.parse(JSON.stringify(d.params)) : {}, size: p && p.width && p.height ? { width: p.width, height: p.height } : null };
      o.setData('phaseform', ctx);
      if (d.scripts && d.scripts.length) scripted.push({ o, ctx, id: d.id, paths: d.scripts });
      return o;
    }

    if (doc.background) scene.cameras.main.setBackgroundColor(doc.background);
    const roots = [];
    for (const d of doc.objects) { const o = make(d, null); if (o) roots.push(o); }
    // create hooks run once all objects exist, in document order; update hooks run every frame while the object is active
    const updaters = [];
    for (const s of scripted) {
      for (const path of s.paths) {
        const m = modules[path];
        if (!m) { warnings.push(`${s.id}: script "${path}" not provided`); continue; }
        if (m.create) m.create(s.o, scene, s.ctx);
        if (m.update) updaters.push({ o: s.o, fn: m.update });
      }
    }
    if (updaters.length) {
      const onUpdate = (time, delta) => { for (const u of updaters) if (u.o.active) u.fn(u.o, scene, time, delta); };
      scene.events.on('update', onUpdate);
      scene.events.once('shutdown', () => scene.events.off('update', onUpdate));
    }
    return { objects: roots, warnings };
  }

  return { build, clear };
})();
