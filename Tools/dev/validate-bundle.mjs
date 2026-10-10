// Pre-upload validator for the GoLive portal bundle.
//
// Checks the SDK 1.5.0 contract in common/GOLIVE_DEVELOPER_REFERENCE.md.
// This does not replace the live Developer Console Sandbox Preview.
//
// Usage: node Tools/dev/validate-bundle.mjs release/grow-an-empire-0.1.0.zip [--verbose]
// Exit code 1 if any check FAILs; WARNs don't block.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readZip } from "./zip.mjs";

const MAX_BYTES = 200 * 1024 * 1024; // GOLIVE_DEVELOPER_REFERENCE §1
const INITIAL_TARGET_BYTES = 5 * 1024 * 1024; // GAME_DEVELOPER_GUIDE §3.5
const SDK_PATH = "https://golive-platform.netlify.app/sdk/platform-sdk.js";
const ALLOWED_FORMATS = new Set(".png .jpg .jpeg .webp .svg .gif .ico .mp3 .ogg .wav .aac .webm .glb .gltf .bin .html .js .css .json .wasm .woff .woff2 .ttf .otf".split(" "));

const results = [];
const pass = (message) => results.push(["PASS", message]);
const fail = (message) => results.push(["FAIL", message]);
const warn = (message) => results.push(["WARN", message]);
const info = (message) => results.push(["INFO", message]);

