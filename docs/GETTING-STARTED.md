# Getting started for tool makers

This is a short guide for anyone writing software that reads or writes PHASEFORM: an editor, a converter, a generator, a script, or an AI agent. It tells you what to read, what you must get right, and how to check your work. It links to the specification instead of repeating it. If this guide and the spec disagree, the spec wins.

## Pick your role

| You are building | You mostly need | Start with |
|---|---|---|
| A tool that **writes** scenes (editor, converter, generator, agent) | The rules in [What every writing tool must do](#what-every-writing-tool-must-do), plus the project file | [SPEC.md](SPEC.md), [PROJECT.md](PROJECT.md) |
| A tool that **reads** scenes (viewer, checker, exporter) | Validation, the preserve rule, and the defaults for omitted fields | [SPEC.md](SPEC.md#objects), the schemas |
| A **loader** for another engine or another way of running Phaser | The behaviour Phaser leaves unstated, and the conformance suite | [VERIFICATION.md](VERIFICATION.md), [conformance/](../conformance/README.md) |

Everyone should read the spec's [Scope](SPEC.md#scope) and [Conventions](SPEC.md#conventions) sections first. They take a few minutes and explain what PHASEFORM deliberately leaves out.

## The two files

- A **scene file** (`*.phaseform.json`) describes one scene: a `key`, a design `size`, and a list of `objects`. It refers to assets only by key. See [SPEC.md](SPEC.md#scene-document).
- A **project file** (`phaseform.project.json`) lists the scenes, names the one that starts first, and maps asset keys to files. See [PROJECT.md](PROJECT.md).

Both have JSON Schemas at the repository root: [phaseform.schema.json](../phaseform.schema.json) and [phaseform.project.schema.json](../phaseform.project.schema.json). JSON is the canonical encoding. Whitespace and key order carry no meaning.

## A first tool in five minutes

The files in [examples/tool-quickstart/](../examples/tool-quickstart/) are a complete, tested starting point. They need only Node.js.

```
node examples/tool-quickstart/write-scene.mjs my-game
node packages/cli/bin/phaseform.mjs validate my-game/phaseform.project.json
```

The first command writes a project with one scene (a title, a panel and a score label, no assets). The second checks it against both schemas and the rules the schemas cannot express. It should print `valid (0 warning(s))`. The CLI is part of this repository's reference toolkit; run `npm install` in `packages/cli` first.

The core of the writer is a plain object that follows the spec, written as JSON:

```js
const scene = {
  format: 'phaseform', version: '0.1.0', key: 'Main',
  size: { width: 800, height: 600 },
  objects: [
    { id: 'title', type: 'text', text: 'My Game', x: 400, y: 40, anchor: { x: 'center' } },
  ],
};
writeFileSync('scenes/main.phaseform.json', JSON.stringify(scene, null, 2) + '\n');
```

To change an existing file, use [edit-scene.mjs](../examples/tool-quickstart/edit-scene.mjs):

```
node examples/tool-quickstart/edit-scene.mjs my-game/scenes/main.phaseform.json panel 100 200
```

It parses the file, changes one object's position, and writes it back. Anything it does not understand (unknown fields, unknown object types, extension data) goes back out unchanged, because it never converts the document into a narrower model. That is the single most important habit for a tool that edits other people's files.

To see the scene run in a game, read [samples/coin-run/main.js](../samples/coin-run/main.js): about 20 lines that preload the project's assets and call the loader's `build` for each scene.

## What every writing tool must do

These are rules from the spec ([Conformance](SPEC.md#conformance), [Conventions](SPEC.md#conventions), [Extensions](SPEC.md#extensions) and [PROJECT.md](PROJECT.md)):

1. **Validate before you trust a file, and before you write one.** Check the schema, then the rules it cannot express: unique ids within a scene, valid frames, and for projects the rules in [PROJECT.md](PROJECT.md#rules). The CLI's `validate` does both.
2. **Preserve what you do not understand.** Unknown object types, unknown fields and `extensions` data must survive a load and save. A future version of PHASEFORM, or another tool, may have put them there.
3. **Keep ids stable.** An id is unique within its scene and should not change across saves. Give an object a `name` if game code looks it up by name.
4. **Write paths relative to the project root, with forward slashes**, in both the project file and `url` fields.
5. **Keep the scene key and the project entry in step.** A scene's `key` must equal its entry's `key` in the project file.
6. **Keep editor state out of scene files.** Camera position, selection, locks and panel layout belong in a separate sidecar file, not in the document or in `extensions`. The one editor-related field in the core is `placeholder`, which a loader never draws; keep it when saving.
7. **If you read files, check `version`.** Refuse a file with a higher major version than you support, and warn on a higher minor version.

## Habits that make your tool pleasant to use

These are not requirements, but they follow from the format's goal of being readable and diffable in version control:

- Write two-space indented JSON with a final newline.
- Keep key order stable from one save to the next, even though it carries no meaning.
- Do not rewrite a file that did not change.
- Write scenes so two writers (you and a person with a text editor, or an AI agent) can take turns: reload when the file changes on disk, and never save over a change you have not seen.

## Things that are easy to get wrong

- **Draw order has two levels.** At the scene root, objects draw by `depth`, then by position in the list. Inside a container, only the order of `children` counts and a child's `depth` is ignored. See [Draw order](SPEC.md#draw-order).
- **Containers are not images.** They have no `origin`, `flipX`, `flipY`, `tint` or size. Phaser fixes those.
- **Shapes need a fill or a stroke to be seen.** A shape with neither is valid and invisible. A `line` is the exception: it requires `stroke` and does not allow `fill`. See [Shapes](SPEC.md#shapes).
- **Missing frames fail silently in Phaser.** It warns and falls back to the default frame, so a loader or validator has to check frames itself.
- **Texture keys share one namespace.** Images, spritesheets, atlases and bitmap fonts must not reuse each other's keys.
- **`size` is a design size.** It is the size the layout was authored at. In a game whose size follows its window, an object can follow an edge or the centre with `anchor` (root objects only). `x` and `y` are always the position at the design size. See [Anchors](SPEC.md#anchors).
- **Computed positions are not data.** PHASEFORM describes what is placed, not the code that decides where. A tool that converts an existing game should leave computed layout in code and move only literal placements.

## Prove it works

The [conformance suite](../conformance/README.md) is made for this. It has three parts, and you claim only the ones you implement:

- `validate`: accepts and rejects the example files as the schemas and rules say.
- `build`: a release build ([PROJECT.md](PROJECT.md#release-builds)).
- `load`: a loader creates the objects the spec describes, for Phaser-based loaders.

Report which parts you pass. See the [Conformance](SPEC.md#conformance) section for how to state a claim.

## Proposing a change

New behaviour goes into the spec before any tool relies on it, with examples and conformance cases. If your tool needs something PHASEFORM cannot express, open an issue describing the case. A new optional field is a minor change; see [Versioning](SPEC.md#versioning). The rules for contributing are in [CONTRIBUTING.md](../CONTRIBUTING.md).
