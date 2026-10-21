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
| `animations` | no | Animation definitions. See [Animations](#animations). |
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

## Animations

Phaser keeps animations in one manager for the whole game, so they are defined once in the project and sprites refer to them by key (see `animation` in the scene spec). Each entry is Phaser's animation config with the frames written out:

```json
"animations": [
  { "key": "coin-spin", "frameRate": 10, "repeat": -1,
    "frames": [{ "key": "coin", "frame": 0 }, { "key": "coin", "frame": 1 }, { "key": "coin", "frame": 2 }] }
]
```

| Field | Required | Default | Description |
|---|---|---|---|
| `key` | yes | | Unique among animations. |
| `frames` | yes | | Non-empty list in play order. Each has `key` (texture), optional `frame`, `duration` (extra ms on this frame) and `visible`. |
| `frameRate` | no | 24 if `duration` is also absent | Frames per second. |
| `duration` | no | | Total length in ms, used when `frameRate` is absent. |
| `delay`, `repeatDelay` | no | `0` | Milliseconds. |
| `repeat` | no | `0` | `-1` repeats forever. |
| `yoyo`, `showBeforeDelay`, `showOnStart`, `hideOnComplete`, `randomFrame` | no | `false` | As in Phaser. |
| `skipMissedFrames` | no | `true` | As in Phaser. |

Frames are always listed one by one. Phaser's shortcuts (`generateFrameNumbers`, a texture key standing for all its frames) are for code; a tool expands them before saving. Sprite-local animations (`sprite.anims.create`) are not in v0.1.

## Rules

- **Key uniqueness.** Image, spritesheet, atlas and bitmapFont keys share Phaser's texture namespace (a bitmap font's image is added to the texture manager under the font's key) and must be unique among themselves. Audio keys are unique among audio. Different namespaces may reuse a key.
- **Scene keys** are unique within `scenes`.
- **`entry`** must be one of the scene keys.
- **Per-scene `assets`** must name keys that exist in the manifest.
- **Texture references.** Every `key` used by an `image` or `sprite` object in a scene should be a texture asset in the manifest. A missing one is a **warning**, not an error: Phaser would draw its placeholder texture, but a project may load some assets by other means.
- **Font references.** The `font` of a `bitmapText` object should be a `bitmapFont` asset in the manifest. A missing one is a **warning**, as for textures.
- **Animations.** Animation keys are unique (error). Each frame's `key` should be a texture asset (warning). A sprite's `animation.key` should be an animation in the project (warning: Phaser warns and plays nothing).
- **Frames.** A scene object's `frame` should exist in its texture. Phaser does not fail on a missing frame; it warns and silently falls back to the default, so loaders must check. Where the manifest cannot say (no `frames` count, atlas not readable), skip the check.
- **Scene sizes.** All scenes in a project should have the same `size`. A loader warns when they differ.
- **Scene file validity.** Every scene file must itself be valid against the scene schema.
- **Unknown data** (fields, asset types, extensions) is preserved on load and save.

## Loading (informative)

A reference loader does roughly this:

1. Read the project file and validate it against [phaseform.project.schema.json](../phaseform.project.schema.json).
2. Create the Phaser game using the `size` of the entry scene.
3. For each scene, queue the loader calls for its assets (all assets, or the scene's `assets` list).
4. After loading, create the project's animations that do not exist yet.
5. Build each scene's objects as described in the scene spec, resolving scripts through the script registry (see [Release builds](#release-builds)), and start each sprite's animation.

## Release builds

A release build turns a project into the files a game ships. It is optional: a game may load the source files as they are, as long as it supplies its script modules (see below). This section defines what a build may and must do, so that every tool produces the same result.

### Script registry

A scene names scripts by path (`"scripts/health-bar.js"`), relative to the project root. A loader never imports a path itself. It resolves each path through a **script registry**: an object whose keys are script paths, exactly as written in the scenes, and whose values are the modules, each with optional `create` and `update` hooks.

The registry exists because bundlers include only modules that are imported in code. A path inside a JSON file is invisible to them, so the script would be left out of the bundle or renamed. A build collects every script path from every scene in the project and generates the registry as a module the bundler can see:

```js
import * as s0 from './scripts/health-bar.js';
import * as s1 from './scripts/radar.js';
export default { 'scripts/health-bar.js': s0, 'scripts/radar.js': s1 };
```

- A build also reads each script's [params sidecar](SPEC.md#script-params), if it has one, and writes the defaults as a named export of the registry module, for the loader's `paramDefaults` option:

  ```js
  export const paramDefaults = { 'scripts/health-bar.js': { "seconds": 5, "color": "#ffcc33" } };
  ```

  Only scripts that have a sidecar with at least one `default` appear. The sidecar files themselves do not ship.
- A script path that does not resolve to a file is a build **error**. (At runtime, a path missing from the registry is a warning, as in the scene spec.)
- The registry is complete before any scene is built, so the loader never waits on an import while building a scene.
- How the registry is produced is up to the tool. A hand-written registry is also valid.

### Editor-only data

- A build may remove `placeholder` from every object. Loaders never draw it, so the scene renders the same.
- A build must not remove anything else. Unknown fields and extension data may be read at runtime.
- The editor sidecar file never ships, and neither do the scripts' `.params.json` files (their defaults go into the registry).
- A stripped document must still be valid against the schemas.

### Packaging

- **Scene and project files** may ship as separate JSON files, loaded at runtime, or be inlined into the bundle. Separate files can be replaced without rebuilding the game, which suits level updates and mods. Either way the loader receives the same parsed documents.
- **Asset files** keep their manifest `url` unless the build moves or renames them (for example to add a content hash). In that case the build rewrites the `url` fields, and the result must still be valid. Hashing schemes and hosting are otherwise up to the game.

### Validation

A build validates the project file and every scene file, against the schemas and the rules above, and fails on any error. A runtime loader may skip validation for documents produced by a validated build, but must still check `version` against the versions it supports.

## Not in this version

- Prefabs, shared object definitions, and the editor sidecar file (separate specs).
- Asset types beyond the five core types (tilemaps, video, atlas-based bitmap fonts).
- Asset packs, a hashing scheme, or a CDN base URL. (What a build may do is in [Release builds](#release-builds).)
- Phaser game configuration beyond `size`.

## Conformance

A project is valid when it passes the schema and the rules above (errors for the structural rules, warnings for texture references, frames and scene sizes). An implementation must:

1. Validate project files against the schema.
2. Enforce the rules above.
3. Preserve unknown data on load and save.