/** Runs every check against a ZIP file and returns the result rows. */
export function validateBundle(zipPath, { verbose = false } = {}) {
  results.length = 0;
  if (!fs.existsSync(zipPath)) {
    fail(`ZIP not found: ${zipPath}`);
    return results;
  }
  const bytes = fs.statSync(zipPath).size;
  (bytes <= MAX_BYTES ? pass : fail)(`ZIP is ${(bytes / 1e6).toFixed(2)} MB (limit 200 MB)`);

  let entries;
  try {
    entries = readZip(fs.readFileSync(zipPath));
    pass("File is a valid ZIP archive");
  } catch (error) {
    fail(`Not a valid ZIP: ${error.message}`);
    return results;
  }
  (entries.length > 0 ? pass : fail)(`ZIP has ${entries.length} entries`);

  const unsafe = entries.filter((entry) => entry.name.startsWith("/") || entry.name.includes("\\") || entry.name.split("/").includes("..") || /^[a-z]:/i.test(entry.name));
  (unsafe.length === 0 ? pass : fail)(unsafe.length === 0 ? "No path traversal" : `Unsafe paths: ${unsafe.map((e) => e.name).join(", ")}`);
  const prohibited = entries.filter((entry) => !entry.name.endsWith("/") && !ALLOWED_FORMATS.has(path.extname(entry.name).toLowerCase()));
  (prohibited.length === 0 ? pass : fail)(prohibited.length === 0 ? "Only allowed static game file formats" : `Prohibited or unsupported files: ${prohibited.map((e) => e.name).join(", ")}`);

  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const index = byName.get("index.html");
  if (!index) {
    fail("index.html is not at the ZIP root (zip the CONTENTS of dist/, not the folder)");
    return results;
  }
  pass("index.html at ZIP root");

  let html;
  try {
    html = index.read().toString("utf8");
  } catch (error) {
    fail(`Could not read index.html from the ZIP: ${error.message}`);
    return results;
  }
  (/^\s*<!doctype html>/i.test(html) ? pass : fail)("index.html starts with <!DOCTYPE html>");
  const activeHtml = html.replace(/<!--[\s\S]*?-->/g, "");
  const sdkScripts = [...activeHtml.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  (sdkScripts.includes(SDK_PATH) ? pass : fail)(`Official GoLive SDK script tag present (${SDK_PATH})`);
  const viewport = activeHtml.match(/<meta\b[^>]*name=["']viewport["'][^>]*content=["']([^"']+)["']/i)?.[1] ?? "";
  (/width=device-width/.test(viewport) && /maximum-scale=1(?:\.0)?(?:,|\s|$)/.test(viewport) && /user-scalable=no/.test(viewport) ? pass : fail)("Viewport prevents unwanted mobile zooming");

  const absolute = [...activeHtml.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((url) => url !== SDK_PATH && (url.startsWith("/") || /^(https?:)?\/\//i.test(url)));
  (absolute.length === 0 ? pass : fail)(absolute.length === 0 ? "index.html uses only relative asset paths" : `Absolute URLs in index.html: ${absolute.join(", ")}`);

  // Every relative file index.html loads must be in the ZIP (a renamed bundle
  // file would otherwise only show up as a blank page on the portal).
  const referenced = [...activeHtml.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((url) => url !== SDK_PATH && !/^(?:[a-z]+:|\/\/|#|\/)/i.test(url))
    .map((url) => decodeURI(url.split(/[?#]/)[0]).replace(/^\.\//, ""))
    .filter(Boolean);
  const missing = [...new Set(referenced)].filter((name) => !byName.has(name));
  (missing.length === 0 ? pass : fail)(missing.length === 0 ? `Every file index.html loads is in the ZIP (${new Set(referenced).size})` : `index.html loads files missing from the ZIP: ${missing.join(", ")}`);

  const textEntries = entries.filter((entry) => /\.(html|js|css|json)$/i.test(entry.name));
  // Every art, font and media file the code or styles name must be in the ZIP:
  // a missing one only shows on the portal as an empty card or a fallback font.
  const ASSET_REF = /\bassets\/[\w.@-]+\.(?:webp|png|jpe?g|gif|svg|woff2?|ttf|otf|mp3|ogg|wav|m4a|json)\b/gi;
  const assetRefs = new Set();
  for (const entry of textEntries) {
    try { for (const match of entry.read().toString("utf8").matchAll(ASSET_REF)) assetRefs.add(match[0]); } catch { /* Reported below. */ }
  }
  const missingAssets = [...assetRefs].filter((name) => !byName.has(name));
  (missingAssets.length === 0 ? pass : fail)(missingAssets.length === 0 ? `Every asset the code and styles load is in the ZIP (${assetRefs.size})` : `Assets referenced but missing from the ZIP: ${missingAssets.join(", ")}`);
  const unused = entries.filter((entry) => entry.name.startsWith("assets/") && !entry.name.endsWith("/") && !assetRefs.has(entry.name)
    && !/^assets\/(?:thumbnail|banner)\./i.test(entry.name));
  if (unused.length) warn(`${unused.length} file(s) in assets/ are never referenced: ${unused.slice(0, 5).map((e) => e.name).join(", ")}${unused.length > 5 ? "…" : ""}`);
  const localhostHits = [];
  const dialogHits = [];
  const navigationHits = [];
  for (const entry of textEntries) {
    let text;
    try {
      text = entry.read().toString("utf8");
    } catch (error) {
      fail(`Could not read ${entry.name} from the ZIP: ${error.message}`);
      continue;
    }
    if (/localhost|127\.0\.0\.1/.test(text)) localhostHits.push(entry.name);
    if (/(?:^|[^.\w$])(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(text)) dialogHits.push(entry.name);
    if (/(?:window\.)?(?:top|parent)\.location\s*(?:=|\.(?:href\s*=|assign\s*\(|replace\s*\())/.test(text)) navigationHits.push(entry.name);
  }
  (localhostHits.length === 0 ? pass : fail)(localhostHits.length === 0 ? "No localhost URLs in built files" : `localhost found in: ${localhostHits.join(", ")}`);
  (dialogHits.length === 0 ? pass : fail)(dialogHits.length === 0 ? "No alert()/confirm()/prompt() calls" : `Blocked dialog API used in: ${dialogHits.join(", ")}`);
  (navigationHits.length === 0 ? pass : fail)(navigationHits.length === 0 ? "No parent/top navigation" : `Iframe escape navigation in: ${navigationHits.join(", ")}`);

  for (const [label, pattern] of [["Thumbnail", /^assets\/thumbnail\.(png|jpe?g|webp)$/i], ["Banner", /^assets\/banner\.(png|jpe?g|webp)$/i]]) {
    const found = entries.find((entry) => pattern.test(entry.name));
    (found ? info : warn)(found ? `${label} found: ${found.name}` : `${label} not in assets/ (upload it separately, see §9)`);
  }

  const totalUncompressed = entries.reduce((sum, entry) => sum + entry.size, 0);
  info(`Total unpacked size ${(totalUncompressed / 1e6).toFixed(2)} MB`);
  if (totalUncompressed > INITIAL_TARGET_BYTES) {
    info("Above 5 MB in total; fine as long as the first load stays small (art loads on demand)");
  }
  if (verbose) for (const entry of entries) info(`${entry.name} (${entry.size} bytes)`);
  return results;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const zipPath = process.argv[2];
  if (!zipPath) {
    console.error("Usage: node Tools/dev/validate-bundle.mjs <bundle.zip> [--verbose]");
    process.exit(2);
  }
  const rows = validateBundle(zipPath, { verbose: process.argv.includes("--verbose") });
  console.log("GoLive bundle validator (local copy of GAME_SUBMISSION_GUIDE §7 checks)\n");
  for (const [level, message] of rows) console.log(`  ${level === "PASS" ? "✔" : level === "FAIL" ? "✖" : level === "WARN" ? "⚠" : "ℹ"} ${level.padEnd(4)}  ${message}`);
  const failures = rows.filter(([level]) => level === "FAIL").length;
  const checks = rows.filter(([level]) => level === "PASS" || level === "FAIL").length;
  console.log(failures ? `\n  ${failures} CHECK(S) FAILED` : `\n  ALL CHECKS PASSED (${checks}/${checks})`);
  process.exit(failures ? 1 : 0);
}
