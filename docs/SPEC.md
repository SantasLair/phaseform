# PHASEFORM scene specification

**Draft v0.1.** Scenes are described by one JSON document. Projects (scene list and asset manifest) are specified in [PROJECT.md](PROJECT.md). The schema is [phaseform.schema.json](../phaseform.schema.json).

Behavior that Phaser's documentation leaves unstated is checked by tests and recorded in [VERIFICATION.md](VERIFICATION.md) before it is written here.

## Contents

- [Scope](#scope)
- [Scene document](#scene-document)
- [Objects](#objects)
- [Tile sprite](#tile-sprite)
- [Bitmap text](#bitmap-text)
- [Shapes](#shapes)
- [Scripts and code-driven objects](#scripts-and-code-driven-objects)
- [Filters and masks](#filters-and-masks)
- [Conventions](#conventions)
- [Extensions](#extensions)
- [Versioning](#versioning)
- [Conformance](#conformance)

## Scope

**Target.** Phaser 4 (verified against 4.2.1) with the WebGL renderer. Older Phaser versions and the Canvas renderer are not supported.

**Data model and encoding.** A PHASEFORM document is a data model: objects, arrays, strings, numbers, booleans and null, structured as this spec describes. JSON ([RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)) is its canonical encoding, the one every tool reads and writes. The rules in this spec are rules about the data, not the JSON text: whitespace, formatting and key order carry no meaning.

**Goals**

- **Declarative data only.** No code inside the file. Behavior is referenced by key or script path.
- **Maps directly to Phaser.** Each object corresponds to a Phaser game object type, with no invented concepts.
- **Small core.** Only the most common object types are in the core. Everything else is an extension.
- **Forward compatible.** Unknown object types and fields are preserved on load and save, so no tool silently deletes data it does not understand.
- **Easy to validate.** A JSON Schema covers the structure, and a reference loader covers behavior.
- **Human-readable.** Plain JSON, diffable in version control.

**Non-goals**

- Editor UI state (camera position, selection, locks, panel layout). These belong in a separate sidecar file.
- Prefabs, templates, or inheritance. These may come later as a separate spec.
- Code generation. PHASEFORM describes scenes, not the source code that runs them.
- Replacing Phaser's loader or asset pipeline. Assets are referenced by key.
- Phaser versions before 4, or the Canvas renderer.

**Prior art.** Phaser Editor has its own JSON `.scene` format, but it is editor-internal and compiles to Phaser code. PHASEFORM is meant to be loaded directly at runtime and written by any tool.

## Scene document

```json
{
  "format": "phaseform",
  "version": "0.1.0",
  "key": "Main",
  "size": { "width": 800, "height": 600 },
  "background": "#0d0d0d",
  "objects": []
}
```

| Field | Required | Description |
|---|---|---|
| `format` | yes | Always `"phaseform"`. |
| `version` | yes | Spec version the file was written against (semver). |
| `key` | yes | Scene key, matching the key used with Phaser's scene manager. |
| `size` | yes | Game size in pixels (the Phaser game config `width` and `height`). |
| `background` | no | Background color as a CSS color string. |
| `objects` | yes | Ordered list of objects. See [Draw order](#draw-order). |
| `extensions` | no | Scene-level extension data, keyed by extension name. |

`size` is the game size, and by default the scene camera has the same size. All scenes in one game should agree on it; a loader warns when they differ.

## Objects

### Common fields

These apply to every object, including containers.

| Field | Required | Default | Description |
|---|---|---|---|
| `id` | yes | | Unique within the scene. Stable across saves. |
| `type` | yes | | Object type, see [Core types](#core-types). |
| `name` | no | `""` | The game object's `name`. |
| `x`, `y` | no | `0` | Position. |
| `depth` | no | `0` | Draw order at the scene root. |
| `alpha` | no | `1` | `0` to `1`. |
| `visible` | no | `true` | |
| `active` | no | `true` | Whether Phaser updates the object. |
| `scrollFactor` | no | `{ "x": 1, "y": 1 }` | Camera scroll factor. |
| `data` | no | none | Free key/value data, applied with the object's data manager. |
| `scripts` | no | none | Script paths to attach, relative to the project root. See [Scripts](#scripts-and-code-driven-objects). |
| `params` | no | none | Plain JSON passed to the scripts. |
| `placeholder` | no | none | Editor-only reference visual. Never drawn by a loader. |
| `extensions` | no | none | Extension data, keyed by extension name. |
| `filters` | no | none | Filters and masks, see [Filters and masks](#filters-and-masks). |

On a container, `scrollFactor` affects the container only, not its children.

### Core types

| Type | Phaser class | Type-specific fields |
|---|---|---|
| `image` | `Image` | `key`, `frame`, `origin`, `scale`, `rotation`, `flipX`, `flipY`, `tint`, `tintMode`, `blendMode` |
| `sprite` | `Sprite` | same as `image`, plus `animation` |
| `text` | `Text` | `text`, `style`, `origin`, `scale`, `rotation`, `tint`, `tintMode`, `blendMode` |
| `container` | `Container` | `children`, `scale`, `rotation`, `blendMode` |
| `rectangle`, `ellipse`, `triangle`, `line`, `polygon`, `star`, `arc` | the Phaser shape of the same name | [shapes](#shapes) |
| `tileSprite` | `TileSprite` | `key`, `frame`, `width`, `height`, `tilePosition`, `tileScale`, `tileRotation`, `origin`, `scale`, `rotation`, `flipX`, `flipY`, `tint`, `tintMode`, `blendMode` |
| `bitmapText` | `BitmapText` | [bitmap text](#bitmap-text) |
| `graphics` | `Graphics` | none. Code-driven, see [Scripts](#scripts-and-code-driven-objects) |

Fields not listed for a type are invalid on that type. Containers have no `origin`, `flipX`, `flipY`, `tint` or size: Phaser fixes a container's origin, gives it zero intrinsic size, and gives it no tint or flip.

`graphics` is a host for code: the loader creates an empty `Graphics` object with the common fields applied, and its scripts do the drawing. The spec defines no draw commands. Other fields on a `graphics` object are preserved but not defined.

### Field reference

| Field | Type | Default | Applies to |
|---|---|---|---|
| `key` | string, required | | image, sprite |
| `animation` | object | none | sprite |
| `frame` | integer or string | the texture's default frame | image, sprite |
| `origin` | vec2 | `{0.5, 0.5}`; `{0, 0}` for text | image, sprite, text |
| `scale` | vec2 | `{1, 1}` | all but graphics |
| `rotation` | number, radians | `0` | all but graphics |
| `flipX`, `flipY` | boolean | `false` | image, sprite |
| `tint` | `#rrggbb` | `#ffffff` | image, sprite, text |
| `tintMode` | enum | `multiply` | image, sprite, text |
| `blendMode` | enum | `normal`; none for container | image, sprite, text, container |
| `text` | string, required | | text |
| `style` | object | Phaser's text defaults | text |
| `width`, `height` | number, required | | tileSprite |
| `tilePosition` | vec2 | `{0, 0}` | tileSprite |
| `tileScale` | vec2 | `{1, 1}` | tileSprite |
| `tileRotation` | number, radians | `0` | tileSprite |
| `children` | list of objects | | container |

`tintMode` is one of `multiply`, `fill`, `add`, `screen`, `overlay`, `hard-light`. `blendMode` is one of `normal`, `add`, `multiply`, `screen`.

**Notes**

- **`animation`.** `{ "key": "coin-spin", "startFrame": 2 }`: the animation playing when the scene is created, defined in the project ([PROJECT.md](PROJECT.md#animations)). `startFrame` (default 0) is a 0-based index into the animation's frames, which lets a tool save a sprite mid-animation. The loader calls `sprite.play({ key, startFrame })`. Play-time overrides such as `timeScale` are not in v0.1.
- **`frame`.** An index or a name. Phaser does not fail on a missing frame: it warns and falls back to the default frame, so loaders must validate frames.
- **`rotation`.** Phaser normalizes rotation to between -π and π. Loaders and tests compare rotations modulo 2π.
- **`tint`.** Converted to Phaser's numeric tint. Per-corner tint is not in the core.
- **`blendMode`.** The four values are the modes WebGL renders natively. Other Phaser modes may render incorrectly in WebGL (`difference` was observed falling back to `normal`), so they are not in the core. Phaser silently treats an unknown name as `normal`, so loaders must reject unknown values themselves. A container has no blend mode of its own by default, so its children keep theirs. Writing `blendMode` on a container sets one explicitly.
- **`style`.** Phaser's text style config object, passed through unchanged: shadow is nested as `shadow: { offsetX, ... }`, word wrap as `wordWrap: { width, useAdvancedWrap }`, and `padding` goes inside `style`. Phaser's defaults are Courier, 16px, white. A numeric `fontSize` becomes pixels. If `metrics` (`ascent`, `descent`, `fontSize`) is given, Phaser uses it instead of measuring, which changes text height, so it must be preserved. Line spacing is `style.lineSpacing` (pixels, default 0): the Text constructor reads it from the config, although `style.toJSON()` does not return it.
- **vec2.** `{ "x": number, "y": number }`.

### Tile sprite

`tileSprite` repeats a texture across a `width` by `height` area. It has the fields of `image` (`key`, `frame`, `origin`, `scale`, `rotation`, `flipX`, `flipY`, `tint`, `tintMode`, `blendMode`) plus `width` and `height`, which are required, and the texture's offset `tilePosition`, `tileScale` and `tileRotation`. Phaser rounds the size down to a whole number, and treats a size of 0 as "use the frame size", so documents always carry the real size. Moving `tilePosition` scrolls the texture without moving the object, which is how scrolling backgrounds are made.

### Bitmap text

`bitmapText` draws text from a bitmap font loaded as a `bitmapFont` asset ([PROJECT.md](PROJECT.md)). It has the common fields plus `origin` (default `{0, 0}`), `scale`, `rotation`, `tint`, `tintMode` and `blendMode`. It has no `flipX` or `flipY` and cannot have children.

| Field | Required | Default | Description |
|---|---|---|---|
| `font` | yes | | Key of a `bitmapFont` asset. |
| `text` | yes | | The text. `\n` starts a new line. |
| `size` | no | the font data's size | Font size in pixels. |
| `align` | no | `left` | `left`, `center` or `right`. Aligns lines within the text block. |
| `letterSpacing` | no | `0` | Extra pixels between characters. |
| `lineSpacing` | no | `0` | Extra pixels between lines. |
| `maxWidth` | no | `0` | Wrap width in pixels. `0` means no wrapping. |
| `dropShadow` | no | none | `x`, `y` (required), `color` (default `#000000`), `alpha` (default 0.5). Phaser draws it only when `x` or `y` is not 0. |

Per-character and per-word tints (`charColors`), atlas-based fonts and `DynamicBitmapText` are not in v0.1.

### Shapes

Seven Phaser shape classes are core types: `rectangle`, `ellipse`, `triangle`, `line`, `polygon`, `star` and `arc`. Static vector art is described with these, not with draw commands. (`grid`, `isobox`, `isotriangle` and `curve` are not in v0.1.)

Shapes share the common fields, plus `origin` (default `{0.5, 0.5}`), `scale`, `rotation` and `blendMode` (default `normal`). They have **no `tint`, `tintMode`, `flipX` or `flipY`** and cannot have children. `alpha` is a single value.

**Fill and stroke.** Shapes are drawn through two optional objects:

| Field | Fields inside | Description |
|---|---|---|
| `fill` | `color` (required, `#rrggbb`), `alpha` (default 1) | Absent means not filled. |
| `stroke` | `color` (required), `width` (default 1), `alpha` (default 1), `endWidth` (line only) | Absent means not stroked. |

A shape with neither is valid and invisible (for example a hit area). `line` is the exception: it requires `stroke` and does not allow `fill`.

**Geometry.** Coordinates are in the shape's local space, and `origin` is applied on top of them.

| Type | Required fields | Optional fields |
|---|---|---|
| `rectangle` | `width`, `height` | |
| `ellipse` | `width`, `height` | `smoothness` (integer, default 64) |
| `triangle` | `points`: exactly 3 vec2 | |
| `line` | `points`: exactly 2 vec2, `stroke` | |
| `polygon` | `points`: 3 or more vec2 | |
| `star` | `innerRadius`, `outerRadius` | `pointCount` (integer, default 5) |
| `arc` | `radius` | `startAngle` (default 0), `endAngle` (default 360), `anticlockwise` (default false), `iterations` (default 0.01, smaller is smoother) |

Arc angles are in **degrees**, as Phaser takes them. `rotation` stays in radians. The star field is `pointCount` because `points` is a vertex list on the other shapes. **Line width.** A WebGL line is drawn from its own start and end widths, not from the stroke width alone, so a loader applies `stroke.width` and `stroke.endWidth` with `setLineWidth(width, endWidth)`. `endWidth` defaults to `width`, and it is ignored on other shapes.

How Phaser sizes and positions each shape is recorded in [VERIFICATION.md](VERIFICATION.md).

### Example

```json
{
  "format": "phaseform",
  "version": "0.1.0",
  "key": "Main",
  "size": { "width": 800, "height": 600 },
  "background": "#0d0d0d",
  "objects": [
    {
      "id": "player",
      "type": "sprite",
      "key": "hero",
      "frame": 0,
      "x": 120,
      "y": 400,
      "depth": 10,
      "origin": { "x": 0.5, "y": 1 },
      "scripts": ["scripts/player.js"],
      "extensions": { "arcade": { "body": "dynamic" } }
    },
    {
      "id": "hud",
      "type": "container",
      "children": [
        { "id": "score", "type": "text", "text": "0", "x": 16, "y": 16 }
      ]
    }
  ]
}
```

More examples are in [examples/](../examples/).

## Scripts and code-driven objects

Some objects have no appearance that data can describe: a health bar redrawn from game state, a radar, a debug overlay. PHASEFORM does not describe draw commands. The object is created with its normal fields and its scripts supply the rest.

### Scripts

`scripts` lists script modules, in order. Each module may export either hook:

- `create(obj, scene, ctx)` runs once, after the object and all its siblings exist.
- `update(obj, scene, time, delta)` runs every frame while the object is active.

`ctx` holds the object's `params` (an empty object when absent) and `size`, the placeholder's `{ width, height }` (`null` when there is no placeholder). The same `ctx` is available later as `obj.getData("phaseform")`. A loader resolves script paths through a script registry and never imports a path itself. How a build produces the registry is in [PROJECT.md](PROJECT.md#release-builds). Any object type may have scripts, not only `graphics`.

### Placeholder

`placeholder` is a reference visual for editors, for objects whose look comes from code.

| Field | Required | Description |
|---|---|---|
| `kind` | yes | `rect`, `ellipse`, `polygon` or `image`. |
| `width`, `height` | yes | Size in local units. The box spans (0, 0) to (width, height) in the object's local space. |
| `fill`, `stroke` | no | `#rrggbb`. |
| `strokeWidth`, `alpha` | no | Stroke width in local units. `alpha` is 0 to 1. |
| `points` | polygon | Three or more vec2 vertices in local space. |
| `path` | image | Reference image, relative to the project root. |

- **Never drawn by a loader.** The placeholder is editor reference data. At runtime an object whose script draws nothing is invisible. A loader must ignore the placeholder and keep it when saving.
- **`path` is not an asset key.** It is not in the project manifest and the game never loads it. The editor scales it to `width` and `height`.
- **Size is shared.** Scripts read `width` and `height` through `ctx.size`, so code can draw to the size set in the editor. Nothing else in the placeholder reaches scripts.
- **Optional.** Without a placeholder an editor shows a default marker at the object's position, and `ctx.size` is `null`.

### Serializing live scenes

A serializer cannot recover draw code from a live scene. A `Graphics` object serializes as a `graphics` node with its common fields and no placeholder, and what it drew is lost.

## Filters and masks

Phaser 4 replaces masks and post effects with one system: filters. A mask is one kind of filter. Any object, including a container, may have a `filters` field:

```json
"filters": {
  "internal": [
    { "type": "mask", "source": "panel-shape" },
    { "type": "blur", "x": 4, "y": 4 }
  ],
  "external": [
    { "type": "glow", "color": "#ffcc00", "outerStrength": 6 }
  ]
}
```

- **Two lists.** `internal` and `external` map to Phaser's `filters.internal` and `filters.external`. Internal filters run first, before the object's transform: a horizontal blur on an object rotated 45 degrees appears at 45 degrees. External filters run after it, so the same blur appears horizontal. External filters cover the full screen and cost more, so Phaser recommends internal filters where possible. Either list may be absent or empty.
- **Order.** Each list applies in array order. The loader calls `enableFilters()` and then the matching `add...` method for each entry in turn. Filters are added once every object in the scene exists, because a mask source can be any object, and before any script `create` hook runs, so scripts see the filters and can animate them.
- **Containers.** A filter on a container applies to the container's rendered children as a whole.
- **Filter area.** Phaser renders internal filters into a framebuffer focused on the object. Objects without well-defined bounds (containers, graphics and all shapes) get Phaser's `filtersFocusContext` instead, so their internal filters cover the whole camera view, like external filters. A filter that changes transparent pixels (an inverted `threshold`, a `blend` texture) then affects the whole view, not just the object. Images, sprites, tile sprites and text keep their filters inside their bounds.
- **Defaults.** Every field except `type` is optional. Absent fields take Phaser's default, listed below.
- **Unknown filter types.** A loader skips an entry whose `type` it does not know, warns, and keeps the entry when saving. Later entries still load.

### Common filter fields

| Field | Default | Description |
|---|---|---|
| `type` | | Filter type, from the table below. Required. |
| `active` | `true` | `false` keeps the filter in the list but does not render it. Editors use this to toggle an effect. |

### Value conventions

- **Colors** are `#rrggbb` where Phaser accepts a single color (`blur`, `glow`, `shadow`, `vignette`, `key`, ramp bands).
- **Channel vectors** are arrays of numbers from 0 to 1, as Phaser stores them, in RGBA order unless noted.
- **Textures** are asset keys from the project manifest. Absent means Phaser's built-in default texture for that filter.
- **Object references** are object `id`s in the same scene, at any depth. A reference to a missing id is an error.
- **Blend modes** are lowercase names with hyphens, as for `blendMode` on objects.

### Filter types

| `type` | Fields (default) |
|---|---|
| `barrel` | `amount` (1) |
| `blend` | `texture`, `blendMode` (`normal`), `amount` (1), `color` ([1, 1, 1, 1]) |
| `blocky` | `size` (`{ "x": 4, "y": 4 }`), `offset` (`{ "x": 0, "y": 0 }`) |
| `blur` | `quality` (0), `x` (2), `y` (2), `strength` (1), `color` (`#ffffff`), `steps` (4) |
| `bokeh` | `radius` (0.5), `amount` (1), `contrast` (0.2) |
| `colorMatrix` | `matrix` (identity, 20 numbers), `alpha` (1) |
| `combineColorMatrix` | `texture`, `matrixSelf`, `matrixTransfer` (identity, 20 numbers each), `additions` ([1, 1, 1, 0]), `multiplications` ([0, 0, 0, 1]) |
| `displacement` | `texture`, `x` (0.005), `y` (0.005) |
| `glow` | `color` (`#ffffff`), `outerStrength` (4), `innerStrength` (0), `scale` (1), `knockout` (false), `quality`, `distance` |
| `gradientMap` | `ramp` (one band, black to white), `dither` (false), `color` ([0, 0, 0, 0]), `colorFactor` ([0.3, 0.6, 0.1, 0]), `unpremultiply` (true), `alpha` (1) |
| `imageLight` | `normalMap`, `environmentMap`, `modelRotation` (0), `modelRotationSource`, `bulge` (0), `colorFactor` ([1, 1, 1]) |
| `key` | `color` (`#ffffff`), `alpha` (1), `isolate` (false), `threshold` (0.0625), `feather` (0) |
| `mask` | `source` or `texture`, `invert` (false), `viewTransform` (`world`), `scaleFactor` (1), `autoUpdate` (true) |
| `normalTools` | `rotation` (0), `rotationSource`, `facingPower` (1), `outputRatio` (false), `ratioVector` ([0, 0, 1]), `ratioRadius` (1) |
| `panoramaBlur` | `radius` (1), `samplesX` (32), `samplesY` (16), `power` (1) |
| `parallel` | `top`, `bottom` (filter lists), `blend` (`{ blendMode, amount, color }` as in `blend`) |
| `pixelate` | `amount` (1) |
| `quantize` | `steps` ([8, 8, 8, 8]), `gamma` ([1, 1, 1, 1]), `offset` ([0, 0, 0, 0]), `mode` (`rgba`), `dither` (false) |
| `shadow` | `x` (0), `y` (0), `decay` (0.1), `power` (1), `color` (`#000000`), `samples` (6), `intensity` (1) |
| `threshold` | `edge1` (0.5), `edge2` (0.5), `invert` (false) |
| `tiltShift` | `radius` (0.5), `amount` (1), `contrast` (0.2), `blurX` (1), `blurY` (1), `strength` (1) |
| `vignette` | `x` (0.5), `y` (0.5), `radius` (0.5), `strength` (0.5), `color` (`#000000`), `blendMode` (`normal`) |
| `wipe` | `progress` (0), `wipeWidth` (0.1), `direction` (`left-to-right`), `reveal` (false), `texture` |

Notes:

- **`mask`.** Give exactly one of `source` (an object id) or `texture` (an asset key). With neither, Phaser masks with a plain white texture, which hides nothing. See [Masks](#masks).
- **`blend`.** Uses its own shader, so `blendMode` accepts all of Phaser's blend modes: `normal`, `add`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`, `erase`, `source-in`, `source-out`, `source-atop`, `destination-over`, `destination-in`, `destination-out`, `destination-atop`, `lighter`, `copy`, `xor`. This is the core route to modes that object `blendMode` does not offer. The mode applies to all four channels, alpha included: `difference` of two opaque inputs has alpha 0, so the result is transparent. Lower the alpha in `color` to change that.
- **`vignette`.** `blendMode` is limited to `normal`, `add`, `multiply` and `screen`, as Phaser documents.
- **`glow`.** When absent, `quality` and `distance` come from the game config (`glowQuality` and `glowDistance`, both 10 by default). Phaser builds the shader from them, so they are fixed once the filter is created.
- **`gradientMap.ramp`.** An array of color bands, each with `colorStart`, `colorEnd` (`#rrggbb` or a channel vector), `start`, `middle`, `end` or `size`, `interpolation` and `colorSpace`, passed to Phaser's `ColorRamp`.
- **`threshold`.** `edge1`, `edge2` and `invert` take either one value for all channels or an array of four.
- **`quantize.mode`.** `rgba` or `hsva`.
- **`wipe`.** `direction` is `left-to-right`, `right-to-left`, `top-to-bottom` or `bottom-to-top`, matching Phaser's `setLeftToRight()` and related methods. (Phaser's constructor docs disagree with those methods about which `direction` number means top to bottom. The methods are the reference.) With `reveal: false` the input shows in the unwiped area; with `reveal: true` it shows in the wiped area. `texture` is drawn where the input is not shown. Absent, that area is blank. Animate `progress` with a script or tween.
- **`imageLight`, `normalTools`.** `modelRotationSource` and `rotationSource` are object ids. Phaser also accepts a callback, which is code and is not in the spec.
- **`parallel`.** Runs the `top` and `bottom` lists separately on the same input, then blends the `top` result over the `bottom` result with `blend`. An empty or absent list passes the input through unchanged. Example: a bloom is `top: [threshold, blur]` with `blend.blendMode: "add"`.
- **Left out:** `sampler` (it takes a callback), a filter's `viewCamera`, and `paddingOverride`. A serializer reports them as lossy.

### Masks

A `mask` filter with `source` renders the referenced object into a texture and uses that texture's alpha to hide parts of the filtered object.

- **The source object is still an ordinary object.** If it is visible, it draws where it is, as well as acting as a mask. That is Phaser's behavior, and PHASEFORM does not change it. To use an object only as a mask, set `visible: false`: a hidden source still masks.
- **Alpha counts.** The mask uses the source's rendered alpha, so a source with `alpha: 0` hides everything.
- **Transform.** With the default `viewTransform: "world"` the source is placed at its world position, including any parent containers. `local` uses the source's own transform and ignores its parents.
- **Sharing.** One source may mask several objects.
- **Texture masks.** With `texture`, the texture is stretched over the filter's area: the camera view for an external mask, or for an object without well-defined bounds (see Filter area above). Prefer `source` for masks that must line up with an object.
- **Cycles.** An object must not be the mask source for itself or one of its ancestors. A loader rejects such a cycle.

## Conventions

- **Coordinates.** Origin at top-left, y increases downward, matching Phaser. (Phaser 4 uses GL orientation for texture coordinates internally. That does not affect scene layout.)
- **Rotation.** Radians.
- **Ids.** Unique within a scene. A duplicate id is an error. Tools should keep ids stable across saves.
- **Child positions.** Relative to the parent container.

### Draw order

Draw order has two levels, matching how Phaser renders:

1. **At the scene root:** `depth` first, then position in `objects` as a tiebreaker. Later objects draw on top.
2. **Inside a container:** the order of `children` alone. A child's `depth` is ignored.

## Extensions

Anything beyond the core goes in an `extensions` object, keyed by a namespace:

```json
"extensions": { "arcade": { "body": "dynamic" } }
```

- A loader that does not know an extension must ignore it and keep it when saving.
- Names are lowercase, using letters, digits and hyphens, and must be unique. A registry file in this repository is proposed, first come first served.
- Extensions cannot change the meaning of core fields.
- Physics (`arcade`, `matter`) is an extension. Phaser's docs warn that physics bodies on container children can be offset by the container's transform, so extension authors should say how they handle that.
- Editor state does not belong in extensions. Use the sidecar file.

## Versioning

- `version` uses semver.
- **Patch:** clarifications and fixes, with no change to valid files.
- **Minor:** new core types or optional fields. Old files remain valid.
- **Major:** breaking changes to existing fields.
- A loader must refuse a file with a higher major version than it supports, and warn on a higher minor version.

## Conformance

A conforming implementation must:

1. Validate files against the JSON Schema.
2. Check what the schema cannot: unique ids and valid frames. For projects, also the rules in [PROJECT.md](PROJECT.md).
3. Preserve unknown types, unknown fields and extension data on load and save. Key order is not significant.
4. Load a valid file and create the Phaser objects described, with the defaults, transforms and draw order specified here.
5. Round-trip a file without losing core data.

To claim conformance, run the [conformance suite](../conformance/README.md) and report which parts you pass: `validate` (items 1 and 2), `build` (release builds) and `load` (item 4, for Phaser-based loaders). Parts you do not implement are not claimed. Bitmap text, the other shapes' geometry details and pixel output are not covered yet.

How well the core covers real Phaser scenes is measured in [SURVEY.md](SURVEY.md) and [ROUNDTRIP.md](ROUNDTRIP.md).
