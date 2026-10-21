# PHASEFORM conformance suite

Test cases for anyone writing a PHASEFORM tool. Each part checks one clause of [SPEC.md](../docs/SPEC.md#conformance). The expected results are written down in files, so an implementation in any language can run them.

| Part | What it checks | Cases |
|---|---|---|
| `validate/` | Files are accepted or rejected as the schemas and the rules say. | `validate/cases.json`: each entry names a scene or project file under `examples/` and says `valid` or `invalid`. Only accept/reject is normative, not the message. Scripts named in scenes need not exist. |
| `build/` | A release build ([PROJECT.md](../docs/PROJECT.md#release-builds)). | `build/expect.json` and `build/project/`: the files a build writes, scenes equal to the source minus `placeholder`, and an error with no output when a script is missing. |
| `load/` | A loader creates the objects the spec describes. | `load/*.case.json`: a `scene`, the generated `textures` to register first, and the `expect`ed dump. |

## The load dump

A loader runs a case's `scene` in a Phaser 4 scene (after registering each entry of `textures` as a blank texture of that size; entries with `frameWidth` get numbered frames), then reports every object in **draw order**: root objects sorted by `depth` then array order, each container's children following it in order. Each object is a record with `id`, `type` (Phaser's class name), `parent` (container id or null) and the values Phaser reports: `x`, `y`, `scaleX`, `scaleY`, `rotation` (radians, modulo 2π), `alpha`, `visible`, `active`, `originX/Y` (not on containers or graphics), `flipX/Y`, `tint` (`#rrggbb` or null), `tintMode`, `texture`, `frame`, `text`, `fill`, `stroke`, `blendMode` (`null` for containers, which inherit), `scrollFactorX/Y`, `name`, `data` (script-set values included), and by type: `width`, `height`, `tilePositionX/Y`, `tileScaleX/Y`, `tileRotation` (tileSprite), `animation` (the playing animation's key or null, on sprites), `filters` (`{ internal, external }`, each a list of `{ type, active }` in order, on objects that have filters). `warnings` is the number of warnings the load produced. A case may also carry `layout` (a size `{ width, height }`, or a list of sizes applied in order, passed to the loader's `layout(width, height)` after loading; see [Anchors](../docs/SPEC.md#anchors)), `animations` (project animation definitions), `modules` (script sources, each the body of a function that returns `{ create, update }`), `paramDefaults` (`{ script path: { key: default } }`, passed to the loader's `paramDefaults` option; see [Script params](../docs/SPEC.md#script-params)) and `frames` (dump after that many update ticks instead of right after loading). `load-harness.html` is the reference dump.

The load cases use Phaser's own names for the placeholder texture (`__MISSING`) and default frame (`__BASE`), so they target Phaser-based loaders. Pixel output is not part of the suite.

## Running it against the reference toolkit

```
npm install
npm test            # validate, build, then load cases in real Chrome
node run-load.mjs --update   # rewrite the load expectations (review the diff against the spec!)
```

Expected values in `load/` were generated from the reference loader and then read against the spec; they are not independent of it. If a case and the spec disagree, the spec wins and the case is a bug.
