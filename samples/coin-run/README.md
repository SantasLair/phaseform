# Coin Run

A tiny game made only from a PHASEFORM project, used to prove the reference toolkit end to end.

- `phaseform.project.json`, `scenes/`, `assets/`, `scripts/` are the project.
- `main.js` is the whole game code: it loads the assets and builds the scene with `phaseform-loader`.
- `vite.config.mjs` adds `phaseform-vite-plugin`, which serves the project as `virtual:phaseform` and bundles the scripts.

```
npm install
npm run validate   # phaseform validate
npm run dev        # editing the project or a script reloads the page
npm run build && npm test   # renders the build in real Chrome and checks it animates
```
