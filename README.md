# PHASEFORM

**Phaser Hierarchical Authoring Scene Format**

An open, declarative file format for describing 2D scenes for [Phaser](https://phaser.io) 4.

> Status: **Draft v0.1.** The spec, JSON Schemas and a prototype loader exist. Nothing is stable yet.

## Why

Phaser has no standard way to save a scene as data, so every editor, tool and game invents its own. PHASEFORM is one shared format that any tool can write and any Phaser project can read. It is a format, not a tool. The project will also provide a small reference toolkit (a runtime loader, a build CLI and a Vite plugin) so the format is easy to adopt, but the spec, not the toolkit, defines the format.

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

**Not useful if** you target Phaser 3 or the Canvas renderer: PHASEFORM is Phaser 4 and WebGL only, by design. **Not yet useful if** you need tilemaps or particles. Physics is left to [extensions](docs/SPEC.md#extensions).

| | Now | Planned |
|---|---|---|
| **Covers** | Images, sprites, text, containers, bitmap text, tile sprites, 7 shapes, filters and masks, sprite animations, scripts, project and asset manifest | Under consideration, not yet scheduled: tilemaps, video, dynamic bitmap text, particles, prefabs |
| **You get** | Spec, JSON Schemas, examples, prototype loader and serializer, test tools | Loader package, build CLI, Vite plugin, sample game, then conformance tests |
| **Stability** | Draft v0.1: fields may still change | Stable once the conformance tests exist; semver after that |
| **Integrating** | Write and read plain JSON; validate with the schemas | Load scenes with the loader package; one build step bundles scripts |

**What it costs you:** the format adds no runtime concepts beyond Phaser's own objects. Your tool keeps its own editor state in a separate sidecar file, and passes through any fields it does not understand.

The detailed plan and open questions are in [docs/ROADMAP.md](docs/ROADMAP.md).

## Documentation

| Document | Contents |
|---|---|
| [docs/SPEC.md](docs/SPEC.md) | The scene specification: fields, defaults, draw order, extensions, conformance |
| [docs/PROJECT.md](docs/PROJECT.md) | The project file: scene list and asset manifest |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Open questions and what comes next |
| [docs/VERIFICATION.md](docs/VERIFICATION.md) | Phaser behavior confirmed by tests |
| [docs/SURVEY.md](docs/SURVEY.md) | How much of Phaser's examples the core covers |
| [docs/ROUNDTRIP.md](docs/ROUNDTRIP.md) | Conformance test results |

Schemas are [phaseform.schema.json](phaseform.schema.json) and [phaseform.project.schema.json](phaseform.project.schema.json). Examples are in [examples/](examples/). The test tools and prototype loader are in [verify/](verify/).

## License

- **Code, schemas and examples:** [Apache License 2.0](LICENSE).
- **Specification text:** [Creative Commons Attribution 4.0 International](LICENSE-SPEC).

The name PHASEFORM is not covered by either license.
