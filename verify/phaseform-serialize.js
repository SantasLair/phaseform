// Prototype PHASEFORM serializer: live Phaser 4 scene -> PHASEFORM v0.1 scene document.
// Writes only fields that differ from the spec defaults. Anything the spec cannot express is recorded in
// report.lossy / report.unsupported instead of being dropped silently.
window.PhaseformSerializer = (function () {
  const BLEND = { 0: 'normal', 1: 'add', 2: 'multiply', 3: 'screen' };
  const TYPES = { Image: 'image', Sprite: 'sprite', Text: 'text', Container: 'container', Graphics: 'graphics', BitmapText: 'bitmapText', TileSprite: 'tileSprite',
    Rectangle: 'rectangle', Ellipse: 'ellipse', Triangle: 'triangle', Line: 'line', Polygon: 'polygon', Star: 'star', Arc: 'arc' };
  const SHAPES = new Set(['rectangle', 'ellipse', 'triangle', 'line', 'polygon', 'star', 'arc']);
  const SHADOW = { shadowOffsetX: 'offsetX', shadowOffsetY: 'offsetY', shadowColor: 'color', shadowBlur: 'blur', shadowStroke: 'stroke', shadowFill: 'fill' };
  const hex = (n) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
  const isPlain = (v) => v === null || typeof v !== 'object' || Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype;
  const IDENTITY = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  const WIPE_DIR = { '0,0': 'left-to-right', '1,0': 'right-to-left', '1,1': 'top-to-bottom', '0,1': 'bottom-to-top' };
  const blendName = (n) => { for (const [k, v] of Object.entries(Phaser.BlendModes)) if (v === n && v >= 0) return k.toLowerCase().replace(/_/g, '-'); return null; };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const arr = (v) => Array.from(v);
  const scalar4 = (v) => { const a = arr(v); return a.every(x => x === a[0]) ? a[0] : a; };
  // Phaser filters keep the GL texture, not the key, so the key is found by searching the texture manager
  const glKey = (scene, gl) => { if (!gl) return undefined; for (const [k, t] of Object.entries(scene.sys.textures.list)) if (t.source && t.source.some(src => src.glTexture === gl)) return k; return undefined; };
  const bandColor = (c) => c.alpha === 255 ? hex(c.color) : [c.redGL, c.greenGL, c.blueGL, c.alphaGL];

  // Serializes one FilterList. `idOf` maps a game object to its document id. Writes only fields that differ from
  // the defaults in docs/SPEC.md, and reports what the spec cannot express.
  function filterList(scene, fl, idOf, id, report, path) {
    const F = Phaser.Filters;
    const out = [];
    const objRef = (o, field) => {
      if (!o) return undefined;
      const r = idOf.get(o);
      if (r === undefined) report.lossy.push({ id, field: path + '.' + field, why: 'source object is not in the scene document' });
      return r;
    };
    for (const c of fl.list) {
      const e = {};
      const put = (k, v, d) => { if (v !== undefined && !same(v, d)) e[k] = v; };
      if (c instanceof F.Barrel) { e.type = 'barrel'; put('amount', c.amount, 1); }
      else if (c instanceof F.Blend) {
        e.type = 'blend';
        put('texture', glKey(scene, c.glTexture), '__WHITE');
        put('blendMode', blendName(c.blendMode), 'normal'); put('amount', c.amount, 1); put('color', arr(c.color), [1, 1, 1, 1]);
      }
      else if (c instanceof F.Blocky) { e.type = 'blocky'; put('size', { x: c.size.x, y: c.size.y }, { x: 4, y: 4 }); put('offset', { x: c.offset.x, y: c.offset.y }, { x: 0, y: 0 }); }
      else if (c instanceof F.Blur) { e.type = 'blur'; put('quality', c.quality, 0); put('x', c.x, 2); put('y', c.y, 2); put('strength', c.strength, 1); put('color', hex(c.color), '#ffffff'); put('steps', c.steps, 4); }
      else if (c instanceof F.Bokeh) {
        e.type = c.isTiltShift ? 'tiltShift' : 'bokeh';
        put('radius', c.radius, 0.5); put('amount', c.amount, 1); put('contrast', c.contrast, 0.2);
        if (c.isTiltShift) { put('blurX', c.blurX, 1); put('blurY', c.blurY, 1); put('strength', c.strength, 1); }
      }
      else if (c instanceof F.ColorMatrix) { e.type = 'colorMatrix'; put('matrix', arr(c.colorMatrix._matrix), IDENTITY); put('alpha', c.colorMatrix.alpha, 1); }
      else if (c instanceof F.CombineColorMatrix) {
        e.type = 'combineColorMatrix';
        put('texture', glKey(scene, c.glTexture), '__WHITE');
        put('matrixSelf', arr(c.colorMatrixSelf._matrix), IDENTITY); put('matrixTransfer', arr(c.colorMatrixTransfer._matrix), IDENTITY);
        put('additions', arr(c.additions), [1, 1, 1, 0]); put('multiplications', arr(c.multiplications), [0, 0, 0, 1]);
      }
      else if (c instanceof F.Displacement) {
        e.type = 'displacement';
        put('texture', glKey(scene, c.glTexture), '__WHITE');
        put('x', c.x, 0.005); put('y', c.y, 0.005);
      }
      else if (c instanceof F.Glow) {
        e.type = 'glow'; put('color', hex(c.color), '#ffffff'); put('outerStrength', c.outerStrength, 4); put('innerStrength', c.innerStrength, 0);
        put('scale', c.scale, 1); put('knockout', c.knockout, false);
        const cfg = c.camera.scene.sys.game.config;
        put('quality', c.quality, cfg.glowQuality); put('distance', c.distance, cfg.glowDistance);
      }
      else if (c instanceof F.GradientMap) {
        e.type = 'gradientMap';
        const BAND = { start: 0, middle: 0.5, end: 1, interpolation: 0, colorSpace: 0 };
        const ramp = c.ramp.bands.map(b => { const o = { colorStart: bandColor(b.colorStart), colorEnd: bandColor(b.colorEnd) }; for (const k of Object.keys(BAND)) if (b[k] !== BAND[k]) o[k] = b[k]; return o; });
        if (!same(ramp, [{ colorStart: '#000000', colorEnd: '#ffffff' }])) e.ramp = ramp;
        put('dither', c.dither, false); put('color', arr(c.color), [0, 0, 0, 0]); put('colorFactor', arr(c.colorFactor), [0.3, 0.6, 0.1, 0]);
        put('unpremultiply', c.unpremultiply, true); put('alpha', c.alpha, 1);
      }
      else if (c instanceof F.ImageLight) {
        e.type = 'imageLight';
        put('normalMap', glKey(scene, c.normalGlTexture), '__NORMAL');
        put('environmentMap', glKey(scene, c.environmentGlTexture), '__WHITE');
        put('modelRotation', c.modelRotation, 0); put('bulge', c.bulge, 0); put('colorFactor', arr(c.colorFactor), [1, 1, 1]);
        if (typeof c.modelRotationSource === 'function') report.lossy.push({ id, field: path + '.modelRotationSource', why: 'callback' });
        else put('modelRotationSource', objRef(c.modelRotationSource, 'modelRotationSource'), undefined);
      }
      else if (c instanceof F.Key) {
        e.type = 'key'; const k = arr(c.color);
        put('color', hex((Math.round(k[0] * 255) << 16) | (Math.round(k[1] * 255) << 8) | Math.round(k[2] * 255)), '#ffffff');
        put('alpha', k[3], 1); put('isolate', c.isolate, false); put('threshold', c.threshold, 0.0625); put('feather', c.feather, 0);
      }
      else if (c instanceof F.Mask) {
        e.type = 'mask';
        if (c.maskGameObject) e.source = objRef(c.maskGameObject, 'source');
        else put('texture', glKey(scene, c.glTexture), '__WHITE');
        put('invert', c.invert, false); put('viewTransform', c.viewTransform, 'world'); put('scaleFactor', c.scaleFactor, 1); put('autoUpdate', c.autoUpdate, true);
        if (c.viewCamera) report.lossy.push({ id, field: path + '.viewCamera', why: 'not in spec' });
        if (e.source === undefined) delete e.source;
      }
      else if (c instanceof F.NormalTools) {
        e.type = 'normalTools'; put('rotation', c.rotation, 0); put('facingPower', c.facingPower, 1); put('outputRatio', c.outputRatio, false);
        put('ratioVector', [c.ratioVector.x, c.ratioVector.y, c.ratioVector.z], [0, 0, 1]); put('ratioRadius', c.ratioRadius, 1);
        if (typeof c.rotationSource === 'function') report.lossy.push({ id, field: path + '.rotationSource', why: 'callback' });
        else put('rotationSource', objRef(c.rotationSource, 'rotationSource'), undefined);
      }
      else if (c instanceof F.PanoramaBlur) { e.type = 'panoramaBlur'; put('radius', c.radius, 1); put('samplesX', c.samplesX, 32); put('samplesY', c.samplesY, 16); put('power', c.power, 1); }
      else if (c instanceof F.ParallelFilters) {
        e.type = 'parallel';
        const top = filterList(scene, c.top, idOf, id, report, path + '.top'), bottom = filterList(scene, c.bottom, idOf, id, report, path + '.bottom');
        if (top.length) e.top = top;
        if (bottom.length) e.bottom = bottom;
        const b = {};
        if (c.blend.blendMode) b.blendMode = blendName(c.blend.blendMode);
        if (c.blend.amount !== 1) b.amount = c.blend.amount;
        if (!same(arr(c.blend.color), [1, 1, 1, 1])) b.color = arr(c.blend.color);
        if (Object.keys(b).length) e.blend = b;
      }
      else if (c instanceof F.Pixelate) { e.type = 'pixelate'; put('amount', c.amount, 1); }
      else if (c instanceof F.Quantize) {
        e.type = 'quantize'; put('steps', arr(c.steps), [8, 8, 8, 8]); put('gamma', arr(c.gamma), [1, 1, 1, 1]); put('offset', arr(c.offset), [0, 0, 0, 0]);
        put('mode', c.mode === 1 ? 'hsva' : 'rgba', 'rgba'); put('dither', c.dither, false);
      }
      else if (c instanceof F.Shadow) { e.type = 'shadow'; put('x', c.x, 0); put('y', c.y, 0); put('decay', c.decay, 0.1); put('power', c.power, 1); put('color', hex(c.color), '#000000'); put('samples', c.samples, 6); put('intensity', c.intensity, 1); }
      else if (c instanceof F.Threshold) { e.type = 'threshold'; put('edge1', scalar4(c.edge1), 0.5); put('edge2', scalar4(c.edge2), 0.5); put('invert', scalar4(c.invert), false); }
      else if (c instanceof F.Vignette) {
        e.type = 'vignette'; put('x', c.x, 0.5); put('y', c.y, 0.5); put('radius', c.radius, 0.5); put('strength', c.strength, 0.5);
        put('color', hex(c.color.color), '#000000');
        if (c.blendMode) { if (BLEND[c.blendMode]) e.blendMode = BLEND[c.blendMode]; else report.lossy.push({ id, field: path + '.blendMode', why: 'vignette mode ' + c.blendMode }); }
      }
      else if (c instanceof F.Wipe) {
        e.type = 'wipe'; put('progress', c.progress, 0); put('wipeWidth', c.wipeWidth, 0.1); put('direction', WIPE_DIR[c.direction + ',' + c.axis], 'left-to-right'); put('reveal', !!c.reveal, false);
        if (c.wipeTexture && c.wipeTexture.key !== '__DEFAULT') e.texture = c.wipeTexture.key;
      }
      else { report.lossy.push({ id, field: path, why: 'filter ' + ((c.renderNode && String(c.renderNode)) || 'type') + ' not in spec (e.g. sampler)' }); continue; }
      if (c.active === false) e.active = false;
      if (c.paddingOverride !== null && c.paddingOverride && (c.paddingOverride.x || c.paddingOverride.y || c.paddingOverride.width || c.paddingOverride.height)) report.lossy.push({ id, field: path + '.paddingOverride', why: 'not in spec' });
      // put the type first for readability
      out.push(Object.assign({ type: e.type }, e));
    }
    return out;
  }

  // Phaser renders from a cached display origin that only setOrigin() updates. Assigning originX/originY directly
  // changes the property but not the rendering, so the effective origin is read back from the display origin.
  // BitmapText recomputes its own display origin from its text bounds, so it is read as is.
  function effectiveOrigin(o) {
    let x = o.originX, y = o.originY;
    if (o.type === 'BitmapText') return { x, y };
    if (o.width && Math.abs(o.displayOriginX - x * o.width) > 1e-6) x = o.displayOriginX / o.width;
    if (o.height && Math.abs(o.displayOriginY - y * o.height) > 1e-6) y = o.displayOriginY / o.height;
    return { x, y };
  }

  function tintModeName(mode) {
    for (const [k, v] of Object.entries(Phaser.TintModes)) if (v === mode) return k === 'MULTIPLY_TWO' ? null : k.toLowerCase().replace('_', '-');
    return null;
  }

  function animationDef(a) {
    const out = { key: a.key, frames: a.frames.map(f => {
      const fr = { key: f.textureKey };
      if (f.textureFrame !== undefined && f.textureFrame !== '__BASE') fr.frame = f.textureFrame;
      if (f.duration) fr.duration = f.duration;
      return fr;
    }) };
    out.frameRate = a.frameRate;
    for (const [k, d] of [['delay', 0], ['repeat', 0], ['repeatDelay', 0], ['yoyo', false], ['showBeforeDelay', false], ['showOnStart', false], ['hideOnComplete', false], ['skipMissedFrames', true], ['randomFrame', false]]) {
      if (a[k] !== d) out[k] = a[k];
    }
    return out;
  }

  // Animations are global to the game, so they belong in the project file, not the scene document.
  function animations(game) {
    return game.anims.anims.getArray().map(animationDef);
  }

  function serialize(scene) {
    const game = scene.sys.game;
    const report = { lossy: [], unsupported: [], codeDriven: [] };
    const counts = {};
    const nextId = (type) => { counts[type] = (counts[type] || 0) + 1; return `${type}-${counts[type]}`; };
    const idOf = new Map();
    const filtered = [];
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
      idOf.set(o, id);
      if (o.filters && ((o.filters.internal && o.filters.internal.list.length) || (o.filters.external && o.filters.external.list.length))) filtered.push({ o, out, id });
      if (o.isCropped) report.lossy.push({ id, field: 'crop', why: 'crop not in spec' });
      if (o.input) report.lossy.push({ id, field: 'input', why: 'input is behavior', benign: true });
      if (o.body) report.lossy.push({ id, field: 'physics body', why: 'extension territory', benign: true });
      if (o.anims && o.anims.isPlaying && o.anims.currentAnim) {
        if (type === 'sprite') {
          out.animation = { key: o.anims.currentAnim.key };
          const at = o.anims.currentFrame ? o.anims.currentFrame.index - 1 : 0; // AnimationFrame.index is 1-based, startFrame is 0-based
          if (at) out.animation.startFrame = at;
          if (o.anims.timeScale !== 1) report.lossy.push({ id, field: 'animation.timeScale', why: 'not in spec' });
        } else report.lossy.push({ id, field: 'animation', why: 'animations on ' + type + ' not in spec' });
      }
      if (o.anims && o.anims.anims && o.anims.anims.size) report.lossy.push({ id, field: 'animation', why: 'sprite-local animations not in spec' });

      if (o.rotation) out.rotation = o.rotation;
      if (o.scaleX !== 1 || o.scaleY !== 1) out.scale = { x: o.scaleX, y: o.scaleY };

      if (SHAPES.has(type)) {
        const org = effectiveOrigin(o);
        if (org.x !== 0.5 || org.y !== 0.5) out.origin = org;
        if (o.isFilled) { out.fill = { color: hex(o.fillColor) }; if (o.fillAlpha !== 1) out.fill.alpha = o.fillAlpha; }
        if (o.isStroked) { out.stroke = { color: hex(o.strokeColor) }; const w = type === 'line' ? o._startWidth : o.lineWidth;
          if (w !== 1) out.stroke.width = w;
          if (type === 'line' && o._endWidth !== w) out.stroke.endWidth = o._endWidth; if (o.strokeAlpha !== 1) out.stroke.alpha = o.strokeAlpha; }
        if (o.closePath !== true) report.lossy.push({ id, field: 'closePath', why: 'not in spec' });
        if (o.lightingActive) report.lossy.push({ id, field: 'lighting', why: 'not in spec' });
      }
      if (type !== 'container' && type !== 'graphics' && !SHAPES.has(type)) {
        const dflt = type === 'text' || type === 'bitmapText' ? 0 : 0.5;
        const org = effectiveOrigin(o);
        if (org.x !== dflt || org.y !== dflt) out.origin = org;
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

      if (type === 'image' || type === 'sprite' || type === 'tileSprite') {
        out.key = o.texture.key;
        if (o.frame.name !== o.texture.firstFrame) out.frame = o.frame.name;
        if (type === 'tileSprite') {
          out.width = o.width; out.height = o.height;
          if (o.tilePositionX || o.tilePositionY) out.tilePosition = { x: o.tilePositionX, y: o.tilePositionY };
          if (o.tileScaleX !== 1 || o.tileScaleY !== 1) out.tileScale = { x: o.tileScaleX, y: o.tileScaleY };
          if (o.tileRotation) out.tileRotation = o.tileRotation;
        }
      } else if (type === 'text') {
        out.text = o.text;
        const style = textStyle(o, id);
        // Phaser reads lineSpacing from the style config, but keeps it on the object, not in style.toJSON()
        if (o.lineSpacing) style.lineSpacing = o.lineSpacing;
        if (Object.keys(style).length) out.style = style;
      } else if (type === 'bitmapText') {
        out.font = o.font;
        out.text = o.text;
        if (o._fontSize !== o.fontData.size) out.size = o._fontSize;
        if (o.align) out.align = ['left', 'center', 'right'][o.align];
        if (o.letterSpacing) out.letterSpacing = o.letterSpacing;
        if (o.lineSpacing) out.lineSpacing = o.lineSpacing;
        if (o.maxWidth) out.maxWidth = o.maxWidth;
        if (o.dropShadowX || o.dropShadowY) {
          out.dropShadow = { x: o.dropShadowX, y: o.dropShadowY };
          if (o.dropShadowColor !== 0) out.dropShadow.color = hex(o.dropShadowColor);
          if (o.dropShadowAlpha !== 0.5) out.dropShadow.alpha = o.dropShadowAlpha;
        }
        if (o.charColors && o.charColors.length) report.lossy.push({ id, field: 'charColors', why: 'per-character tint not in spec' });
        if (o.wordWrapCharCode !== 32) report.lossy.push({ id, field: 'wordWrapCharCode', why: 'not in spec' });
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
    // filters are serialized after every object has an id, because a mask source can be any object.
    // A source that is not in the scene masks without being drawn, which is what visible: false means in a document,
    // so it is written as a hidden root object.
    const refs = { get: (o) => {
      if (idOf.has(o)) return idOf.get(o);
      if (!(o instanceof Phaser.GameObjects.GameObject)) return undefined;
      const s = one(o, false);
      if (!s) return undefined;
      s.visible = false;
      objects.push(s);
      return s.id;
    } };
    for (const { o, out, id } of filtered) {
      const f = {};
      for (const k of ['internal', 'external']) {
        const l = filterList(scene, o.filters[k], refs, id, report, 'filters.' + k);
        if (l.length) f[k] = l;
      }
      if (Object.keys(f).length) out.filters = f;
    }
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

  return { serialize, animations };
})();
