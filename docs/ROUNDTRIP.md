# Round-trip conformance results

Does the PHASEFORM v0.1 core describe real Phaser scenes well enough to rebuild them? Each official example is run on Phaser 4.2.1 (WebGL), paused after `create()`, serialized to a PHASEFORM document, validated against the schema, rebuilt in the same page by the reference loader, and compared pixel for pixel with the original frame.

Tools (all in [verify/](../verify/)): `phaseform-serialize.js` (live scene to document), `phaseform-load.js` (document to scene), `roundtrip.mjs` (runner), `roundtrip-report.mjs` (summary). Examples: [phaserjs/examples](https://github.com/phaserjs/examples) commit `68140eca` (MIT code). Same 259 examples as [SURVEY.md](SURVEY.md). Run date: 2026-10-15 (re-run after code-driven objects and shapes were added).

## Results

| Status | Count |
|---|---|
| pixel-exact | 103 |
| exact, with unsupported types present | 1 |
| pixels differ | 63 |
| code-driven (contains a `Graphics` object; draw code is not recoverable, so not comparable) | 84 |
| skipped (multi-scene, or scene not running) | 7 |
| error (snapshot timeout) | 1 |
| schema-invalid output | 0 |

**Examples using only core types (111): 103 exact, 8 differ.** Every generated document was schema-valid. The core now includes the seven shapes, so 11 more examples count as core-only than before.

The other 148 contain a `Graphics` object (84 examples, reported as code-driven), an object type the core does not have (mostly `BitmapText` (41), `TileSprite` (14), and the shapes left out of v0.1: `grid`, `isobox`, `isotriangle`, `curve`), or could not be compared.

### The 8 core-only examples that differ

| Example | Cause |
|---|---|
| container/container mask, container as mask | masks and filters are not in the spec |
| container/child blend mode | uses blend modes 7 (color dodge) and 11 (difference), outside the 4-mode core |
| text/line spacing, group/sprite pool | `lineSpacing` is not in the spec |
| text/text gradient | text color is a `CanvasGradient`, not JSON |
| text/word wrap by callback | `wordWrap.callback` is a function, not data |
| container/non exclusive containers | **unexplained**, intermittent (see below) |

The "non exclusive containers" example differs only some of the time: 155, 0 and 116 differing pixels in three runs, then exact, then 178, exact, and 71 in later runs. Its cause is still unexplained. Shared children (one object in several containers) remain a hypothesis, not a finding.

## What the round-trip changed in the spec

Bugs found by running real examples, all now fixed:
1. **Container blend mode default.** A Phaser container's blend mode is `SKIP_CHECK` (-1), not normal. The spec said every object defaults to `normal`.
2. **Text `style.metrics`.** Phaser uses supplied metrics instead of measuring, which changes text height (53 vs 55 px in one example). The first serializer discarded it.
3. **Style shape.** `style` must be Phaser's config form (nested `shadow` and `wordWrap`, `padding` inside), not the flat form that `toJSON()` produces.
4. **Line width.** A WebGL line is drawn from its own start and end widths, so `setStrokeStyle` alone leaves it 1px wide. The loader now calls `setLineWidth`, and `stroke.endWidth` was added for tapered lines.
5. **Arc iterations.** `iterations` changes how smoothly an arc is drawn and was added to `arc`.

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
