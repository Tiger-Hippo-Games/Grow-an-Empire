// Pre-upload validator for the GoLive portal bundle.
//
// Reproduces the checks in common/GAME_SUBMISSION_GUIDE.md §7 (the portal's own
// validator lives in its backend repo, which we don't have) plus the manual
// items from §15/§16 that the portal validator skips, such as relative paths.
//
// Usage: node Tools/dev/validate-bundle.mjs release/grow-an-empire-0.1.0.zip [--verbose]
// Exit code 1 if any check FAILs; WARNs don't block.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readZip } from "./zip.mjs";

const MAX_BYTES = 50 * 1024 * 1024; // GAME_SUBMISSION_GUIDE §1
const INITIAL_TARGET_BYTES = 5 * 1024 * 1024; // GAME_DEVELOPER_GUIDE §3.5
const SDK_PATH = "/api/v1/sdk/platform-sdk.js";

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
  (bytes <= MAX_BYTES ? pass : fail)(`ZIP is ${(bytes / 1e6).toFixed(2)} MB (limit 50 MB)`);

  let entries;
  try {
    entries = readZip(fs.readFileSync(zipPath));
    pass("File is a valid ZIP archive");
  } catch (error) {
    fail(`Not a valid ZIP: ${error.message}`);
    return results;
  }
  (entries.length > 0 ? pass : fail)(`ZIP has ${entries.length} entries`);

  const unsafe = entries.filter((entry) => entry.name.startsWith("/") || entry.name.split("/").includes("..") || /^[a-z]:/i.test(entry.name));
  (unsafe.length === 0 ? pass : fail)(unsafe.length === 0 ? "No path traversal" : `Unsafe paths: ${unsafe.map((e) => e.name).join(", ")}`);

  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const index = byName.get("index.html");
  if (!index) {
    fail("index.html is not at the ZIP root (zip the CONTENTS of dist/, not the folder)");
    return results;
  }
  pass("index.html at ZIP root");

  const html = index.read().toString("utf8");
  (/^\s*<!doctype html>/i.test(html) ? pass : fail)("index.html starts with <!DOCTYPE html>");
  (html.includes(SDK_PATH) ? pass : fail)(`GoLive Platform SDK script tag present (${SDK_PATH})`);

  const absolute = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((url) => (url.startsWith("/") && url !== SDK_PATH) || /^(https?:)?\/\//i.test(url));
  (absolute.length === 0 ? pass : fail)(absolute.length === 0 ? "index.html uses only relative asset paths" : `Absolute URLs in index.html: ${absolute.join(", ")}`);

  const textEntries = entries.filter((entry) => /\.(html|js|css|json)$/i.test(entry.name));
  const localhostHits = [];
  const dialogHits = [];
  for (const entry of textEntries) {
    const text = entry.read().toString("utf8");
    if (/localhost|127\.0\.0\.1/.test(text)) localhostHits.push(entry.name);
    if (/(?:^|[^.\w$])(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(text)) dialogHits.push(entry.name);
  }
  (localhostHits.length === 0 ? pass : fail)(localhostHits.length === 0 ? "No localhost URLs in built files" : `localhost found in: ${localhostHits.join(", ")}`);
  (dialogHits.length === 0 ? pass : fail)(dialogHits.length === 0 ? "No alert()/confirm()/prompt() calls" : `Blocked dialog API used in: ${dialogHits.join(", ")}`);

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
