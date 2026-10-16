# PHASEFORM Project

**Companion spec to [SPEC.md](SPEC.md). Draft v0.1.**

A scene file describes one scene and refers to assets only by key. A **project file** ties scenes together: it lists the scenes, says which one starts, and maps asset keys to files. Scenes stay self-contained and valid on their own. The project file is what makes a set of scenes loadable.

The project file is named `phaseform.project.json` by convention. Its directory is the **project root**.

## Document structure

```json
{
  "format": "phaseform-project",
  "version": "0.1.0",
  "name": "My Game",
  "entry": "Level1",
  "scenes": [
    { "key": "Level1", "path": "scenes/level1.phaseform.json" }
  ],
  "assets": [
    { "key": "hero", "type": "spritesheet", "url": "assets/hero.png", "frameWidth": 32, "frameHeight": 48 }
  ]
}
```

| Field | Required | Description |
|---|---|---|
| `format` | yes | Always `"phaseform-project"`. |
| `version` | yes | Spec version the file was written against (semver, same rules as the scene spec). |
| `name` | yes | Human-readable project name. |
| `entry` | yes | Key of the scene that starts first. Must match a scene in `scenes`. |
| `scenes` | yes | Non-empty list of scene entries. |
| `assets` | yes | Asset manifest. May be empty. |
| `extensions` | no | Project-level extension data, same rules as scene extensions. |

### Scene entries

| Field | Required | Description |
|---|---|---|
| `key` | yes | The scene's key. Must equal the `key` inside the scene file; a loader checks this. |
| `path` | yes | Path to the scene file, relative to the project root, using forward slashes. |
| `assets` | no | List of asset keys to preload for this scene. If omitted, all assets are preloaded. |
| `extensions` | no | Extension data for this entry. |

## Asset manifest

Each entry maps a key to the file or files Phaser loads. Paths are relative to the project root, with forward slashes. The types mirror Phaser's loader calls.

| Field | Required | Description |
|---|---|---|
| `key` | yes | The key that scene objects use. |
| `type` | yes | Asset type. Unknown types are valid and must be preserved. |
| `extensions` | no | Extension data. |

Core types:

| Type | Phaser loader call | Type fields |
|---|---|---|
| `image` | `load.image` | `url` |
| `spritesheet` | `load.spritesheet` | `url`, `frameWidth`, `frameHeight`, optional `startFrame`, `endFrame`, `margin`, `spacing`, `frames` |
| `atlas` | `load.atlas` | `url` (texture), `atlasUrl` (JSON frame data) |
| `bitmapFont` | `load.bitmapFont` | `url` (font image), `dataUrl` (font data, XML) |
| `audio` | `load.audio` | `urls` (list of alternative files) |

`frames` on a spritesheet is an optional frame count. Without it, a tool cannot know the sheet's size from the manifest and can only check that a frame index is a non-negative integer. For atlases, a tool that can read the atlas JSON may validate frame names.

Anything else (tilemaps, video, scripts) is an unknown type in v0.1: it is preserved but not defined.

## Rules

- **Key uniqueness.** Image, spritesheet, atlas and bitmapFont keys share Phaser's texture namespace (a bitmap font's image is added to the texture manager under the font's key) and must be unique among themselves. Audio keys are unique among audio. Different namespaces may reuse a key.
- **Scene keys** are unique within `scenes`.
- **`entry`** must be one of the scene keys.
- **Per-scene `assets`** must name keys that exist in the manifest.
- **Texture references.** Every `key` used by an `image` or `sprite` object in a scene should be a texture asset in the manifest. A missing one is a **warning**, not an error: Phaser would draw its placeholder texture, but a project may load some assets by other means.
- **Font references.** The `font` of a `bitmapText` object should be a `bitmapFont` asset in the manifest. A missing one is a **warning**, as for textures.
- **Frames.** A scene object's `frame` should exist in its texture. Phaser does not fail on a missing frame; it warns and silently falls back to the default, so loaders must check. Where the manifest cannot say (no `frames` count, atlas not readable), skip the check.
- **Scene sizes.** All scenes in a project should have the same `size`. A loader warns when they differ.
- **Scene file validity.** Every scene file must itself be valid against the scene schema.
- **Unknown data** (fields, asset types, extensions) is preserved on load and save.

## Loading (informative)

A reference loader does roughly this:

1. Read the project file and validate it against [phaseform.project.schema.json](../phaseform.project.schema.json).
2. Create the Phaser game using the `size` of the entry scene.
3. For each scene, queue the loader calls for its assets (all assets, or the scene's `assets` list).
4. After loading, build each scene's objects as described in the scene spec.

## Not in this version

- Prefabs, shared object definitions, and the editor sidecar file (separate specs).
- Asset types beyond the four core types.
- Asset packs, bundling, hashing, or a CDN base URL.
- Phaser game configuration beyond `size`.

## Conformance

A project is valid when it passes the schema and the rules above (errors for the structural rules, warnings for texture references, frames and scene sizes). An implementation must:

1. Validate project files against the schema.
2. Enforce the rules above.
3. Preserve unknown data on load and save.
