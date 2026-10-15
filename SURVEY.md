# Example survey

How much of Phaser's official example set the PHASEFORM v0.1 core can describe.

**Method.** Each example script from [phaserjs/examples](https://github.com/phaserjs/examples) (commit `68140eca`, 2026-08-24; MIT licensed code) was run unmodified on Phaser **4.2.1** in headless Chrome (WebGL) with `verify/survey.mjs`. After 1.8 seconds the live scene was inspected: object types present, and which properties differ from their defaults. Source text was also scanned for behavior (tweens, input, update loops, and so on). `verify/survey-report.mjs` classifies the results. Run date: 2026-10-15.

**Scope.** 259 examples from the game-object folders that match, or sit next to, the core types: `images`, `sprites`, `text`, `container`, `graphics`, `shapes`, `tile sprite`, `bitmaptext`, `group`. This is a biased sample: it was chosen because it is near the core, so the "blocked" counts are lower bounds for the whole 2,499-example set.

**Caveats.**
- The repo mixes Phaser 3 era and Phaser 4 examples. Running on 4.2.1 is the only version test applied.
- The `updateLoop` and behavior signals are source-text matches, so they can over-count (an empty `update()` counts).
- Properties are read from a snapshot, so animated values appear as "differs from default".

## Results

| Class | Count | Meaning |
|---|---|---|
| static | 52 | Core types only, no behavior. Convertible with the v0.1 core today. |
| behavior | 46 | Core types only, plus tweens, input, update loops, etc. The scene converts; the behavior stays as code. |
| graphics | 75 | Uses `Graphics`, which is reserved in v0.1 (commands undefined). Blocked on the graphics commands design. |
| missing type | 77 | Contains an object type that is not in the core. |
| filters | 2 | Uses filters or lighting, out of scope for v0.1. |
| failed to run | 7 | 4 need external libraries (`dat.GUI`, `TimelineMax`), 3 fail for other reasons (`obj world cam` is in a `_wip` folder, `mouse trail` and `stacker es6` hit DOM or runtime errors). |

So **52 of 259 (20%)** convert fully today, and **98 (38%)** convert as scene data plus leftover code.

### Missing object types (examples containing each)

| Type | Examples | Note |
|---|---|---|
| BitmapText | 28 | plus 13 `DynamicBitmapText` |
| TileSprite | 14 | |
| Shapes | about 20 | Rectangle 4, IsoBox 4, Arc 3, Polygon 3, Curve 2, Grid 2, Ellipse, IsoTriangle, Line, Star, Triangle (1 each) |
| Blitter | 2 | |
| ParticleEmitter | 1 | |

### Behavior in the examples that run

| Signal | Examples |
|---|---|
| update loop | 82 |
| tweens | 64 |
| input | 37 |
| physics | 7 |
| timers | 7 |
| animations | 4 |
| camera motion | 2 |

### Properties that differ from defaults

`scale` 72, `origin` 64, `rotation` 64, `blendMode` 53, `frame` 52, `alpha` 20, `input` 15, `depth` 9, `physicsBody` 7, `name` 6, `tint` 5, `animPlaying` 4, `scrollFactor` 2, `flip` 2, `visible=false` 1.

Every one of these except `input`, `physicsBody` and `animPlaying` is already a core field. Input and physics are behavior (physics is an extension). Animations are the one gap among the properties.

**Blend modes used:** MULTIPLY 4, ADD 4 (two as the string `'ADD'`), DIFFERENCE 1, COLOR_DODGE 1. The 4-mode core covers 8 of the 10 uses, and the other two are modes WebGL does not render correctly (see [VERIFICATION.md](VERIFICATION.md)).

## What this suggests

1. **Graphics commands are the largest blocker** (75 examples, 29%), so deferring them cost real coverage. Design `graphics.commands` next.
2. **Add the next core types:** `bitmapText` (41 examples) and `tileSprite` (14) are the clear next two. Shapes are a family (about 20 examples) and could be one `shape` type with a `shape` field, or separate types. This needs a design decision.
3. **Animations are the missing piece for sprites.** Four examples play animations, but any real game with sprites will need them. This needs an animation definition in the project manifest and a field on `sprite` to choose one.
4. **Behavior stays code**, as the non-goals say. The `scripts` field matters for 46 examples, so the script contract (open question) is worth settling.
5. **Phaser `Group` is not a display object**, and 15 examples use it to create many sprites. A PHASEFORM scene would flatten these to sprites and lose the grouping. Decide whether grouping needs representing.
6. **Conversion can be mechanical.** The runner already reads the live scene. A serializer from a running scene to PHASEFORM would convert the 52 static examples (and the scene part of the 46 behavior ones) without hand-writing JSON. The same serializer is the basis for a pixel-comparison conformance test.

## Reproduce

```
cd verify && npm install
node survey.mjs <path-to-examples>/public survey-results.json \
  "game objects/images" "game objects/sprites" "game objects/text" "game objects/container" \
  "game objects/graphics" "game objects/shapes" "game objects/tile sprite" \
  "game objects/bitmaptext" "game objects/group"
node survey-report.mjs survey-results.json
```
