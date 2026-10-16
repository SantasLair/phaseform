// VS Code custom editor for *.phaseform.json. The document stays the text file: every edit from the webview becomes a
// minimal text edit, so undo, redo, save, diff and source control all work as for any other file.
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { editsFor } = require('./edits');
const { html } = require('./html');

const VIEW_TYPE = 'phaseform.sceneEditor';

// The nearest phaseform.project.json at or above the scene file, or null.
function findProject(sceneFile) {
  let dir = path.dirname(sceneFile);
  for (;;) {
    const p = path.join(dir, 'phaseform.project.json');
    if (fs.existsSync(p)) return p;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

// Problems from the CLI's validator (schema and scene rules). The CLI is an ES module, so it is imported lazily.
let validator;
async function problemsOf(doc) {
  try {
    validator ??= await import('phaseform-cli/project');
    return validator.validateSceneDocument(doc);
  } catch (e) {
    return [];
  }
}

class SceneEditorProvider {
  constructor(context) { this.context = context; }

  async resolveCustomTextEditor(document, panel) {
    const media = vscode.Uri.joinPath(this.context.extensionUri, 'media');
    const projectPath = findProject(document.uri.fsPath);
    const roots = [media, vscode.Uri.file(path.dirname(document.uri.fsPath))];
    if (projectPath) roots.push(vscode.Uri.file(path.dirname(projectPath)));
    panel.webview.options = { enableScripts: true, localResourceRoots: roots };

    const w = panel.webview;
    const uri = (...p) => w.asWebviewUri(vscode.Uri.joinPath(media, ...p)).toString();
    const nonce = Array.from({ length: 24 }, () => Math.random().toString(36)[2]).join('');
    w.html = html({ cspSource: w.cspSource, nonce, uris: { css: uri('editor.css'), phaser: uri('vendor', 'phaser.min.js'), loader: uri('vendor', 'phaseform-load.js'), editor: uri('editor.js') } });

    // the project, with asset files replaced by URLs the webview may load
    const projectForWebview = () => {
      if (!projectPath) return { assets: [], animations: [] };
      try {
        const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
        const root = path.dirname(projectPath);
        const map = (u) => (typeof u === 'string' ? w.asWebviewUri(vscode.Uri.file(path.join(root, u))).toString() : u);
        for (const a of project.assets || []) {
          for (const k of ['url', 'atlasUrl', 'dataUrl']) if (k in a) a[k] = map(a[k]);
          if (Array.isArray(a.urls)) a.urls = a.urls.map(map);
        }
        return project;
      } catch (e) { return { assets: [], animations: [] }; }
    };

    let timer;
    const push = async () => {
      let doc;
      try { doc = JSON.parse(document.getText()); } catch (e) { w.postMessage({ type: 'error', message: 'Not valid JSON: ' + e.message }); return; }
      if (!doc || !Array.isArray(doc.objects) || !doc.size) { w.postMessage({ type: 'error', message: 'Not a PHASEFORM scene (needs size and objects)' }); return; }
      w.postMessage({ type: 'load', doc, project: projectForWebview(), problems: await problemsOf(doc) });
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(push, 60); };

    const apply = async (edits) => {
      if (!edits.length) return;
      const we = new vscode.WorkspaceEdit();
      for (const e of edits) {
        we.replace(document.uri, new vscode.Range(document.positionAt(e.offset), document.positionAt(e.offset + e.length)), e.content);
      }
      await vscode.workspace.applyEdit(we);
    };

    const subs = [
      vscode.workspace.onDidChangeTextDocument((e) => { if (e.document === document) schedule(); }),
      w.onDidReceiveMessage(async (m) => {
        if (m.type === 'ready') { push(); return; }
        let doc;
        try { doc = JSON.parse(document.getText()); } catch (e) { return; }
        const text = document.getText();
        if (m.type === 'set-many') {
          await apply(m.values.flatMap(v => editsFor(text, doc, { type: 'set', id: m.id, path: v.path, value: v.value })));
        } else if (m.type === 'set' || m.type === 'remove') {
          await apply(editsFor(text, doc, m));
        }
      }),
    ];
    if (projectPath) {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(path.dirname(projectPath), 'phaseform.project.json'));
      watcher.onDidChange(schedule);
      subs.push(watcher);
    }
    panel.onDidDispose(() => { clearTimeout(timer); subs.forEach(s => s.dispose()); });
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, new SceneEditorProvider(context), { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('phaseform.openEditor', (uri) => {
      uri ??= vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri;
      if (uri) vscode.commands.executeCommand('vscode.openWith', uri, VIEW_TYPE);
    }),
  );
}

module.exports = { activate, deactivate() {} };
