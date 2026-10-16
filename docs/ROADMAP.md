# Roadmap and open questions

## Open questions

1. **Graphics.** Decided: no draw commands in the spec. `graphics` is a host for scripts, with an editor-only placeholder, see [SPEC.md](SPEC.md#scripts-and-code-driven-objects). Static drawings may come back as a declarative `shapes` type.
2. **More object types.** Left out of v0.1: `DynamicBitmapText` (13 examples), the shapes `grid`, `isobox`, `isotriangle` and `curve` (a curve needs a data format for Phaser curve objects), `blitter` and particle emitters.
3. **Sprite animations.** A definition in the project manifest and a field on `sprite` to choose one.
4. **Text fields outside the style config.** `lineSpacing`, gradient colors and word-wrap callbacks have no representation.
5. **Masks and filters.** Out of scope for v0.1, but they appear in real scenes.
6. **Script loading.** The hooks and `ctx` are defined. How a module is loaded and bundled is not, and neither is whether hooks may be async.
7. **Asset types beyond the five core types** in [PROJECT.md](PROJECT.md): tilemaps, video, atlas-based bitmap fonts.
8. **Shared children.** Non-exclusive containers can hold the same object in several containers, which a tree cannot represent.
9. **Open verification items:** see the follow-ups in [VERIFICATION.md](VERIFICATION.md).

## Roadmap

Legend: `[x]` done, `[~]` partial, `[ ]` not started.

1. [~] Core types and conventions for v0.1. Settled, pending the questions above.
2. [x] Project and asset manifest spec: [PROJECT.md](PROJECT.md).
3. [~] JSON Schemas for v0.1. Drafted. `npm run validate` in `verify/` checks the examples.
4. [~] Prototype loader and serializer with round-trip tests. Prototype done in `verify/`. A production loader is still to do.
5. [~] Extend the core. Done: code-driven objects with placeholders, seven shapes (`rectangle`, `ellipse`, `triangle`, `line`, `polygon`, `star`, `arc`), `bitmapText` with the `bitmapFont` asset type, and `tileSprite`. Next: sprite animations, then the remaining types listed under open question 2. The reference loader implements scripts, shapes, bitmap text and tile sprites; placeholders are ignored by it by design.
6. [ ] Conformance examples for other editors to check against.
7. [ ] First implementation: an editor that exports and imports PHASEFORM.

## Naming notes

- **npm:** `phaseform` and `phase-form` are unclaimed as of this draft. A scoped package (such as `@scope/phaseform`) is the likely route.
- **Search:** no existing software or file format called PHASEFORM turned up in web search.
- **Not yet checked:** GitHub organization and repository names, and trademark registries. Do this before public release.
