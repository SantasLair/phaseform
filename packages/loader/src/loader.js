// Prototype PHASEFORM reference loader: PHASEFORM v0.1 scene document -> objects in a live Phaser 4 scene.
// Follows docs/SPEC.md: defaults, validation of blend/tint names and frames, container draw order, script hooks.
// build(scene, doc, { modules, animations }) takes modules as { 'scripts/x.js': { create, update } } and the project's
// animation definitions, which are created in the game's animation manager if missing. The placeholder is ignored.
// Phaser is passed in so the module has no import of its own; src/index.js binds it to the installed phaser package.
export function createLoader(Phaser) {
  const BLEND = { normal: 'NORMAL', add: 'ADD', multiply: 'MULTIPLY', screen: 'SCREEN' };
  const SHAPES = new Set(['rectangle', 'ellipse', 'triangle', 'line', 'polygon', 'star', 'arc']);
  const ALIGN = { left: 0, center: 1, right: 2 };
  const flat = (pts) => pts.flatMap(p => [p.x, p.y]);
  const TINT = { multiply: 'MULTIPLY', fill: 'FILL', add: 'ADD', screen: 'SCREEN', overlay: 'OVERLAY', 'hard-light': 'HARD_LIGHT' };
  const rgb = (c) => parseInt(c.slice(1), 16);
  // filter blend modes are Phaser's BlendModes names in lowercase with hyphens; the blend filter's shader renders all of them
  const blendNum = (name) => {
    const v = Phaser.BlendModes[name.toUpperCase().replace(/-/g, '_')];
    if (v === undefined || v < 0) throw new Error(`unknown filter blend mode "${name}"`);
    return v;
  };
  // [direction, axis], as set by Wipe#setLeftToRight and its siblings
  const WIPE = { 'left-to-right': [0, 0], 'right-to-left': [1, 0], 'top-to-bottom': [1, 1], 'bottom-to-top': [0, 1] };
  const has = (v) => v !== undefined;
  const pick = (d, keys) => { const cfg = {}; for (const k of keys) if (has(d[k])) cfg[k] = Array.isArray(d[k]) ? d[k].slice() : d[k]; return cfg; };
  const band = (b) => {
    const out = Object.assign({}, b);
    if (typeof b.colorStart === 'string') out.colorStart = rgb(b.colorStart);
    if (typeof b.colorEnd === 'string') out.colorEnd = rgb(b.colorEnd);
    return out;
  };

  // Adds the filter entries in `list` to a Phaser FilterList, in order. `byId` resolves object references.
  function addFilters(fl, list, byId, id, warnings) {
    const ref = (field, v) => {
      const o = byId.get(v);
      if (!o) throw new Error(`${id}: ${field} refers to missing id "${v}"`);
      return o;
    };
    for (const d of list || []) {
      let c;
      switch (d.type) {
        case 'barrel': c = fl.addBarrel(d.amount); break;
        case 'blend': c = fl.addBlend(d.texture, has(d.blendMode) ? blendNum(d.blendMode) : undefined, d.amount, d.color && d.color.slice()); break;
        case 'blocky': c = fl.addBlocky(pick(d, ['size', 'offset'])); break;
        case 'blur': c = fl.addBlur(d.quality, d.x, d.y, d.strength, has(d.color) ? rgb(d.color) : undefined, d.steps); break;
        case 'bokeh': c = fl.addBokeh(d.radius, d.amount, d.contrast); break;
        case 'tiltShift': c = fl.addTiltShift(d.radius, d.amount, d.contrast, d.blurX, d.blurY, d.strength); break;
        case 'colorMatrix':
          c = fl.addColorMatrix();
          if (d.matrix) c.colorMatrix.set(d.matrix);
          if (has(d.alpha)) c.colorMatrix.alpha = d.alpha;
          break;
        case 'combineColorMatrix':
          c = fl.addCombineColorMatrix(d.texture);
          if (d.matrixSelf) c.colorMatrixSelf.set(d.matrixSelf);
          if (d.matrixTransfer) c.colorMatrixTransfer.set(d.matrixTransfer);
          if (d.additions) c.additions = d.additions.slice();
          if (d.multiplications) c.multiplications = d.multiplications.slice();
          break;
        case 'displacement': c = fl.addDisplacement(d.texture, d.x, d.y); break;
        case 'glow': c = fl.addGlow(has(d.color) ? rgb(d.color) : undefined, d.outerStrength, d.innerStrength, d.scale, d.knockout, d.quality, d.distance); break;
        case 'gradientMap': {
          const cfg = pick(d, ['dither', 'color', 'colorFactor', 'unpremultiply', 'alpha']);
          if (d.ramp) cfg.ramp = d.ramp.map(band);
          c = fl.addGradientMap(cfg);
          break;
        }
        case 'imageLight': {
          const cfg = pick(d, ['normalMap', 'environmentMap', 'modelRotation', 'bulge', 'colorFactor']);
          if (has(d.modelRotationSource)) cfg.modelRotationSource = ref('imageLight.modelRotationSource', d.modelRotationSource);
          c = fl.addImageLight(cfg);
          break;
        }
        case 'key': {
          const cfg = pick(d, ['alpha', 'isolate', 'threshold', 'feather']);
          if (has(d.color)) cfg.color = rgb(d.color);
          c = fl.addKey(cfg);
          break;
        }
        case 'mask': {
          if (has(d.source) && has(d.texture)) throw new Error(`${id}: mask has both source and texture`);
          c = fl.addMask(has(d.source) ? ref('mask.source', d.source) : d.texture, d.invert, undefined, d.viewTransform, d.scaleFactor);
          if (d.autoUpdate === false) c.autoUpdate = false;
          break;
        }
        case 'normalTools': {
          const cfg = pick(d, ['rotation', 'facingPower', 'outputRatio', 'ratioVector', 'ratioRadius']);
          if (has(d.rotationSource)) cfg.rotationSource = ref('normalTools.rotationSource', d.rotationSource);
          c = fl.addNormalTools(cfg);
          break;
        }
        case 'panoramaBlur': c = fl.addPanoramaBlur(pick(d, ['radius', 'samplesX', 'samplesY', 'power'])); break;
        case 'parallel': {
          c = fl.addParallelFilters();
          addFilters(c.top, d.top, byId, id, warnings);
          addFilters(c.bottom, d.bottom, byId, id, warnings);
          const b = d.blend || {};
          if (has(b.blendMode)) c.blend.blendMode = blendNum(b.blendMode);
          if (has(b.amount)) c.blend.amount = b.amount;
          if (b.color) c.blend.color = b.color.slice();
          break;
        }
        case 'pixelate': c = fl.addPixelate(d.amount); break;
        case 'quantize': {
          const cfg = pick(d, ['steps', 'gamma', 'offset', 'dither']);
          if (has(d.mode)) cfg.mode = d.mode === 'hsva' ? 1 : 0;
          c = fl.addQuantize(cfg);
          break;
        }
        case 'shadow': c = fl.addShadow(d.x, d.y, d.decay, d.power, has(d.color) ? rgb(d.color) : undefined, d.samples, d.intensity); break;
        case 'threshold': c = fl.addThreshold(d.edge1, d.edge2, d.invert); break;
        case 'vignette': {
          if (has(d.blendMode) && !BLEND[d.blendMode]) throw new Error(`${id}: vignette blendMode "${d.blendMode}" not supported`);
          c = fl.addVignette(d.x, d.y, d.radius, d.strength, has(d.color) ? rgb(d.color) : undefined, has(d.blendMode) ? Phaser.BlendModes[BLEND[d.blendMode]] : undefined);
          break;
        }
        case 'wipe': {
          const w = WIPE[d.direction || 'left-to-right'];
          if (!w) throw new Error(`${id}: unknown wipe direction "${d.direction}"`);
          c = fl.addWipe(d.wipeWidth, w[0], w[1], d.reveal ? 1 : 0, d.texture);
          if (has(d.progress)) c.progress = d.progress;
          break;
        }
        default:
          warnings.push(`${id}: unsupported filter type "${d.type}" skipped`);
          continue;
      }
      if (d.active === false) c.active = false;
    }
  }

  function clear(scene) {
    for (const o of scene.children.list.slice()) o.destroy();
  }

  function build(scene, doc, opts) {
    const modules = (opts && opts.modules) || {};
    const warnings = [];
    const ids = new Set();
    const scripted = [];
    const byId = new Map();
    const filtered = [];
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
      byId.set(d.id, o);
      if (d.filters) filtered.push({ o, d });
      if (d.scripts && d.scripts.length) scripted.push({ o, ctx, id: d.id, paths: d.scripts });
      return o;
    }

    if (doc.background) scene.cameras.main.setBackgroundColor(doc.background);
    const roots = [];
    for (const d of doc.objects) { const o = make(d, null); if (o) roots.push(o); }
    // filters are added once every object exists, because a mask or light source can be any object in the scene
    for (const { o, d } of filtered) {
      o.enableFilters();
      addFilters(o.filters.internal, d.filters.internal, byId, d.id, warnings);
      addFilters(o.filters.external, d.filters.external, byId, d.id, warnings);
    }
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
}
