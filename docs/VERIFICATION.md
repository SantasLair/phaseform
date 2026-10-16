# Verification notes

Facts the spec depends on that Phaser's documentation does not clearly state. Do not guess these in the spec: write a small test against a real Phaser build, record the result here, then cite it.

**Rule:** any default, accepted value or behavior that the docs leave unstated must be confirmed by running code before it becomes normative.

## How to verify
- Only **Phaser 4 (latest)** is supported, so only test that.
- Run `cd verify && npm install && npm run verify`. It loads `verify/harness.html` in real Chrome (WebGL) via playwright-core and writes `verify/results.json`.
- Record: Phaser version, renderer, observed value, and date.
- Prefer the checks to become conformance fixtures later.

## Results

Run on 2026-10-15: Phaser **4.2.1**, WebGL renderer (SwiftShader), Chrome 155. Raw data: `verify/results.json`.

| # | Unknown | Result | Spec consequence | Status |
|---|---|---|---|---|
| 1 | Default `origin` | image 0.5/0.5, sprite 0.5/0.5, text 0/0. Container reports 0.5/0.5 but has no `setOrigin`. Graphics has no origin. | `origin` default is {0.5,0.5} for image and sprite, {0,0} for text. Invalid on container and graphics. | confirmed |
| 2 | `blendMode` values | `Phaser.BlendModes` has 28 uppercase names (NORMAL=0, ADD=1, MULTIPLY=2, SCREEN=3, OVERLAY=4, DIFFERENCE=11, ERASE=17, ...). String names are **case-sensitive**: `'add'` and `'bogus'` silently become NORMAL. In WebGL pixel tests, NORMAL/ADD/MULTIPLY/SCREEN render correctly, **DIFFERENCE falls back to normal**. | Core enum is `normal`/`add`/`multiply`/`screen`. The loader must validate names itself because Phaser never errors. | confirmed; OVERLAY and ERASE inconclusive, see follow-ups |
| 3 | `angle` vs `rotation` | `angle` is degrees and `rotation` is radians, linked. Both are **normalized**: rotation 3π reads back as -π, angle 270 as -90. | Keep `rotation` in radians. Loaders must not expect round-trips beyond (-π, π]; conformance compares modulo 2π. | confirmed |
| 4 | Text style defaults | fontFamily `Courier`, fontSize `16px`, color `#fff`, stroke `#fff` with thickness 0, align `left`, resolution 1, padding 0 on all sides. A numeric `fontSize` becomes a `px` string. | Document defaults as Phaser's and pass `style` through unchanged. | confirmed |
| 5 | Tint | Default tint `0xffffff`, mode MULTIPLY. `TintModes`: MULTIPLY 0, FILL 1, ADD 2, SCREEN 4, OVERLAY 5, HARD_LIGHT 6, MULTIPLY_TWO 7 (no 3). `setTint` with four args sets corners. `setTintFill` still exists in 4.2.1. Text has `setTint`; container does not. | `tint` (`#rrggbb`) plus `tintMode` enum. Per-corner tint stays in an extension. Tint is invalid on container. | confirmed (graphics not tested) |
| 6 | Container size | `width`/`height`/`displayWidth` are 0 even with a child. No `setOrigin`, no flip methods. | Size, origin and flip fields are invalid on containers. | confirmed |
| 7 | Frames | Single-frame texture: default frame is `__BASE`. Spritesheet: first frame added. A **missing frame does not throw**: it logs a warning and falls back to the default frame. | Loader must validate frames against the manifest instead of relying on Phaser. | confirmed |
| 8 | Container child draw order | Pixel test: inside a container, array order wins and child `depth` is ignored (blue, listed last, drew over red depth 10). At scene root, `depth` sorts (red depth 10 on top). | Two-level draw-order rule. | confirmed |
| 9 | Container `scrollFactor` | `setScrollFactor(0.5)` changes the container only. The documented third argument did **not** propagate to the child in 4.2.1. | Container `scrollFactor` applies to the container only. | confirmed (docs and behavior disagree on the third argument) |
| 10 | Scene size | Default camera size equals the game size (800×600). Mixed scene sizes in one game were not tested. | `size` is the game size. | partly confirmed |

## Found by the example round-trip (see ROUNDTRIP.md)

