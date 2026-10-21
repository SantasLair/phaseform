# phaseform-loader

Reference loader for [PHASEFORM](https://github.com/SantasLair/phaseform), an open JSON format for describing 2D scenes for Phaser 4. It builds a PHASEFORM scene document into game objects in a live Phaser 4 scene.

Draft v0.1: the format and this package may still change.

```js
import { build, loadAssets } from 'phaseform-loader';

// in preload(): loadAssets(this, project)
// in create():  build(this, sceneDocument)
```

Objects can be pinned to the edges or centre of the game with `anchor` (see the spec). `build` returns a `layout(width, height)` function that positions them for the real game size; call it after `build` and from your own resize handler:

```js
const scene = build(this, sceneDocument);
scene.layout(this.scale.width, this.scale.height);
this.scale.on('resize', (size) => scene.layout(size.width, size.height));
```

Scripts can have their params described and defaulted by a `.params.json` sidecar (see the spec). The loader reads no files: pass the defaults a build produced (the `paramDefaults` export of the registry, or `virtual:phaseform` with the Vite plugin) next to the script modules:

```js
build(this, sceneDocument, { modules: scripts, paramDefaults });
```

`phaser` (^4.2.1) is a peer dependency. The scene and project formats are specified in the [repository](https://github.com/SantasLair/phaseform).

Licensed under Apache-2.0.
