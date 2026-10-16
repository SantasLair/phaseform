// Prototype PHASEFORM serializer: live Phaser 4 scene -> PHASEFORM v0.1 scene document.
// Writes only fields that differ from the spec defaults. Anything the spec cannot express is recorded in
// report.lossy / report.unsupported instead of being dropped silently.
window.PhaseformSerializer = (function () {
  const BLEND = { 0: 'normal', 1: 'add', 2: 'multiply', 3: 'screen' };
  const TYPES = { Image: 'image', Sprite: 'sprite', Text: 'text', Container: 'container', Graphics: 'graphics',
    Rectangle: 'rectangle', Ellipse: 'ellipse', Triangle: 'triangle', Line: 'line', Polygon: 'polygon', Star: 'star', Arc: 'arc' };
  const SHAPES = new Set(['rectangle', 'ellipse', 'triangle', 'line', 'polygon', 'star', 'arc']);
  const SHADOW = { shadowOffsetX: 'offsetX', shadowOffsetY: 'offsetY', shadowColor: 'color', shadowBlur: 'blur', shadowStroke: 'stroke', shadowFill: 'fill' };
  const hex = (n) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
  const isPlain = (v) => v === null || typeof v !== 'object' || Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype;

  function tintModeName(mode) {
    for (const [k, v] of Object.entries(Phaser.TintModes)) if (v === mode) return k === 'MULTIPLY_TWO' ? null : k.toLowerCase().replace('_', '-');
    return null;
  }

  function serialize(scene) {
    const game = scene.sys.game;
    const report = { lossy: [], unsupported: [], codeDriven: [] };
    const counts = {};
    const nextId = (type) => { counts[type] = (counts[type] || 0) + 1; return `${type}-${counts[type]}`; };
    const probe = new Phaser.GameObjects.Text(scene, 0, 0, '', {});
    const defStyle = probe.style.toJSON();
    probe.destroy();

    function textStyle(o, id) {
      const cur = o.style.toJSON();
      const cfg = {};
      for (const k of Object.keys(cur)) {
        if (k === 'metrics' || k === 'wordWrapCallbackScope') continue;
        const v = cur[k];
        if (typeof v === 'function') { report.lossy.push({ id, field: 'style.' + k, why: 'function' }); continue; }
        if (!isPlain(v)) { report.lossy.push({ id, field: 'style.' + k, why: 'non-JSON value (' + (v.constructor && v.constructor.name) + ')' }); continue; }
        if (JSON.stringify(v) === JSON.stringify(defStyle[k])) continue;
        if (SHADOW[k]) (cfg.shadow ||= {})[SHADOW[k]] = v;
        else if (k === 'wordWrapWidth') (cfg.wordWrap ||= {}).width = v;
        else if (k === 'wordWrapUseAdvanced') (cfg.wordWrap ||= {}).useAdvancedWrap = v;
        else cfg[k] = v;
      }
      const p = o.padding;
      if (p && (p.left || p.right || p.top || p.bottom)) cfg.padding = { left: p.left, right: p.right, top: p.top, bottom: p.bottom };
      // metrics are always present in toJSON; keep them only when they differ from what Phaser would measure itself
      const measuredText = new Phaser.GameObjects.Text(scene, 0, 0, '', cfg);
      const measured = measuredText.getTextMetrics();
      measuredText.destroy();
      const m = o.getTextMetrics();
      if (m.ascent !== measured.ascent || m.descent !== measured.descent || m.fontSize !== measured.fontSize) cfg.metrics = { ascent: m.ascent, descent: m.descent, fontSize: m.fontSize };
      return cfg;
    }

    function one(o, isChild) {
      const type = TYPES[o.type];
      if (!type) { report.unsupported.push({ type: o.type, name: o.name || '' }); return null; }
      const id = nextId(type);
      const out = { id, type };
      if (o.name) out.name = o.name;
      if (o.x) out.x = o.x;
      if (o.y) out.y = o.y;
      if (type === 'graphics') report.codeDriven.push({ id, why: 'draw code is not recoverable from a live scene' });
      if (!isChild && o.depth) out.depth = o.depth;
      if (o.alpha !== 1) out.alpha = o.alpha;
      if (o.visible === false) out.visible = false;
      if (o.active === false) out.active = false;
      if (o.scrollFactorX !== 1 || o.scrollFactorY !== 1) out.scrollFactor = { x: o.scrollFactorX, y: o.scrollFactorY };
      if (o.data && o.data.getAll) {
        const all = o.data.getAll();
        if (Object.keys(all).length) {
          try { out.data = JSON.parse(JSON.stringify(all)); } catch (e) { report.lossy.push({ id, field: 'data', why: 'not JSON' }); }
        }
      }
      if (o.alphaTopLeft !== undefined && (o.alphaTopLeft !== o.alpha || o.alphaTopRight !== o.alpha || o.alphaBottomLeft !== o.alpha || o.alphaBottomRight !== o.alpha)) report.lossy.push({ id, field: 'alpha', why: 'per-corner alpha' });
      if (o.mask) report.lossy.push({ id, field: 'mask', why: 'masks not in spec' });
      if (o.filters && ((o.filters.internal && o.filters.internal.list && o.filters.internal.list.length) || (o.filters.external && o.filters.external.list && o.filters.external.list.length))) report.lossy.push({ id, field: 'filters', why: 'filters not in spec' });
      if (o.isCropped) report.lossy.push({ id, field: 'crop', why: 'crop not in spec' });
      if (o.input) report.lossy.push({ id, field: 'input', why: 'input is behavior', benign: true });
      if (o.body) report.lossy.push({ id, field: 'physics body', why: 'extension territory', benign: true });
      if (o.anims && o.anims.isPlaying) report.lossy.push({ id, field: 'animation', why: 'animations not in spec', benign: true });

      if (o.rotation) out.rotation = o.rotation;
      if (o.scaleX !== 1 || o.scaleY !== 1) out.scale = { x: o.scaleX, y: o.scaleY };

      if (SHAPES.has(type)) {
        if (o.originX !== 0.5 || o.originY !== 0.5) out.origin = { x: o.originX, y: o.originY };
        if (o.isFilled) { out.fill = { color: hex(o.fillColor) }; if (o.fillAlpha !== 1) out.fill.alpha = o.fillAlpha; }
        if (o.isStroked) { out.stroke = { color: hex(o.strokeColor) }; const w = type === 'line' ? o._startWidth : o.lineWidth;
          if (w !== 1) out.stroke.width = w;
          if (type === 'line' && o._endWidth !== w) out.stroke.endWidth = o._endWidth; if (o.strokeAlpha !== 1) out.stroke.alpha = o.strokeAlpha; }
        if (o.closePath !== true) report.lossy.push({ id, field: 'closePath', why: 'not in spec' });
        if (o.lightingActive) report.lossy.push({ id, field: 'lighting', why: 'not in spec' });
      }
      if (type !== 'container' && type !== 'graphics' && !SHAPES.has(type)) {
        const dflt = type === 'text' ? 0 : 0.5;
        if (o.originX !== dflt || o.originY !== dflt) out.origin = { x: o.originX, y: o.originY };
        if (o.isTinted) {
          const t = o.tintTopLeft;
          if (o.tintTopRight === t && o.tintBottomLeft === t && o.tintBottomRight === t) out.tint = hex(t);
          else report.lossy.push({ id, field: 'tint', why: 'per-corner tint' });
          if (o.tintMode) {
            const name = tintModeName(o.tintMode);
            if (name) out.tintMode = name; else report.lossy.push({ id, field: 'tintMode', why: 'mode ' + o.tintMode + ' not in spec' });
          }
        }
        if (type !== 'text' && (o.flipX || o.flipY)) { if (o.flipX) out.flipX = true; if (o.flipY) out.flipY = true; }
        if (type === 'text' && (o.flipX || o.flipY)) report.lossy.push({ id, field: 'flip', why: 'flip on text' });
      }
      if (o.blendMode && !(type === 'container' && o.blendMode === -1)) {
        if (BLEND[o.blendMode]) out.blendMode = BLEND[o.blendMode];
        else report.lossy.push({ id, field: 'blendMode', why: 'mode ' + o.blendMode + ' not in spec' });
      }

      if (type === 'image' || type === 'sprite') {
        out.key = o.texture.key;
        if (o.frame.name !== o.texture.firstFrame) out.frame = o.frame.name;
      } else if (type === 'text') {
        out.text = o.text;
        const style = textStyle(o, id);
        if (Object.keys(style).length) out.style = style;
        if (o.lineSpacing) report.lossy.push({ id, field: 'lineSpacing', why: 'not in spec' });
      } else if (type === 'rectangle') {
        out.width = o.geom.width; out.height = o.geom.height;
      } else if (type === 'ellipse') {
        out.width = o.geom.width; out.height = o.geom.height;
        if (o.smoothness !== 64) out.smoothness = o.smoothness;
      } else if (type === 'triangle') {
        const g = o.geom;
        out.points = [{ x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 }, { x: g.x3, y: g.y3 }];
      } else if (type === 'line') {
        const g = o.geom;
        out.points = [{ x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 }];
      } else if (type === 'polygon') {
        out.points = o.geom.points.map(p => ({ x: p.x, y: p.y }));
      } else if (type === 'star') {
        if (o.points !== 5) out.pointCount = o.points;
        out.innerRadius = o.innerRadius; out.outerRadius = o.outerRadius;
      } else if (type === 'arc') {
        out.radius = o.radius;
        if (o.startAngle !== 0) out.startAngle = o.startAngle;
        if (o.endAngle !== 360) out.endAngle = o.endAngle;
        if (o.anticlockwise) out.anticlockwise = true;
        if (o.iterations !== 0.01) out.iterations = o.iterations;
      } else if (type === 'container') {
        out.children = [];
        for (const c of o.list) { const s = one(c, true); if (s) out.children.push(s); }
      }
      return out;
    }

    const objects = [];
    for (const o of scene.children.list) { const s = one(o, false); if (s) objects.push(s); }
    const doc = {
      format: 'phaseform',
      version: '0.1.0',
      key: scene.sys.settings.key,
      size: { width: game.scale.gameSize.width, height: game.scale.gameSize.height },
      objects
    };
    const bg = scene.cameras.main.backgroundColor;
    if (bg && bg.alpha > 0) doc.background = hex((bg.red << 16) | (bg.green << 8) | bg.blue);
    return { doc, report };
  }

  return { serialize };
})();
