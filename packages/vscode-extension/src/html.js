// The webview page. `uris` maps names to the URLs the page loads (a webview URI in VS Code, a file URL in the test).
function html({ cspSource, nonce, uris }) {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data: blob:; media-src ${cspSource}; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval'; connect-src ${cspSource} blob: data:; worker-src blob:;">
<link rel="stylesheet" href="${uris.css}">
<title>PHASEFORM Scene</title></head>
<body>
<div id="bar"><button id="zoom-out" title="Zoom out">-</button><span id="zoom-label">100%</span><button id="zoom-in" title="Zoom in">+</button><button id="zoom-fit">Fit</button><span id="status"></span></div>
<div id="tree"></div>
<div id="stage-wrap"><div id="stage"></div></div>
<div id="props"></div>
<script nonce="${nonce}" src="${uris.phaser}"></script>
<script nonce="${nonce}" src="${uris.loader}"></script>
<script nonce="${nonce}" src="${uris.editor}"></script>
</body></html>`;
}
module.exports = { html };
