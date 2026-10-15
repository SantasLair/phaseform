// Local static server for running Phaser examples against the local Phaser 4 build.
// Serves the examples' public folder, /__phaser.js, helper scripts at /__tools/<name>, and a wrapper page at /__run?src=<path>.
// The wrapper captures the Phaser.Game instance as window.__game (Phaser 4 has no Phaser.GAMES list).
import http from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve, extname, sep, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.xml': 'text/xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.glsl': 'text/plain', '.frag': 'text/plain', '.vert': 'text/plain', '.txt': 'text/plain', '.csv': 'text/csv' };

/** @param {string} publicDir examples' public folder. @param {string[]} tools script files in this folder to inject after Phaser. */
export async function startServer(publicDir, tools = []) {
  publicDir = resolve(publicDir);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/__phaser.js') {
      res.setHeader('content-type', 'text/javascript');
      return res.end(readFileSync(join(here, 'node_modules/phaser/dist/phaser.min.js')));
    }
    if (url.pathname.startsWith('/__tools/')) {
      const name = basename(url.pathname);
      if (!tools.includes(name)) { res.statusCode = 404; return res.end('not found'); }
      res.setHeader('content-type', 'text/javascript');
      return res.end(readFileSync(join(here, name)));
    }
    if (url.pathname === '/__run') {
      const src = url.searchParams.get('src');
      const toolTags = tools.map(t => `<script src="/__tools/${t}"></script>`).join('');
      res.setHeader('content-type', 'text/html');
      return res.end(`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><div id="phaser-example"></div><script src="/__phaser.js"></script>${toolTags}<script>(function(){var G=Phaser.Game;Phaser.Game=class extends G{constructor(c){super(c);window.__game=this;}};})();</script><script src="/${src.split('/').map(encodeURIComponent).join('/')}"></script>`);
    }
    const file = resolve(publicDir, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(publicDir + sep) || !existsSync(file) || !statSync(file).isFile()) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('content-type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream');
    res.end(readFileSync(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}