| # | Unknown | Result | Spec consequence | Status |
|---|---|---|---|---|
| 11 | Default `blendMode` of a container | A container's `blendMode` is -1 (`SKIP_CHECK`), not 0 (normal). Image, sprite and text default to 0, and a child added to a container stays 0. | `blendMode` default is `normal` for image, sprite and text, and none for container. | confirmed |
| 12 | `style.metrics` | Phaser measures text metrics itself unless the style config supplies them. For Arial 48px it measured ascent 43, descent 10, fontSize 53, while the example supplied 45, 10, 55, giving text heights 53 vs 55. Fixed in the serializer; `text metrics` is now pixel-exact. | `metrics` must be preserved in `style`. | confirmed |
| 13 | Shared children in non-exclusive containers | The same object can be in the `list` of two containers at once while `parentContainer` points at only one. A tree cannot represent that, so the document duplicates it per container. `non exclusive containers` round-trips **intermittently**: 155, 0, then 116 differing pixels across three runs. Cause unknown; sharing is one unproven hypothesis. | Documents duplicate shared children; loaders cannot recover the sharing. | observed; intermittent diff unexplained |
| 14 | Script hooks and placeholder (SPEC: Scripts and code-driven objects) | `npm run test:scripts` runs 13 checks in Phaser 4.2.1: `create` runs after all objects exist and in `scripts` order, `ctx` carries `params` and `size` (null without a placeholder) and equals `getData("phaseform")`, `update` runs every frame and not while `active` is false, a missing module warns, and a placeholder is not drawn. A fresh `Graphics` already holds initial commands, so "no commands" means none beyond that baseline. Hooks are defined by the loader, not by Phaser. | Hook order, `ctx` and the never-drawn placeholder are normative. | confirmed |
| 15 | Shape defaults and fill/stroke flags | Probed with `shapes-probe.mjs` on Phaser 4.2.1. All seven core shapes default to origin 0.5, blend mode 0, and have no tint or flip methods. A shape built without a fill color is neither filled nor stroked (invisible); passing a fill color turns the fill on; `setFillStyle()` with no arguments turns it off; `setStrokeStyle()` with no arguments turns the stroke off. Colors are kept while a flag is off. Line is stroked by default. | `fill` and `stroke` are optional objects; absent means off. Shapes have no tint or flip. | confirmed |
| 16 | Line width in WebGL | A line renders from its own `_startWidth` and `_endWidth`, set by `setLineWidth`. `setStrokeStyle(20, ...)` on a line left a pixel 7 px from the center unlit, while `setLineWidth(20)` lit it. Round-tripping `shapes/line` stayed different until the loader called `setLineWidth`. With `setLineWidth(2, 40)` the thick end was at the start of the line in this probe, which is not what the docs suggest; the spec only maps `width`/`endWidth` onto the two `setLineWidth` arguments. | Loaders apply line `stroke.width` and `endWidth` with `setLineWidth`. | confirmed; taper direction not understood |
| 17 | Arc `iterations` | `shapes/arc` and `shapes/circle` stayed different until `iterations` (default 0.01) was kept. It changes how smoothly the arc is drawn. | `iterations` is an optional arc field. | confirmed |
| 18 | Bitmap font key namespace | `BitmapFontFile.addToCache` adds the font image to the texture manager under the font key and the parsed data to the bitmap font cache under the same key (read from Phaser 4.2.1 source, and consistent with every `bitmaptext` example rebuilding from the key alone). | A `bitmapFont` asset shares the texture key namespace. | confirmed |
| 19 | Assigning `originX`/`originY` directly | Phaser renders from a cached display origin that only `setOrigin()` updates. In `bitmaptext/static/large-text` the example sets `bunny.originX = 0` directly: `originX` reads 0 but the sprite still renders centered on its position. A serializer that reads `originX` produced a document that rendered differently (96,431 differing pixels). Reading the effective origin as `displayOriginX / width` made it pixel-exact. `BitmapText` overrides `updateDisplayOrigin` and derives it from its text bounds, so that division is wrong there (it broke `origin and scale`); bitmap text origin is read as is. | A document's `origin` is the effective origin, and serializers read it from the display origin. | confirmed |
| 20 | Tile sprite size | `TileSprite` floors `width` and `height`, and a size of 0 means "use the frame size" (read from the 4.2.1 constructor; all 14 `tile sprite` examples rebuild pixel-exact from documents that carry the real size). | `width` and `height` are required and at least 1, and documents carry the real size. | confirmed |
| 21 | Animation frame index | `AnimationFrame.index` is 1-based (`Animation.getFrames` starts at 1), while `play({ startFrame })` takes a 0-based index into `frames`. Serializing `startFrame` as `currentFrame.index - 1` rebuilt `container/animation test` and `container/container input test` pixel-exact with `startFrame: 11`, after every animation was removed and recreated from its definition. | `startFrame` is 0-based. | confirmed |
| 22 | Text `lineSpacing` | `Text` keeps `lineSpacing` as an object property, absent from `style.toJSON()`, and the constructor applies `style.lineSpacing` from the config (`Text.js`, 4.2.1). Writing it into `style` rebuilt `text/line spacing` and `group/sprite pool` pixel-exact. | Line spacing is `style.lineSpacing`. | confirmed |

