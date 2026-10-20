# Roadmap and open questions

## Open questions

1. **Graphics.** Decided: no draw commands in the spec. `graphics` is a host for scripts, with an editor-only placeholder, see [SPEC.md](SPEC.md#scripts-and-code-driven-objects). Static drawings may come back as a declarative `shapes` type.
2. **More object types.** Left out of v0.1: `DynamicBitmapText` (13 examples), the shapes `grid`, `isobox`, `isotriangle` and `curve` (a curve needs a data format for Phaser curve objects), `blitter` and particle emitters.
3. **Sprite animations.** Done: definitions in the project, `animation` on `sprite` with `startFrame`. Open: play-time overrides (`timeScale`, per-play `repeat`), sprite-local animations, animations on other types.
4. **Text fields outside the style config.** `lineSpacing` is covered as `style.lineSpacing`. Gradient colors and word-wrap callbacks are code, not data, and stay out.
5. **Masks and filters.** Done: `filters` with `internal` and `external` lists, 23 filter types including `mask` and `parallel`, see [SPEC.md](SPEC.md#filters-and-masks). Raised in priority because live filter editing is a strong editor feature. Open: whether to expose Phaser's `filtersFocusContext` and `focusFiltersOverride` (the filter area of containers, graphics and shapes), `paddingOverride`, a mask's `viewCamera`, filters on cameras, the `sampler` filter (a callback), an id lookup for scripts, and the follow-ups in [VERIFICATION.md](VERIFICATION.md) items 30 and 32.
6. **Script loading.** Settled: loaders resolve script paths through a script registry that a build generates, see [PROJECT.md](PROJECT.md#release-builds). Open: whether hooks may be async.
7. **Asset types beyond the five core types** in [PROJECT.md](PROJECT.md): tilemaps, video, atlas-based bitmap fonts.
8. **Shared children.** Non-exclusive containers can hold the same object in several containers, which a tree cannot represent.
9. **Open verification items:** see the follow-ups in [VERIFICATION.md](VERIFICATION.md).

## Roadmap

Legend: `[x]` done, `[~]` partial, `[ ]` not started.

1. [~] Core types and conventions for v0.1. Settled, pending the questions above.
2. [x] Project and asset manifest spec: [PROJECT.md](PROJECT.md).
3. [~] JSON Schemas for v0.1. Drafted. `npm run validate` in `verify/` checks the examples.
4. [x] Loader and serializer with round-trip tests. The prototype in `verify/` does the round-trips; the production loader is `packages/loader` (0.0.1, unpublished), checked by the conformance suite and the sample game.
5. [~] Extend the core. Done: code-driven objects with placeholders, seven shapes (`rectangle`, `ellipse`, `triangle`, `line`, `polygon`, `star`, `arc`), `bitmapText` with the `bitmapFont` asset type, `tileSprite`, sprite animations, and filters and masks (all 23 Phaser 4 filter types, checked by `npm run test:filters`). The reference loader implements all of these; placeholders are ignored by it by design.
6. [x] Reference toolkit, a thin slice to prove the format is usable before the conformance suite fixes it in place: `packages/loader` (runtime loader), `packages/cli` (`validate`, `build`), `packages/vite-plugin` (`virtual:phaseform`, reload on edit) and the sample game `samples/coin-run`. Packages stay unpublished at 0.x until step 7. Every behavior the tools rely on goes into the spec first. Not yet checked: the plugin's dev-server reload (only its build is tested).
7. [x] Conformance examples for other implementations to check against, drawn largely from the toolkit's tests. Load cases cover core objects, containers, shapes, tile sprites, animations, scripts and filters; still to add: bitmap text and the remaining shape and filter details. SPEC.md says how to claim conformance. Phaser-based loaders only for now.
8. [~] First editor integration that exports and imports PHASEFORM, reusing the loader and validator. In progress, as a separate project outside this repository (a VS Code custom editor that consumes `phaseform-loader` and `phaseform-cli`). The format repository keeps only the spec, the schemas and the reference toolkit.
9. [ ] Canvas fallback. Phaser 4 still has a Canvas renderer, and a game configured with `Phaser.AUTO` falls back to it when WebGL is unavailable. WebGL stays the normative target, but a loader running under Canvas should degrade instead of failing: build every object, skip the WebGL-only fields (`tint`, `tintMode`, `filters`) with a warning, and promise no pixel accuracy. First run a Canvas probe and the round-trip examples under `Phaser.CANVAS` to see what renders acceptably (core objects, shapes, text, the four blend modes), then write the rule into the spec.

10. [ ] Agent skill. Ship a skill (a short guide in the Claude Code skill format) with the format, so coding agents write valid scenes that follow the conventions. The format repository is the right home, not an editor, because every tool and agent needs the same rules and an editor extension cannot distribute skills. Packaging it as a Claude Code plugin is optional. It would cover:
    - The rules that are easy to get wrong: objects at the same depth draw in list order, children of a container ignore `depth`, and a `line` needs `stroke` and, in practice, an explicit `origin`.
    - The workflow: edit the JSON, run `phaseform validate`, then run the game and look at it. Agents edit the files, and an open visual editor redraws from the file on every change.
    - The conventions: stable ids, a `name` on any object that game code looks up by name or id, scripts attached by path, and a generator script that rewrites one section of a scene when it contains many repeated objects (such as a 9x9 board). Never hand-edit a generated section.
    - A short pointer to the spec sections, not a copy of them, so the skill does not drift from the spec.

    Written from real use: a real game project built on PHASEFORM hit each of the points above. Open: whether a small MCP server is also worth building. It would offer `validate` with structured results, a headless render of a scene to PNG, and an object tree with world positions. These are the checks an agent cannot cheaply do from a shell. Editing stays plain JSON. See item 8 for the editor.

11. [x] Anchors (draft v0.1): an optional `anchor` on root objects. A scene's `size` is the design size, `x` and `y` stay the position at that size, and `anchor` names the edges an object follows when the game size differs. The reference loader returns `layout(width, height)` from `build`, and the conformance suite has load cases for it. Open: stretching an object to fill the screen, and anchors on container children (they follow their container today).

## Parked ideas

Not planned. Kept here with the evidence, in case a real need appears.

- **Binary encoding.** If a game ever has a level size or load time problem that HTTP compression does not fix (most likely once tilemaps arrive), a release build could write the same document in CBOR ([RFC 8949](https://www.rfc-editor.org/rfc/rfc8949)): a standard, compact encoding with tagged typed arrays for numeric data. Because the document is the data model (see [SPEC.md](SPEC.md#scope)), this would be a mechanical translation with no new meaning. Measured on 2026-10-16: after Brotli, CBOR and MessagePack were about 10% smaller than JSON (7.4 KB against 8.2 KB for 5,000 sprites) but need a decoder of about 11 KB gzipped, while BSON was larger than JSON both raw and compressed.

## Naming notes

- **npm:** `phaseform` and `phase-form` are unclaimed as of this draft. A scoped package (such as `@scope/phaseform`) is the likely route.
- **Search:** no existing software or file format called PHASEFORM turned up in web search.
- **Not yet checked:** GitHub organization and repository names, and trademark registries. Do this before public release.
