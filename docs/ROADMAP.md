# Roadmap and open questions

## Open questions

1. **Graphics.** Decided: no draw commands in the spec. `graphics` is a host for scripts, with an editor-only placeholder, see [SPEC.md](SPEC.md#scripts-and-code-driven-objects). Static drawings may come back as a declarative `shapes` type.
2. **More object types.** Left out of v0.1: `DynamicBitmapText` (13 examples), the shapes `grid`, `isobox`, `isotriangle` and `curve` (a curve needs a data format for Phaser curve objects), `blitter` and particle emitters.
3. **Sprite animations.** Done: definitions in the project, `animation` on `sprite` with `startFrame`. Open: play-time overrides (`timeScale`, per-play `repeat`), sprite-local animations, animations on other types.
4. **Text fields outside the style config.** `lineSpacing` is covered as `style.lineSpacing`. Gradient colors and word-wrap callbacks are code, not data, and stay out.
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
5. [~] Extend the core. Done: code-driven objects with placeholders, seven shapes (`rectangle`, `ellipse`, `triangle`, `line`, `polygon`, `star`, `arc`), `bitmapText` with the `bitmapFont` asset type, `tileSprite`, and sprite animations. Next: masks and filters. The reference loader implements all of these; placeholders are ignored by it by design.
6. [ ] Conformance examples for other editors to check against.
7. [ ] First implementation: an editor that exports and imports PHASEFORM.

## Naming notes

- **npm:** `phaseform` and `phase-form` are unclaimed as of this draft. A scoped package (such as `@scope/phaseform`) is the likely route.
- **Search:** no existing software or file format called PHASEFORM turned up in web search.
- **Not yet checked:** GitHub organization and repository names, and trademark registries. Do this before public release.
