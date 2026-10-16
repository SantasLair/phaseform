# PHASEFORM Scene Editor (VS Code, draft)

A visual editor for `*.phaseform.json` scene files. The file stays the source of truth: every change you make in the editor is written as a small text edit, so undo, redo, save, diff and source control behave as usual, and comments in the file are kept.

## What it does

- Renders the scene with the reference loader (`packages/loader`) inside a webview, using the assets of the nearest `phaseform.project.json`.
- Click to select (also nested children), drag to move (container-local coordinates), arrow keys nudge by 1 (Shift: 10), Delete removes.
- Hierarchy list, and a properties panel for name, position, rotation, alpha, scale, size, text, key, depth and visibility.
- Validates the scene with `phaseform-cli` and shows the first problem in the top bar.
- Editing the JSON text, or the project file, updates the canvas.

Not yet: adding objects, reordering, origin and tint fields, shape fill and stroke, filters, a script/params editor, selecting code-driven (Graphics) objects on the canvas (use the list), resize handles and rotation handles.

## Try it

```
npm install
npm run build        # copies Phaser and the loader into media/vendor
npm test             # edit helpers + the webview driven in headless Chrome
```

Then open this folder in VS Code and press F5 ("Run PHASEFORM extension"; it opens `samples/coin-run`). Right-click a scene file tab or run **PHASEFORM: Open Scene in Visual Editor**. The editor is an option, not the default, so JSON files still open as text.

The extension host code (`src/extension.js`) is not covered by automated tests; the webview and the edit logic are.
