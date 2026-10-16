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
4. [~] Prototype loader and serializer with round-trip tests. Prototype done in `verify/`. A production loader is still to do.
5. [~] Extend the core. Done: code-driven objects with placeholders, seven shapes (`rectangle`, `ellipse`, `triangle`, `line`, `polygon`, `star`, `arc`), `bitmapText` with the `bitmapFont` asset type, `tileSprite`, sprite animations, and filters and masks (all 23 Phaser 4 filter types, checked by `npm run test:filters`). The reference loader implements all of these; placeholders are ignored by it by design.
6. [ ] Reference toolkit, as a thin slice to prove the format is usable before the conformance suite fixes it in place: a runtime loader package (from the prototype), a CLI (`validate`, `build`: registry, stripping, release files), a Vite plugin (scene imports, hot reload) and a small sample game built with them. Packages stay unpublished at 0.x until step 7. Every behavior the tools rely on goes into the spec first.
7. [ ] Conformance examples for other implementations to check against, drawn largely from the toolkit's tests.
8. [ ] First editor integration that exports and imports PHASEFORM, reusing the loader and validator.
9. [ ] Canvas fallback. Phaser 4 still has a Canvas renderer, and a game configured with `Phaser.AUTO` falls back to it when WebGL is unavailable. WebGL stays the normative target, but a loader running under Canvas should degrade instead of failing: build every object, skip the WebGL-only fields (`tint`, `tintMode`, `filters`) with a warning, and promise no pixel accuracy. First run a Canvas probe and the round-trip examples under `Phaser.CANVAS` to see what renders acceptably (core objects, shapes, text, the four blend modes), then write the rule into the spec.

## Naming notes

- **npm:** `phaseform` and `phase-form` are unclaimed as of this draft. A scoped package (such as `@scope/phaseform`) is the likely route.
- **Search:** no existing software or file format called PHASEFORM turned up in web search.
- **Not yet checked:** GitHub organization and repository names, and trademark registries. Do this before public release.
