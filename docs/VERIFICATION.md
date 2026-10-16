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

## Follow-ups
- **Item 2:** retest OVERLAY and ERASE with colors that make them distinguishable from NORMAL. Decide whether non-native modes are simply unsupported in core.
- **Item 5:** test tint on graphics.
- **Item 10:** test two scenes with different `size` in one game.
- **Item 16:** work out which end of a `setLineWidth(start, end)` line is thick, and whether the docs or the renderer is right.
- Unresolved edge: whether `setTintFill` is deprecated or kept; check the changelog if the spec ever needs to mention it.

## Add new items here
When a spec decision rests on an assumption, add a row instead of writing it into the spec as fact.