## Filters and masks (probes: `verify/filters*-harness.html`, run with `node filters-probe.mjs <page>`)

| # | Unknown | Result | Spec consequence | Status |
|---|---|---|---|---|
| 23 | Mask API in Phaser 4 | A mask is a filter: `FilterList#addMask(mask, invert, viewCamera, viewTransform, scaleFactor)`, where `mask` is a texture key or a game object. Objects get `filters.internal` and `filters.external` after `enableFilters()` (null before). `FilterList` has 23 `add...` methods (4.2.1). | One `filters` field covers filters and masks, with `internal` and `external` lists. | confirmed |
| 24 | Filter defaults | Read from each controller after `add...()` with no arguments (probe 1) and from the 4.2.1 constructors. `addImageLight()` with no config throws; the loader passes `{}`. Glow `quality` and `distance` default to the game config's `glowQuality` and `glowDistance`. | The defaults in the filter table. | confirmed |
| 25 | Is a mask source drawn? | A visible source on the display list draws normally as well as masking (green showed where only the source was). A source with `visible: false` still masks and is not drawn. A source never added to the display list masks and is not drawn. A source with `alpha: 0` masks everything out. | Phaser's default is kept: hide a mask-only source with `visible: false`. | confirmed |
| 26 | Masks with containers and sharing | With the default `viewTransform: "world"`, a source inside a container (at 220, 80) masked at its world position. A mask on a container clipped its children. One source masked two objects. A mask on the `external` list worked. `viewTransform: "local"` ignored the source's parent and placed it at its own coordinates. | Container, sharing and `viewTransform` rules in Masks. | confirmed |
| 27 | Filter area per object type | An inverted `threshold` on the `internal` list turned a far corner of the view white for container, graphics and all seven shapes, and left it black for image, sprite, tileSprite and text (probe 5). Phaser documents that objects without well-defined bounds get `filtersFocusContext`. | The Filter area note. | confirmed |
| 28 | Texture masks | An external texture mask stretched a half-white texture over the 400-wide view (visible to x 200). On a rectangle (no well-defined bounds) the internal mask also used the view, so the whole 100-wide rectangle showed. | Prefer `source`; texture masks follow the filter area. | confirmed |
| 29 | Blend filter modes | `FilterBlend` builds its shader from `#define BLEND <name>` and defines a function for all 28 `BlendModes` (NORMAL to XOR). `multiply` of red over #3366cc gave (51, 0, 0) inside an image and nothing outside. `difference` of two opaque inputs gave a transparent result, because the shader applies the mode to alpha too. | `blend.blendMode` accepts every mode; alpha note. | confirmed |
| 30 | Wipe direction | The constructor docs say direction 0 is "left to right, or top to bottom", but `setTopToBottom()` sets direction 1, axis 1, and the class docs list the same. The spec follows the methods. Rendering of the four directions was not pixel-tested. | `wipe.direction` names map like the `set...` methods. | source read; not pixel-tested |
| 31 | Loader and serializer round trip | `npm run test:filters` (13 checks): the filters example (all 23 types) loads with no warnings, serializes with nothing lossy, every field survives, and serialize, load, serialize is stable. Pixel checks: hidden mask source, container mask, invert, `active: false`, blend `multiply`. Filter textures are found by searching the texture manager, because controllers keep only the GL texture. | Field mapping in the filter table. | confirmed |
| 32 | Many filters on one object | One off-screen object holding all 22 filter types at once left grey pixels across the whole view in probe 3, and the other objects rendered wrongly. With those filters removed, the same page rendered correctly. Not investigated. | None yet. | observed; cause unknown |

## Follow-ups
- **Item 2:** retest OVERLAY and ERASE with colors that make them distinguishable from NORMAL. Decide whether non-native modes are simply unsupported in core.
- **Item 5:** test tint on graphics.
- **Item 10:** test two scenes with different `size` in one game.
- **Item 16:** work out which end of a `setLineWidth(start, end)` line is thick, and whether the docs or the renderer is right.
- **Item 30:** pixel-test the four wipe directions.
- **Item 32:** find out why many filters on one object disturb the whole view.
- Filters not pixel-tested: `imageLight`, `normalTools`, `panoramaBlur`, `gradientMap`, `quantize`, `key`, `displacement`, `combineColorMatrix`, `parallel`. They load and round-trip (item 31) but their output was not checked.
- Unresolved edge: whether `setTintFill` is deprecated or kept; check the changelog if the spec ever needs to mention it.

## Add new items here
When a spec decision rests on an assumption, add a row instead of writing it into the spec as fact.
