// Serves an unpacked release ZIP the way the GoLive portal does, for a local test
// before uploading. Used by test-release.cmd; no dependencies beyond Node.
//
//   node Tools/dev/serve-release.mjs <unpacked-zip-folder> [--lan] [--port 4175] [--no-open]
//
// - The game is served at /api/v1/games/grow-an-empire/play/index.html (the portal path).
// - /sdk/platform-sdk.js is a local stand-in SDK: guest login (as on the portal, a guest
//   has no cloud save, so the run is restored from the browser save), and a "cloud"
//   save kept in this browser's localStorage for signed-in testing.
// - http://127.0.0.1:<port>/ is a test page that puts the game in an iframe of a chosen
//   size (1920×1080 portal frame, laptop, phone portrait/landscape, or the whole window).
// - --lan also listens on this computer's network address so a phone on the same Wi-Fi
//   can open it (Windows may ask to allow Node through the firewall).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { exec } from "node:child_process";

const args = process.argv.slice(2);
const root = path.resolve(args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a)) ?? ".tmp/release-test");
const lan = args.includes("--lan");
const open = !args.includes("--no-open");
const portIndex = args.indexOf("--port");
const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 4175;
const PLAY = "/api/v1/games/grow-an-empire/play/";

if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error(`No index.html in ${root}. Unpack the release ZIP there first (test-release.cmd does this).`);
  process.exit(1);
}

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".webp": "image/webp", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff",
  ".ttf": "font/ttf", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json", ".ktx2": "image/ktx2", ".wasm": "application/wasm", ".txt": "text/plain; charset=utf-8",
};

const SDK = `// Stand-in for the GoLive portal SDK (local testing only).
(function () {
  var KEY = "golive-local-test:cloud-save:grow-an-empire";
  var calls = [];
  function log(m, a) { calls.push({ method: m, args: a }); if (m === "track") console.info("[SDK] track", a[0], a[1] || ""); }
  window.__sdkCalls = calls;
  window.Platform = {
    init: function (o) { log("init", [o]); return Promise.resolve(); },
    login: function () { log("login", []); return Promise.resolve({ player: { id: "local-guest", displayName: "Local guest", authType: "guest" } }); },
    getGameProgress: function () { log("getGameProgress", []); try { var raw = localStorage.getItem(KEY); return Promise.resolve({ progress: raw ? JSON.parse(raw) : null }); } catch (e) { return Promise.reject(e); } },
    saveGameProgress: function (d) { log("saveGameProgress", []); try { localStorage.setItem(KEY, JSON.stringify(d)); return Promise.resolve({ ok: true }); } catch (e) { return Promise.reject(e); } },
    submitScore: function () { return Promise.reject(new Error("Local stand-in is a guest; use the registered mock to test scores.")); },
    startSession: function () { log("startSession", []); },
    endSession: function (s) { log("endSession", [s]); },
    track: function (e, p) { log("track", [e, p]); }
  };
})();
`;

