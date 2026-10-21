# PHASEFORM

**Phaser Hierarchical Authoring Scene Format**

An open, declarative file format for describing 2D scenes for [Phaser](https://phaser.io) 4.

> Status: **Draft v0.1.** The spec, JSON Schemas, a reference toolkit (loader, CLI, Vite plugin), a sample game and a conformance suite exist. The packages are not published yet. Nothing is stable.

## Why

Phaser has no standard way to save a scene as data, so every editor, tool and game invents its own. PHASEFORM is one shared format that any tool can write and any Phaser project can read. It is a format, not a tool. The project also provides a small reference toolkit (a runtime loader, a build CLI and a Vite plugin, all at 0.0.1 and unpublished) so the format is easy to adopt, but the spec, not the toolkit, defines the format.

## What it looks like

```json
{
  "format": "phaseform",
  "version": "0.1.0",
  "key": "Main",
  "size": { "width": 800, "height": 600 },
  "background": "#0d0d0d",
  "objects": [
    { "id": "player", "type": "sprite", "key": "hero", "x": 120, "y": 400, "depth": 10 },
    {
      "id": "hud",
      "type": "container",
      "children": [
        { "id": "score", "type": "text", "text": "Score: 0", "x": 16, "y": 16 }
      ]
    }
  ]
}
```

Scenes refer to assets by key. A separate project file lists the scenes and maps keys to files.

## Principles

- **Data only.** No code in the file. Behavior is referenced by script path.
- **Maps directly to Phaser.** Each object is a Phaser game object type, with no invented concepts.
- **Small core, open extensions.** Images, sprites, text, containers, shapes, and Phaser 4 filters and masks are core. Anything else goes in namespaced extensions.
- **Nothing is silently lost.** Tools preserve types and fields they do not understand.
- **Human-readable.** Plain JSON that diffs well in version control.

## How well does it work?

Every claim about Phaser's behavior is checked by running Phaser 4. As a test, 259 official Phaser examples were converted to PHASEFORM and rebuilt: of the 143 that use only core types, 138 rebuild pixel-for-pixel. The rest need object types the core does not have yet, such as dynamic bitmap text, or draw from code (graphics). Details are in the [round-trip results](docs/ROUNDTRIP.md).

## Is it for you?

**Useful if** you build a Phaser 4 scene editor, level tool, asset pipeline or exporter, or a game that loads levels as data, and you would rather share a format than invent one.

**Not useful if** you target Phaser 3 or design for the Canvas renderer: PHASEFORM targets Phaser 4 with WebGL. A graceful Canvas fallback, for games that drop to Canvas when WebGL is unavailable, is planned but not started. **Not yet useful if** you need tilemaps or particles. Physics is left to [extensions](docs/SPEC.md#extensions).

| | Now | Planned |
|---|---|---|
| **Covers** | Images, sprites, text, containers, bitmap text, tile sprites, 7 shapes, filters and masks, sprite animations, scripts, project and asset manifest | Under consideration, not yet scheduled: tilemaps, video, dynamic bitmap text, particles, prefabs |
| **You get** | Spec, JSON Schemas, examples, reference loader (`packages/loader`), build CLI (`packages/cli`), Vite plugin (`packages/vite-plugin`), sample game (`samples/coin-run`), conformance suite (`conformance/`), test tools | Packages published to npm; more conformance cases (bitmap text, remaining shape and filter details); a Canvas fallback |
| **Stability** | Draft v0.1: fields may still change | Stable once the conformance suite has been checked by an implementation other than the reference loader; semver after that |
| **Integrating** | Write and read plain JSON; validate with the schemas; load scenes with the loader from a local checkout; build with the CLI or Vite plugin | Install the same packages from npm |

**What it costs you:** the format adds no runtime concepts beyond Phaser's own objects. Your tool keeps its own editor state in a separate sidecar file, and passes through any fields it does not understand.

The detailed plan and open questions are in [docs/ROADMAP.md](docs/ROADMAP.md).

## Documentation

| Document | Contents |
|---|---|
| [docs/SPEC.md](docs/SPEC.md) | The scene specification: fields, defaults, draw order, extensions, conformance |
| [docs/PROJECT.md](docs/PROJECT.md) | The project file: scene list and asset manifest |
| [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) | For tool makers: what to read, what a writing tool must do, a tested starter example |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Open questions and what comes next |
| [docs/VERIFICATION.md](docs/VERIFICATION.md) | Phaser behavior confirmed by tests |
| [docs/SURVEY.md](docs/SURVEY.md) | How much of Phaser's examples the core covers |
| [docs/ROUNDTRIP.md](docs/ROUNDTRIP.md) | Round-trip test results on Phaser's examples |

Schemas are [phaseform.schema.json](phaseform.schema.json), [phaseform.project.schema.json](phaseform.project.schema.json) and, for a script's params sidecar, [phaseform.script-params.schema.json](phaseform.script-params.schema.json). Examples are in [examples/](examples/). The reference toolkit is in [packages/](packages/), the sample game in [samples/coin-run](samples/coin-run), the conformance suite in [conformance/](conformance/), and the Phaser-behavior test tools in [verify/](verify/).

## License

- **Code, schemas and examples:** [Apache License 2.0](LICENSE).
- **Specification text:** [Creative Commons Attribution 4.0 International](LICENSE-SPEC).

The name PHASEFORM is not covered by either license. How you may use it, such as saying your tool "supports PHASEFORM", is in [TRADEMARKS.md](TRADEMARKS.md).
