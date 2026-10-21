# Contributing

PHASEFORM is a draft scene format for Phaser 4 plus a small reference toolkit. Issues and pull requests are welcome.

## Layout

- `phaseform.schema.json`, `phaseform.project.schema.json`, `phaseform.script-params.schema.json`: the JSON Schemas.
- `docs/`: the specification (`SPEC.md`, `PROJECT.md`) and design notes.
- `examples/`: valid and invalid example documents.
- `conformance/`: tests other implementations can run against.
- `packages/loader`, `packages/cli`, `packages/vite-plugin`: the reference toolkit (unpublished, 0.x).
- `samples/coin-run`: a small sample game.
- `verify/`: harnesses that check Phaser behaviour the spec relies on.

## Running tests

Run `npm ci` (or `npm install`) in each folder first. Browser tests need Google Chrome installed.

| What | Command |
| --- | --- |
| Schemas and examples | `cd verify && npm run validate` |
| CLI | `cd packages/cli && npm test` |
| Vite plugin | `cd packages/vite-plugin && npm test` |
| Conformance suite | `cd conformance && npm test` |
| Sample game | `cd samples/coin-run && npm run build && npm test` |
| Phaser behaviour checks | `cd verify && npm run verify` (also `test:scripts`, `test:filters`) |

## Spec first

New behaviour goes into the specification (`docs/SPEC.md` or `docs/PROJECT.md`) before any tool relies on it. Add or update examples and conformance cases with it.

## Licensing

Code contributions are licensed under Apache-2.0 (`LICENSE`). Contributions to the specification and documentation are licensed under CC BY 4.0 (`LICENSE-SPEC`). By submitting a contribution you agree to these terms.
