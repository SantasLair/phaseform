# PHASEFORM

**Phaser Hierarchical Authoring Scene Format**

An open, declarative file format for describing 2D scenes for [Phaser](https://phaser.io) 4.

> Status: **Draft v0.1.** The spec, JSON Schemas and a prototype loader exist. Nothing is stable yet.

## Why

Phaser has no standard way to save a scene as data, so every editor, tool and game invents its own. PHASEFORM is one shared format that any tool can write and any Phaser project can read. It is a format, not a tool.

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
- **Small core, open extensions.** Images, sprites, text and containers are core. Anything else goes in namespaced extensions.
- **Nothing is silently lost.** Tools preserve types and fields they do not understand.
- **Human-readable.** Plain JSON that diffs well in version control.

## How well does it work?

Every claim about Phaser's behavior is checked by running Phaser 4. As a test, 259 official Phaser examples were converted to PHASEFORM and rebuilt: of the 129 that use only core types, 121 rebuild pixel-for-pixel. The rest need object types the core does not have yet, such as tile sprites, or draw from code (graphics). Details are in the [round-trip results](docs/ROUNDTRIP.md).

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
