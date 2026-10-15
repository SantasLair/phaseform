# PHASEFORM

**Phaser Hierarchical Authoring Scene Format**

An open, declarative file format for describing 2D scenes for [Phaser](https://phaser.io).

> Status: **Draft v0.1.** Nothing here is implemented or stable yet. This document is the starting point for the spec, the JSON Schema, and a reference loader.

---

## Purpose

Phaser has no standard way to save a scene as data. Every editor, tool, and game invents its own. PHASEFORM defines one shared format that any editor can write and any Phaser project can read.

PHASEFORM is a **format**, not a tool. Editors are implementations of it.

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
| `size` | yes | Base resolution in pixels. |
| `background` | no | Background color as a CSS color string. |
| `objects` | yes | Ordered list of objects. Later objects draw on top of earlier ones. |
| `extensions` | no | Scene-level extension data, keyed by extension name. |

## Objects

Every object has these common fields:

| Field | Required | Description |
|---|---|---|
| `id` | yes | Unique within the scene. Stable across saves. |
| `type` | yes | Object type (see Core types). |
| `x`, `y` | no | Position. Defaults to `0`. |
| `depth` | no | Draw order within the scene. Defaults to `0`. |
| `alpha` | no | `0` to `1`. Defaults to `1`. |
| `visible` | no | Defaults to `true`. |
| `scripts` | no | List of script paths to attach. |
| `extensions` | no | Extension data, keyed by extension name. |
| `children` | no | Child objects. Only valid for `container`. |

Transform fields that apply to visual objects (`scale`, `rotation`, `origin`, `tint`) are described per type below.

### Core types (v0.1)

| Type | Maps to Phaser | Specific fields |
|---|---|---|
| `image` | `Phaser.GameObjects.Image` | `key`, `frame`, `origin`, `scale`, `rotation`, `tint` |
| `sprite` | `Phaser.GameObjects.Sprite` | `key`, `frame`, `origin`, `scale`, `rotation`, `tint` |
| `text` | `Phaser.GameObjects.Text` | `text`, `style` |
| `container` | `Phaser.GameObjects.Container` | `children` |
| `graphics` | `Phaser.GameObjects.Graphics` | `commands` (proposed, see Open questions) |

`key` references a texture or asset key the scene expects to be loaded. PHASEFORM does not define how that asset is loaded.

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

## Conventions (proposed)

- **Coordinates:** origin at top-left, y increases downward, matching Phaser's default.
- **Rotation:** radians, matching Phaser's `rotation` property.
- **Draw order:** `depth` first, then position in `objects` as a tiebreaker.
- **Ids:** unique within a scene. Tools should keep ids stable across saves.
- **Child positions:** relative to the parent container, matching Phaser.

## Extensions

Anything beyond the core goes in an `extensions` object, keyed by a namespace:

```json
"extensions": { "arcade": { "body": "dynamic" } }
```

Rules:

- A loader that does not know an extension must ignore it and keep it when saving.
- Extension names should be lowercase and unique. Proposed: a published registry, first come first served.
- Extensions cannot change the meaning of core fields.

## Assets

PHASEFORM references assets by key. A separate asset manifest (not yet specified) maps keys to files. Keeping this separate lets the same scene load in different environments.

## Versioning

- `version` uses semver.
- **Patch:** clarifications and fixes, with no change to valid files.
- **Minor:** new core types or optional fields. Old files remain valid.
- **Major:** breaking changes to existing fields.
- A loader must refuse a file with a higher major version than it supports, and warn on a higher minor version.

## Conformance

A conforming implementation must:

1. Validate files against the JSON Schema (to be published).
2. Preserve unknown types and extension data on load and save.
3. Load a valid file and create the Phaser objects described, with the transforms and draw order specified above.
4. Round-trip a file without losing core data.

---

## Open questions

1. **Graphics commands.** Should `graphics` store drawing commands, or only a reference to a shape? Commands are more useful but more to specify.
2. **Asset manifest.** Specify it in this spec, or in a companion spec?
3. **Rotation units.** Radians match Phaser, but degrees are friendlier to hand-edit. Which should win?
4. **Phaser version.** Target Phaser 3 for v0.1. Confirm the minimum version.
5. **Scene vs. project file.** Should a project-level file list scenes and assets, or should scenes be self-contained?
6. **Physics.** Keep as an extension (`arcade`, `matter`) for v0.1, or add a core field?

## Roadmap

1. Finalize core types and conventions in this document.
2. Publish the JSON Schema for v0.1.
3. Write the reference loader and serializer, with round-trip tests.
4. Add conformance examples for other editors to check against.
5. Build the first implementation: an editor exports and imports PHASEFORM.

## Naming notes

- **npm:** `phaseform` and `phase-form` are unclaimed as of this draft. A scoped package (such as `@scope/phaseform`) is the likely route.
- **Search:** no existing software or file format called PHASEFORM turned up in web search.
- **Not yet checked:** GitHub organization and repository names, and trademark registries. Do this before public release.

## License

- **Code, schema, and examples** (`phaseform.schema.json`, `examples/`, and any reference loader): [Apache License 2.0](LICENSE).
- **Specification text** (this document): [Creative Commons Attribution 4.0 International](LICENSE-SPEC).

The name PHASEFORM is not covered by either license.
