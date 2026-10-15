// Prototype PHASEFORM reference loader: PHASEFORM v0.1 scene document -> objects in a live Phaser 4 scene.
// Follows docs/SPEC.md: defaults, validation of blend/tint names and frames, container draw order.
window.PhaseformLoader = (function () {
  const BLEND = { normal: 'NORMAL', add: 'ADD', multiply: 'MULTIPLY', screen: 'SCREEN' };
  const TINT = { multiply: 'MULTIPLY', fill: 'FILL', add: 'ADD', screen: 'SCREEN', overlay: 'OVERLAY', 'hard-light': 'HARD_LIGHT' };

  function clear(scene) {
    for (const o of scene.children.list.slice()) o.destroy();
  }

  function build(scene, doc) {
    const warnings = [];
    const ids = new Set();

    function make(d, parent) {
      if (ids.has(d.id)) throw new Error(`duplicate id "${d.id}"`);
      ids.add(d.id);
      const x = d.x || 0, y = d.y || 0;
      let o;
      switch (d.type) {
        case 'image':
        case 'sprite': {
          const tex = scene.textures.exists(d.key) ? scene.textures.get(d.key) : null;
          if (!tex) { warnings.push(`${d.id}: texture "${d.key}" not loaded`); }
          else if (d.frame !== undefined && !tex.has(d.frame)) throw new Error(`${d.id}: texture "${d.key}" has no frame ${JSON.stringify(d.frame)}`);
          o = d.type === 'image' ? scene.add.image(x, y, d.key, d.frame) : scene.add.sprite(x, y, d.key, d.frame);
          break;
        }
        case 'text':
          o = scene.add.text(x, y, d.text, JSON.parse(JSON.stringify(d.style || {})));
          break;
        case 'container':
          o = scene.add.container(x, y);
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
      if (d.type !== 'container') {
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
      if (d.type === 'container') {
        for (const c of d.children || []) { const child = make(c, o); if (child) o.add(child); }
      }
      return o;
    }

    if (doc.background) scene.cameras.main.setBackgroundColor(doc.background);
    const roots = [];
    for (const d of doc.objects) { const o = make(d, null); if (o) roots.push(o); }
    return { objects: roots, warnings };
  }

  return { build, clear };
})();
