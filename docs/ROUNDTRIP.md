# Round-trip conformance results

Does the PHASEFORM v0.1 core describe real Phaser scenes well enough to rebuild them? Each official example is run on Phaser 4.2.1 (WebGL), paused after `create()`, serialized to a PHASEFORM document, validated against the schema, rebuilt in the same page by the reference loader, and compared pixel for pixel with the original frame.

Animations are rebuilt too: the runner removes every animation from the game, recreates them from the serialized project definitions, and the rebuilt sprites start them at the saved `startFrame`. The definitions are validated against the project schema.

## Results

| Status | Count |
|---|---|
| pixel-exact | 138 |
| exact, with unsupported types present | 1 |
| pixels differ | 28 |
| code-driven (contains a `Graphics` object; draw code is not recoverable, so not comparable) | 84 |
| skipped (multi-scene, or scene not running) | 7 |
| error (snapshot timeout) | 1 |
| schema-invalid output | 0 |

**Examples using only core types (143): 138 exact, 5 differ.** Every generated document was schema-valid. The core now includes seven shapes, `bitmapText` and `tileSprite`, so 43 more examples count as core-only than in the first run. All 14 tile sprite examples are exact. With filters in the core, both mask examples (`container mask`, `container as mask`) are exact.

The other 116 contain a `Graphics` object (84 examples, reported as code-driven), an object type the core does not have (mostly `DynamicBitmapText` (13), and the shapes left out of v0.1: `grid`, `isobox`, `isotriangle`, `curve`), or could not be compared.

### Core-only examples that differ

| Example | Cause |
|---|---|
| container/child blend mode | uses blend modes 7 (color dodge) and 11 (difference), outside the 4-mode core |
| text/text gradient | text color is a `CanvasGradient`, not JSON |
| text/word wrap by callback | `wordWrap.callback` is a function, not data |
| bitmaptext/tinted text | per-corner tint, not in the spec |
| container/non exclusive containers | **unexplained**, intermittent: differs in some runs (see below) |

The "non exclusive containers" example differs only some of the time: 155, 0 and 116 differing pixels in three runs, then exact, then 178, exact, 71, 62, 71 and 155 in later runs, 88, then 178 in the latest, and exact in others. Its cause is still unexplained. Shared children (one object in several containers) remain a hypothesis, not a finding.

## What the round-trip changed in the spec

Bugs found by running real examples, all now fixed:
1. **Container blend mode default.** A Phaser container's blend mode is `SKIP_CHECK` (-1), not normal. The spec said every object defaults to `normal`.
2. **Text `style.metrics`.** Phaser uses supplied metrics instead of measuring, which changes text height (53 vs 55 px in one example). The first serializer discarded it.
3. **Style shape.** `style` must be Phaser's config form (nested `shadow` and `wordWrap`, `padding` inside), not the flat form that `toJSON()` produces.
4. **Line width.** A WebGL line is drawn from its own start and end widths, so `setStrokeStyle` alone leaves it 1px wide. The loader now calls `setLineWidth`, and `stroke.endWidth` was added for tapered lines.
5. **Arc iterations.** `iterations` changes how smoothly an arc is drawn and was added to `arc`.
6. **Effective origin.** An example assigned `originX` directly, which changes the property but not the rendering. The serializer now reads the effective origin from the display origin (see VERIFICATION item 19).
7. **Text line spacing.** `lineSpacing` lives on the Text object, not in `style.toJSON()`, but the constructor reads it from the style config, so it is written as `style.lineSpacing`. This fixed `text/line spacing` and `group/sprite pool`.
8. **Mask sources outside the scene.** Both mask examples build their mask source with `add: false`, so it is never on the display list and had no id to refer to. Such a source masks without being drawn, which is what `visible: false` does (VERIFICATION item 25), so the serializer writes it as a hidden root object.

Confirmed gaps, not yet in the spec: object `blendMode` values outside the four WebGL-native ones (the `blend` filter offers all modes), per-corner tint, gradient and callback text values, `DynamicBitmapText`, the shapes `grid`, `isobox`, `isotriangle` and `curve`, `Blitter` and particle emitters. `Graphics` draw commands are out by design: graphics objects are code-driven.

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
