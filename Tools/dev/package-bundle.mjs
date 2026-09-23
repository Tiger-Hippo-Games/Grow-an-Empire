// Packages dist/ into the ZIP the GoLive portal expects, then validates it.
//
// Run through `pnpm package`, which builds first. Output:
//   release/grow-an-empire-<version>.zip  with index.html at the ZIP root
//   (the contents of dist/, never the dist/ folder itself; GAME_SUBMISSION_GUIDE §4, §15).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createZip } from "./zip.mjs";
import { validateBundle } from "./validate-bundle.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dist = path.join(root, "dist");
const { name, version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

if (!fs.existsSync(path.join(dist, "index.html"))) {
  console.error("dist/index.html not found. Run `pnpm build` first (or use `pnpm package`, which builds).");
  process.exit(1);
}

/** All files under a directory, as paths relative to it with "/" separators. */
function listFiles(directory, prefix = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(full, relative) : [relative];
  });
}

const files = listFiles(dist).sort();
const zip = createZip(files.map((file) => ({ name: file, data: fs.readFileSync(path.join(dist, file)) })));
const releaseDir = path.join(root, "release");
fs.mkdirSync(releaseDir, { recursive: true });
const zipPath = path.join(releaseDir, `${name}-${version}.zip`);
fs.writeFileSync(zipPath, zip);
console.log(`Wrote ${path.relative(root, zipPath)} (${files.length} files, ${(zip.length / 1e6).toFixed(2)} MB)\n`);

const rows = validateBundle(zipPath);
for (const [level, message] of rows) console.log(`  ${level === "PASS" ? "✔" : level === "FAIL" ? "✖" : level === "WARN" ? "⚠" : "ℹ"} ${level.padEnd(4)}  ${message}`);
const failures = rows.filter(([level]) => level === "FAIL").length;
console.log(failures ? `\n  ${failures} CHECK(S) FAILED — fix before uploading` : "\n  Ready to upload.");
process.exit(failures ? 1 : 0);
