# PHASEFORM scene specification

**Draft v0.1.** Scenes are described by one JSON document. Projects (scene list and asset manifest) are specified in [PROJECT.md](PROJECT.md). The schema is [phaseform.schema.json](../phaseform.schema.json).

Behavior that Phaser's documentation leaves unstated is checked by tests and recorded in [VERIFICATION.md](VERIFICATION.md) before it is written here.

## Contents

- [Scope](#scope)
- [Scene document](#scene-document)
- [Objects](#objects)
- [Conventions](#conventions)
- [Extensions](#extensions)
- [Versioning](#versioning)
- [Conformance](#conformance)

## Scope

**Target.** Phaser 4 (verified against 4.2.1) with the WebGL renderer. Older Phaser versions and the Canvas renderer are not supported.

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
| `scripts` | no | none | Script paths to attach, relative to the project root. |
| `extensions` | no | none | Extension data, keyed by extension name. |

On a container, `scrollFactor` affects the container only, not its children.

### Core types

| Type | Phaser class | Type-specific fields |
|---|---|---|
| `image` | `Image` | `key`, `frame`, `origin`, `scale`, `rotation`, `flipX`, `flipY`, `tint`, `tintMode`, `blendMode` |
| `sprite` | `Sprite` | same as `image` |
| `text` | `Text` | `text`, `style`, `origin`, `scale`, `rotation`, `tint`, `tintMode`, `blendMode` |
| `container` | `Container` | `children`, `scale`, `rotation`, `blendMode` |
| `graphics` | `Graphics` | reserved |

Fields not listed for a type are invalid on that type. Containers have no `origin`, `flipX`, `flipY`, `tint` or size: Phaser fixes a container's origin, gives it zero intrinsic size, and gives it no tint or flip.

`graphics` is reserved in v0.1. The type name and common fields are valid, and any other fields are preserved but not defined.

### Field reference

| Field | Type | Default | Applies to |
|---|---|---|---|
| `key` | string, required | | image, sprite |
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
| `children` | list of objects | | container |

`tintMode` is one of `multiply`, `fill`, `add`, `screen`, `overlay`, `hard-light`. `blendMode` is one of `normal`, `add`, `multiply`, `screen`.

**Notes**

- **`frame`.** An index or a name. Phaser does not fail on a missing frame: it warns and falls back to the default frame, so loaders must validate frames.
- **`rotation`.** Phaser normalizes rotation to between -π and π. Loaders and tests compare rotations modulo 2π.
- **`tint`.** Converted to Phaser's numeric tint. Per-corner tint is not in the core.
- **`blendMode`.** The four values are the modes WebGL renders natively. Other Phaser modes may render incorrectly in WebGL (`difference` was observed falling back to `normal`), so they are not in the core. Phaser silently treats an unknown name as `normal`, so loaders must reject unknown values themselves. A container has no blend mode of its own by default, so its children keep theirs. Writing `blendMode` on a container sets one explicitly.
- **`style`.** Phaser's text style config object, passed through unchanged: shadow is nested as `shadow: { offsetX, ... }`, word wrap as `wordWrap: { width, useAdvancedWrap }`, and `padding` goes inside `style`. Phaser's defaults are Courier, 16px, white. A numeric `fontSize` becomes pixels. If `metrics` (`ascent`, `descent`, `fontSize`) is given, Phaser uses it instead of measuring, which changes text height, so it must be preserved.
- **vec2.** `{ "x": number, "y": number }`.

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

How well the core covers real Phaser scenes is measured in [SURVEY.md](SURVEY.md) and [ROUNDTRIP.md](ROUNDTRIP.md).
