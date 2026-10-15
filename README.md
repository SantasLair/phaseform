# PHASEFORM

**Phaser Hierarchical Authoring Scene Format**

An open, declarative file format for describing 2D scenes for [Phaser](https://phaser.io).

> Status: **Draft v0.1.** Nothing here is implemented or stable yet. This document is the starting point for the spec, the JSON Schema, and a reference loader.

---

## Purpose

Phaser has no standard way to save a scene as data. Every editor, tool, and game invents its own. PHASEFORM defines one shared format that any editor can write and any Phaser project can read.

PHASEFORM is a **format**, not a tool. Editors are implementations of it.

### Prior art

Phaser Editor has its own JSON `.scene` format, but it is an editor-internal format that compiles to Phaser code, not a format a Phaser game loads at runtime. PHASEFORM is meant to be loaded directly at runtime and written by any tool.

## Target

PHASEFORM v0.1 targets **Phaser 4** (verified against 4.2.1) with the **WebGL** renderer. Older Phaser versions and the Canvas renderer are not supported. Behavior that the Phaser docs leave unstated is checked by tests, recorded in [VERIFICATION.md](VERIFICATION.md), and only then written into this document.

## Goals

- **Declarative data only.** No code inside the file. Behavior is referenced by key or script path.
- **Maps directly to Phaser.** Each object corresponds to a Phaser game object type, with no invented concepts.
- **Small core.** Only the most common object types are in the core. Everything else is an extension.
- **Forward compatible.** Unknown object types and fields are preserved on load and save, so no tool silently deletes data it does not understand.
- **Easy to validate.** A published JSON Schema covers the structure, and a reference loader covers behavior.
- **Human-readable.** Plain JSON, diffable in version control.

## Non-goals

- Editor UI state (camera position, selection, locks, panel layout). These belong in a separate sidecar file, not the scene.
- Prefabs, templates, or an inheritance system. These may come later as a separate spec.
- Code generation. PHASEFORM describes scenes, not the source code that runs them.
- Replacing Phaser's loader or asset pipeline. PHASEFORM references assets by key.
- Support for Phaser versions before 4, or for the Canvas renderer.

---

## Document structure

A PHASEFORM scene is a single JSON document.

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
| `size` | yes | Game size in pixels: the Phaser game config `width` and `height`. By default the scene camera has the same size. All scenes in one game should agree on it; a loader warns when they differ. |
| `background` | no | Background color as a CSS color string. |
| `objects` | yes | Ordered list of objects. See [Draw order](#draw-order). |
| `extensions` | no | Scene-level extension data, keyed by extension name. |

## Objects

### Common fields

These fields apply to every object, including containers.

| Field | Required | Default | Description |
|---|---|---|---|
| `id` | yes | | Unique within the scene. Stable across saves. |
| `type` | yes | | Object type (see Core types). |
| `name` | no | `""` | Maps to the game object's `name`. Phaser never sets or reads it. |
| `x`, `y` | no | `0` | Position. |
| `depth` | no | `0` | Draw order at the scene root. See [Draw order](#draw-order). |
| `alpha` | no | `1` | `0` to `1`. |
| `visible` | no | `true` | |
| `active` | no | `true` | Whether Phaser updates the object. |
| `scrollFactor` | no | `{ "x": 1, "y": 1 }` | Camera scroll factor. On a container it affects the container only, not its children. |
| `data` | no | none | Free key/value data, applied with the game object's data manager. |
| `scripts` | no | none | List of script paths to attach. Paths are relative to the project root. |
| `extensions` | no | none | Extension data, keyed by extension name. |

### Core types

| Type | Maps to Phaser | Specific fields |
|---|---|---|
| `image` | `Phaser.GameObjects.Image` | `key`, `frame`, `origin`, `scale`, `rotation`, `flipX`, `flipY`, `tint`, `tintMode`, `blendMode` |
| `sprite` | `Phaser.GameObjects.Sprite` | same as `image` |
| `text` | `Phaser.GameObjects.Text` | `text`, `style`, `origin`, `scale`, `rotation`, `tint`, `tintMode`, `blendMode` |
| `container` | `Phaser.GameObjects.Container` | `children`, `scale`, `rotation`, `blendMode` |
| `graphics` | `Phaser.GameObjects.Graphics` | reserved, see below |

Fields not listed for a type are invalid on that type. In particular, **containers have no `origin`, `flipX`, `flipY`, `tint`, or size**: Phaser containers fix their origin, have zero intrinsic size, and have no tint or flip.

### Field defaults and mapping

| Field | Type | Default | Notes |
|---|---|---|---|
| `key` | string | required | Texture key the scene expects to be loaded. PHASEFORM does not define how it is loaded. |
| `frame` | integer or string | the texture's default frame | Index or name. Phaser does not fail on a missing frame; it warns and silently falls back to the default frame, so loaders must validate frames themselves. |
| `origin` | vec2 | `{0.5, 0.5}` for image and sprite, `{0, 0}` for text | |
| `scale` | vec2 | `{1, 1}` | |
| `rotation` | number | `0` | Radians. Phaser normalizes the value to between -π and π, so loaders and tests compare rotations modulo 2π. |
| `flipX`, `flipY` | boolean | `false` | Image and sprite only. |
| `tint` | `#rrggbb` | `#ffffff` | Converted to Phaser's numeric tint. |
| `tintMode` | enum | `multiply` | One of `multiply`, `fill`, `add`, `screen`, `overlay`, `hard-light`. |
| `blendMode` | enum | `normal` for image, sprite and text; none for container | One of `normal`, `add`, `multiply`, `screen`. A container has no blend mode of its own by default (Phaser uses an internal "skip check" value), so its children keep their own. Writing `blendMode` on a container sets one explicitly. These are the modes WebGL renders natively. Other Phaser blend modes may render incorrectly in WebGL (`difference` was observed falling back to `normal`), so they are not in the core. Phaser silently treats an unknown name as `normal`, so loaders must reject unknown values themselves. |
| `text` | string | required | |
| `style` | object | Phaser's defaults | Phaser's text style *config* object, passed through unchanged (so shadow is nested as `shadow: { offsetX, ... }` and word wrap as `wordWrap: { width, useAdvancedWrap }`). Phaser's defaults are Courier, 16px, white. A numeric `fontSize` is accepted and becomes pixels. `padding` goes inside `style`. If `metrics` (`ascent`, `descent`, `fontSize`) is given, Phaser uses it instead of measuring, which changes the text height, so it must be preserved. |

`graphics` is reserved in v0.1: the type name and common fields are valid, any other fields are preserved but not defined. Drawing commands will be specified in a later minor version.

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
      "scale": { "x": 1, "y": 1 },
      "rotation": 0,
      "scripts": ["scripts/player.js"],
      "extensions": { "arcade": { "body": "dynamic" } }
    },
    {
      "id": "hud",
      "type": "container",
      "x": 0,
      "y": 0,
      "children": [
        { "id": "score", "type": "text", "text": "0", "x": 16, "y": 16 }
      ]
    }
  ]
}
```

## Conventions

- **Coordinates:** origin at top-left, y increases downward, matching Phaser's default. (Phaser 4 uses GL orientation for texture coordinates internally. That does not affect scene layout.)
- **Rotation:** radians.
- **Ids:** unique within a scene. A duplicate id is an error. Tools should keep ids stable across saves.
- **Child positions:** relative to the parent container, matching Phaser.
- **Vectors:** `{ "x": number, "y": number }` is called a vec2 in this document.

### Draw order

Draw order has two levels, matching how Phaser renders:

1. **At the scene root:** `depth` first, then position in `objects` as a tiebreaker. Later objects draw on top.
2. **Inside a container:** the order of `children` alone. A child's `depth` is ignored. (Verified: a child with a higher `depth` listed earlier still draws underneath a later sibling.)

## Extensions

Anything beyond the core goes in an `extensions` object, keyed by a namespace:

```json
"extensions": { "arcade": { "body": "dynamic" } }
```

Rules:

- A loader that does not know an extension must ignore it and keep it when saving.
- Extension names are lowercase, using letters, digits and hyphens. Names must be unique; a registry file in this repository is proposed, first come first served.
- Extensions cannot change the meaning of core fields.
- Physics (`arcade`, `matter`) is an extension. Phaser's docs warn that physics bodies on container children can be offset by the container's transform, so extension authors should say how they handle that.
- Editor state does not belong in extensions. Use the sidecar file.

## Assets

PHASEFORM references assets by key. The mapping from keys to files, the list of scenes, and the entry scene live in a separate project file, specified in [PROJECT.md](PROJECT.md) with its own schema, `phaseform.project.schema.json`. Keeping this separate lets the same scene load in different environments, and a scene file stays valid on its own.

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
3. Preserve unknown types, unknown fields, and extension data on load and save. Key order is not significant.
4. Load a valid file and create the Phaser objects described, with the defaults, transforms and draw order specified above.
5. Round-trip a file without losing core data.

---

## Open questions

1. **Graphics commands.** Phaser's Graphics keeps a command buffer with a full draw API. Design a `commands` representation in a later minor version.
2. **Script contract.** How a script path is invoked and what it receives.
3. **Asset types beyond the four core types** in PROJECT.md: bitmap fonts, tilemaps, video.
4. **Tint on graphics**, and the remaining items listed in VERIFICATION.md follow-ups.

## Roadmap

1. ~~Finalize core types and conventions in this document.~~ Done for v0.1, pending the open questions above.
2. ~~Write the project and asset manifest spec.~~ Done: [PROJECT.md](PROJECT.md).
3. ~~Publish the JSON Schema for v0.1.~~ Scene and project schemas are drafted; `npm run validate` in `verify/` checks the examples against them.
4. Write the reference loader and serializer, with round-trip tests. `verify/check-project.mjs` is a prototype of the loader's validation pass.
5. Add conformance examples for other editors to check against.
6. Build the first implementation: an editor exports and imports PHASEFORM.

## Naming notes

- **npm:** `phaseform` and `phase-form` are unclaimed as of this draft. A scoped package (such as `@scope/phaseform`) is the likely route.
- **Search:** no existing software or file format called PHASEFORM turned up in web search.
- **Not yet checked:** GitHub organization and repository names, and trademark registries. Do this before public release.

## License

- **Code, schema, and examples** (`phaseform.schema.json`, `examples/`, and any reference loader): [Apache License 2.0](LICENSE).
- **Specification text** (this document): [Creative Commons Attribution 4.0 International](LICENSE-SPEC).

The name PHASEFORM is not covered by either license.
