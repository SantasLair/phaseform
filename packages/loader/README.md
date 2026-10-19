# phaseform-loader

Reference loader for [PHASEFORM](https://github.com/SantasLair/phaseform), an open JSON format for describing 2D scenes for Phaser 4. It builds a PHASEFORM scene document into game objects in a live Phaser 4 scene.

Draft v0.1: the format and this package may still change.

```js
import { build, loadAssets } from 'phaseform-loader';

// in preload(): loadAssets(this, project)
// in create():  build(this, sceneDocument)
```

`phaser` (^4.2.1) is a peer dependency. The scene and project formats are specified in the [repository](https://github.com/SantasLair/phaseform).

Licensed under Apache-2.0.
