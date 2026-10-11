// Pre-launch checks for start-game.cmd (also runnable directly: `node Tools/dev/preflight.mjs`).
//
// Written to run on old Node versions too (no top-level await, no newer APIs),
// so that it can tell someone their Node is too old instead of crashing.
//
// Exit codes (start-game.cmd branches on these):
//   0  ready: dependencies are installed and up to date, start the dev server
//   10 dependencies need installing (node_modules missing, or the dependencies
//      in package.json, pnpm-lock.yaml or pnpm-workspace.yaml changed since the
//      last install; a version bump alone doesn't count)
//   20 a dev server is already answering on the port, so just open the browser
//   1  can't continue (message printed)

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 4173;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Vite 8 requires Node ^20.19.0 || >=22.12.0. */
function nodeIsSupported(version) {
  const [major, minor] = version.split(".").map(Number);
  return (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major >= 23;
}

function mtime(file) {
  try {
    return fs.statSync(path.join(root, file)).mtimeMs;
  } catch {
    return null;
  }
}

const DEPS_STAMP = "node_modules/.gae-deps-stamp";

/**
 * What node_modules depends on: the dependency fields of package.json (not its
 * version, which changes with every build), the lockfile and the workspace file.
 */
function dependencyKey() {
  const read = (file) => { try { return fs.readFileSync(path.join(root, file), "utf8"); } catch { return ""; } };
  let pkg = {};
  try { pkg = JSON.parse(read("package.json")); } catch { /* A broken package.json changes the key. */ }
  const fields = { dependencies: pkg.dependencies, devDependencies: pkg.devDependencies, engines: pkg.engines, packageManager: pkg.packageManager, pnpm: pkg.pnpm };
  return crypto.createHash("sha256").update(JSON.stringify(fields)).update(read("pnpm-lock.yaml")).update(read("pnpm-workspace.yaml")).digest("hex");
}

function recordInstall() {
  try { fs.writeFileSync(path.join(root, DEPS_STAMP), dependencyKey()); } catch { /* Next start just checks again. */ }
}

/** True when node_modules is missing or the dependencies changed since the last install. */
function needsInstall() {
  if (mtime("node_modules/.modules.yaml") === null) return true;
  let stamp = null;
  try { stamp = fs.readFileSync(path.join(root, DEPS_STAMP), "utf8").trim(); } catch { /* Not written yet. */ }
  if (stamp) return stamp !== dependencyKey();
  // No stamp yet (installed before the stamp existed): only the lockfile and the
  // workspace file count. A package.json version bump alone needs no install.
  const installedAt = Math.max(mtime("node_modules/.modules.yaml"), mtime("node_modules/.pnpm-workspace-state-v1.json") ?? 0);
  const stale = ["pnpm-lock.yaml", "pnpm-workspace.yaml"].some((file) => {
    const changedAt = mtime(file);
    return changedAt !== null && changedAt > installedAt;
  });
  if (!stale) recordInstall();
  return stale;
}

// `node Tools/dev/preflight.mjs --record`: start-game.cmd calls this after a successful install.
if (process.argv.includes("--record")) {
  recordInstall();
  process.exit(0);
}

/** Calls back with true if something already serves HTTP on the dev port. */
function serverAlreadyRunning(callback) {
  const request = http.get({ host: "127.0.0.1", port: PORT, path: "/", timeout: 1500 }, (response) => {
    response.resume();
    callback(true);
  });
  request.on("timeout", () => request.destroy());
  request.on("error", () => callback(false));
}

if (!nodeIsSupported(process.versions.node)) {
  console.error(`Node ${process.versions.node} is too old for this project (Vite 8 needs 20.19+ or 22.12+).`);
  console.error("Install the current Node LTS from https://nodejs.org and run start-game again.");
  process.exit(1);
}

if (!fs.existsSync(path.join(root, "Assets", "Art", "Production"))) {
  console.error("Assets/Art/Production is missing, so the game has no art to load.");
  console.error("Make sure the Assets folder is next to package.json.");
  process.exit(1);
}

serverAlreadyRunning((running) => {
  if (running) {
    console.log(`A dev server is already running on port ${PORT}.`);
    process.exit(20);
  }
  if (needsInstall()) {
    console.log("Dependencies are missing or out of date.");
    process.exit(10);
  }
  process.exit(0);
});
