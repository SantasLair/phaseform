# Roadmap and open questions

## Open questions

1. **Graphics commands.** Phaser's `Graphics` keeps a command buffer with a full draw API. Design a `commands` representation. It blocks 84 of the 259 surveyed examples.
2. **More object types.** `bitmapText` (41 examples), `tileSprite` (14) and shapes (about 20) are the next candidates. Shapes could be one `shape` type or several.
3. **Sprite animations.** A definition in the project manifest and a field on `sprite` to choose one.
4. **Text fields outside the style config.** `lineSpacing`, gradient colors and word-wrap callbacks have no representation.
5. **Masks and filters.** Out of scope for v0.1, but they appear in real scenes.
6. **Script contract.** How a script path is invoked and what it receives.
7. **Asset types beyond the four core types** in [PROJECT.md](PROJECT.md): bitmap fonts, tilemaps, video.
8. **Shared children.** Non-exclusive containers can hold the same object in several containers, which a tree cannot represent.
9. **Open verification items:** see the follow-ups in [VERIFICATION.md](VERIFICATION.md).

## Roadmap

1. ~~Core types and conventions for v0.1.~~ Done, pending the questions above.
2. ~~Project and asset manifest spec.~~ Done: [PROJECT.md](PROJECT.md).
3. ~~JSON Schemas for v0.1.~~ Drafted. `npm run validate` in `verify/` checks the examples.
4. ~~Prototype loader and serializer with round-trip tests.~~ Done in `verify/`. A production loader is still to do.
5. Extend the core using the survey results, starting with graphics commands.
6. Conformance examples for other editors to check against.
7. First implementation: an editor that exports and imports PHASEFORM.

## Naming notes

- **npm:** `phaseform` and `phase-form` are unclaimed as of this draft. A scoped package (such as `@scope/phaseform`) is the likely route.
- **Search:** no existing software or file format called PHASEFORM turned up in web search.
- **Not yet checked:** GitHub organization and repository names, and trademark registries. Do this before public release.
