// Draws a bar that drains over `params.seconds`, then refills.
const hex = (c) => parseInt(c.slice(1), 16);

export function create(g, scene, ctx) {
  ctx.elapsed = 0;
}

export function update(g, scene, time, delta) {
  const { params } = g.getData('phaseform');
  const ctx = g.getData('phaseform');
  ctx.elapsed = (ctx.elapsed + delta / 1000) % params.seconds;
  g.clear().fillStyle(hex(params.color)).fillRect(0, 0, params.width * (1 - ctx.elapsed / params.seconds), 8);
}