const TEST_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Grow an Empire - release test</title>
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; height: 100%; background: #16181c; color: #e8e2d4; font: 14px system-ui, sans-serif; }
  body { display: flex; flex-direction: column; }
  header { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px 12px; background: #22252b; }
  header strong { margin-right: 8px; }
  button { font: inherit; color: inherit; background: #33373f; border: 1px solid #4a4f59; border-radius: 6px; padding: 6px 10px; cursor: pointer; }
  button[aria-pressed="true"] { background: #b8862b; border-color: #e0b04f; color: #16181c; }
  #info { margin-left: auto; opacity: .8; }
  main { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  #wrap { transform-origin: center center; }
  iframe { display: block; border: 0; background: #000; box-shadow: 0 0 0 1px #4a4f59; }
  body.fill header { display: none; }
  body.fill main, body.fill #wrap, body.fill iframe { width: 100%; height: 100%; }
  #back { position: fixed; right: 8px; top: 8px; z-index: 2; display: none; opacity: .75; }
  body.fill #back { display: block; }
</style></head>
<body>
<header>
  <strong>Release test</strong>
  <button data-w="1920" data-h="1080">Portal 1920×1080</button>
  <button data-w="1536" data-h="864">Laptop 1536×864</button>
  <button data-w="1366" data-h="768">Laptop 1366×768</button>
  <button data-w="1280" data-h="720">1280×720</button>
  <button data-w="390" data-h="844">Phone portrait</button>
  <button data-w="844" data-h="390">Phone landscape</button>
  <button data-w="768" data-h="1024">Tablet portrait</button>
  <button data-fill="1">Whole window</button>
  <button id="reset" title="Clears the saved run and the stand-in cloud save">New player</button>
  <span id="info"></span>
</header>
<button id="back">Sizes</button>
<main><div id="wrap"><iframe id="game" title="Grow an Empire" allow="fullscreen; autoplay; gamepad"
  sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms"></iframe></div></main>
<script>
  var PLAY = "${PLAY}index.html";
  var frame = document.getElementById("game"), wrap = document.getElementById("wrap"), info = document.getElementById("info");
  var current = { w: 1920, h: 1080, fill: false };
  function fit() {
    if (current.fill) { wrap.style.transform = ""; info.textContent = ""; return; }
    var main = document.querySelector("main"), s = Math.min(1, (main.clientWidth - 16) / current.w, (main.clientHeight - 16) / current.h);
    wrap.style.transform = "scale(" + s + ")";
    info.textContent = "Frame " + current.w + "×" + current.h + (s < 1 ? " shown at " + Math.round(s * 100) + "% to fit this window (the game still sees " + current.w + "×" + current.h + ")" : "");
  }
  function choose(btn) {
    document.querySelectorAll("header button[data-w], header button[data-fill]").forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
    current = btn.dataset.fill ? { fill: true } : { w: +btn.dataset.w, h: +btn.dataset.h, fill: false };
    document.body.classList.toggle("fill", current.fill);
    frame.style.width = current.fill ? "" : current.w + "px";
    frame.style.height = current.fill ? "" : current.h + "px";
    try { history.replaceState(null, "", "?size=" + (current.fill ? "fill" : current.w + "x" + current.h)); } catch (e) {}
    fit();
  }
  document.querySelectorAll("header button[data-w], header button[data-fill]").forEach(function (b) { b.onclick = function () { choose(b); }; });
  document.getElementById("back").onclick = function () { choose(document.querySelector("button[data-w='1920']")); };
  document.getElementById("reset").onclick = function () {
    try { Object.keys(localStorage).filter(function (k) { return /grow-an-empire/.test(k); }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
    frame.src = PLAY + "?reset";
  };
  addEventListener("resize", fit);
  var q = new URLSearchParams(location.search).get("size");
  var start = q === "fill" ? document.querySelector("button[data-fill]") : document.querySelector("button[data-w][data-h='" + (q ? q.split("x")[1] : 1080) + "'][data-w='" + (q ? q.split("x")[0] : 1920) + "']");
  // Phones opening this page over Wi-Fi get the game at their own screen size.
  if (!q && Math.min(innerWidth, innerHeight) < 600) start = document.querySelector("button[data-fill]");
  choose(start || document.querySelector("button[data-w='1920']"));
  frame.src = PLAY;
</script>
</body></html>
`;

function send(res, status, type, body, extra = {}) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", ...extra });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  let p;
  try { p = decodeURIComponent(url.pathname); } catch { return send(res, 400, "text/plain", "Bad request"); }
  if (p === "/" || p === "/index.html") return send(res, 200, TYPES[".html"], TEST_PAGE);
  if (p === "/sdk/platform-sdk.js") return send(res, 200, TYPES[".js"], SDK);
  if (p === "/favicon.ico") return send(res, 204, "image/x-icon", "");
  if (p === PLAY.slice(0, -1)) return send(res, 301, "text/plain", "", { Location: PLAY });
  if (!p.startsWith(PLAY)) { console.warn(`404 ${p}`); return send(res, 404, "text/plain", "Not found"); }
  let rel = p.slice(PLAY.length) || "index.html";
  const file = path.resolve(root, rel);
  if (!file.startsWith(root + path.sep) && file !== root) return send(res, 403, "text/plain", "Forbidden");
  if (rel === "index.html") {
    // Local QA only: avoid contacting the production portal. The ZIP itself
    // retains the official SDK URL required for submission.
    fs.readFile(file, "utf8", (error, html) => {
      if (error) {
        console.warn(`Read failed for ${p}: ${error.message}`);
        return send(res, 500, "text/plain", "Could not read the game entry point");
      }
      send(res, 200, TYPES[".html"], html.replace("https://golive-platform.netlify.app/sdk/platform-sdk.js", "/sdk/platform-sdk.js"));
    });
    return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { console.warn(`404 ${p}  <- missing from the ZIP`); return send(res, 404, "text/plain", "Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-store" });
    fs.createReadStream(file)
      .on("error", (error) => { console.warn(`Read failed for ${p}: ${error.message}`); res.destroy(error); })
      .pipe(res);
  });
});

const host = lan ? "0.0.0.0" : "127.0.0.1";
server.on("error", (e) => {
  if (e.code === "EADDRINUSE") console.error(`Port ${port} is busy. Close the other test window, or run with --port 4176.`);
  else console.error(e);
  process.exit(1);
});
server.listen(port, host, () => {
  const local = `http://127.0.0.1:${port}/`;
  console.log(`\nServing ${root}`);
  console.log(`Test page (sizes, portal frame): ${local}`);
  console.log(`Game alone at the portal path:  ${local}${PLAY.slice(1)}index.html`);
  if (lan) {
    const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
    for (const ip of ips) console.log(`On a phone on the same Wi-Fi:    http://${ip}:${port}/`);
  }
  console.log("\nKeep this window open while testing. Close it to stop.\n");
  if (open) {
    const cmd = process.platform === "win32" ? `start "" "${local}"` : process.platform === "darwin" ? `open "${local}"` : `xdg-open "${local}"`;
    exec(cmd, () => {});
  }
});
