// Vite plugin: `import { project, scenes, scripts } from 'virtual:phaseform'`.
//   project  the project document, with every asset file replaced by the URL Vite serves (hashed in a build)
//   scenes   { sceneKey: scene document } (placeholders stripped in a build, kept in dev for the editor round trip)
//   scripts  the script registry: { 'scripts/x.js': module }, generated so the bundler can see every script
// Editing the project, a scene or a script file reloads the page.
import { resolve, dirname, join, sep } from 'node:path';
import { validateProject, scriptPaths, assetFiles, stripScene } from 'phaseform-cli/project';

const ID = 'virtual:phaseform';
const RESOLVED = '\0' + ID;
const posix = (p) => p.split(sep).join('/');

export default function phaseform(options = {}) {
  const projectPath = resolve(options.project ?? 'phaseform.project.json');
  const root = dirname(projectPath);
  let isBuild = false;
  let watched = new Set();

  return {
    name: 'phaseform',
    configResolved(config) { isBuild = config.command === 'build'; },
    resolveId(id) { return id === ID ? RESOLVED : null; },
    load(id) {
      if (id !== RESOLVED) return null;
      const r = validateProject(projectPath);
      if (r.errors.length) this.error(`PHASEFORM project is invalid:\n${r.errors.join('\n')}`);
      for (const w of r.warnings) this.warn(w);

      const scripts = scriptPaths(r.scenes);
      const files = assetFiles(r.project);
      watched = new Set([projectPath, ...r.scenes.map(s => join(root, s.entry.path)), ...scripts.map(s => join(root, s))]);
      for (const f of watched) this.addWatchFile(f);

      // each asset file becomes an import, so Vite emits it (and hashes the name in a build)
      const project = JSON.parse(JSON.stringify(r.project));
      const urlVars = new Map(files.map((f, i) => [f, `a${i}`]));
      const swap = (v) => (typeof v === 'string' && urlVars.has(v) ? '__PF_' + urlVars.get(v) + '__' : v);
      for (const a of project.assets) {
        for (const k of ['url', 'atlasUrl', 'dataUrl']) if (k in a) a[k] = swap(a[k]);
        if (Array.isArray(a.urls)) a.urls = a.urls.map(swap);
      }
      const unquote = (json) => json.replace(/"__PF_(a[0-9]+)__"/g, '$1');

      const lines = [
        ...files.map((f, i) => `import a${i} from ${JSON.stringify(posix(join(root, f)) + '?url')};`),
        ...scripts.map((s, i) => `import * as s${i} from ${JSON.stringify(posix(join(root, s)))};`),
        `export const project = ${unquote(JSON.stringify(project))};`,
        `export const scenes = ${JSON.stringify(Object.fromEntries(r.scenes.map(s => [s.entry.key, isBuild ? stripScene(s.doc) : s.doc])))};`,
        `export const scripts = { ${scripts.map((s, i) => `${JSON.stringify(s)}: s${i}`).join(', ')} };`,
        `export default { project, scenes, scripts };`,
      ];
      return lines.join('\n');
    },
    handleHotUpdate({ file, server }) {
      if (!watched.has(file)) return;
      const mod = server.moduleGraph.getModuleById(RESOLVED);
      if (mod) server.moduleGraph.invalidateModule(mod);
      server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}
