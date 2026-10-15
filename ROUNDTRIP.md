# Round-trip conformance results

Does the PHASEFORM v0.1 core describe real Phaser scenes well enough to rebuild them? Each official example is run on Phaser 4.2.1 (WebGL), paused after `create()`, serialized to a PHASEFORM document, validated against the schema, rebuilt in the same page by the reference loader, and compared pixel for pixel with the original frame.

Tools (all in `verify/`): `phaseform-serialize.js` (live scene to document), `phaseform-load.js` (document to scene), `roundtrip.mjs` (runner), `roundtrip-report.mjs` (summary). Examples: [phaserjs/examples](https://github.com/phaserjs/examples) commit `68140eca` (MIT code). Same 259 examples as [SURVEY.md](SURVEY.md). Run date: 2026-10-15.

## Results

| Status | Count |
|---|---|
| pixel-exact | 92 |
| exact, with unsupported types present | 2 |
| pixels differ | 152 |
| blank frame (graphics-only, nothing to compare) | 5 |
| skipped (multi-scene, or scene not running) | 7 |
| error (snapshot timeout) | 1 |
| schema-invalid output | 0 |

**Examples using only core types (100): 92 exact, 8 differ.** Every generated document was schema-valid.

The other 159 contain an object type the core does not have, mostly `Graphics` (84 examples), `BitmapText` (41), `TileSprite` (14) and shapes, or could not be compared.

### The 8 core-only examples that differ

| Example | Cause |
|---|---|
| container/container mask, container as mask | masks and filters are not in the spec |
| container/child blend mode | uses blend modes 7 (color dodge) and 11 (difference), outside the 4-mode core |
| text/line spacing, group/sprite pool | `lineSpacing` is not in the spec |
| text/text gradient | text color is a `CanvasGradient`, not JSON |
| text/word wrap by callback | `wordWrap.callback` is a function, not data |
| container/non exclusive containers | **unexplained**: 155, 0, then 116 differing pixels across three runs. Intermittent. Shared children (one object in several containers) are a hypothesis, not a finding |

## What the round-trip changed in the spec

Bugs found by running real examples, all now fixed:
1. **Container blend mode default.** A Phaser container's blend mode is `SKIP_CHECK` (-1), not normal. The README said every object defaults to `normal`.
2. **Text `style.metrics`.** Phaser uses supplied metrics instead of measuring, which changes text height (53 vs 55 px in one example). The first serializer discarded it.
3. **Style shape.** `style` must be Phaser's config form (nested `shadow` and `wordWrap`, `padding` inside), not the flat form that `toJSON()` produces.

Confirmed gaps, not yet in the spec: `Graphics` commands, `BitmapText`, `TileSprite`, shapes, masks and filters, `lineSpacing`, gradient and callback text values, and sprite animations (43 benign occurrences).

## Caveats

- Same-page comparison: it proves the document plus loader reproduce the frame, not that another implementation would.
- A snapshot is one frame of a paused scene, so behavior (tweens, input, update loops) is not tested, only the scene it leaves behind.
- One example errored on a snapshot timeout, and 7 were skipped. These are not counted as passes.
- Exact means 0 pixels differ at any channel. A pass is not a guarantee: a scene of only transparent objects would also match (the runner flags fully blank frames).

## Reproduce

```
cd verify && npm install
node roundtrip.mjs <path-to-examples>/public roundtrip-results.json \
  "game objects/images" "game objects/sprites" "game objects/text" "game objects/container" \
  "game objects/graphics" "game objects/shapes" "game objects/tile sprite" \
  "game objects/bitmaptext" "game objects/group"
node roundtrip-report.mjs roundtrip-results.json
```
