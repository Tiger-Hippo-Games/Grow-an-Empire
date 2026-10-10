import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createZip } from "../zip.mjs";
import { validateBundle } from "../validate-bundle.mjs";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gae-bundle-validation-"));
let sequence = 0;
const sdk = "https://golive-platform.netlify.app/sdk/platform-sdk.js";
const validHtml = `<!doctype html><meta name="viewport" content="width=device-width, maximum-scale=1.0, user-scalable=no"><script src="${sdk}"></script><script src="./game.js"></script>`;

function validate(html = validHtml, extra = [], javascript = "") {
  const zipPath = path.join(directory, `case-${sequence++}.zip`);
  fs.writeFileSync(zipPath, createZip([
    { name: "index.html", data: Buffer.from(html) },
    { name: "game.js", data: Buffer.from(javascript) },
    ...extra.map((name) => ({ name, data: Buffer.from("fixture") })),
  ]));
  try { return validateBundle(zipPath).filter(([level]) => level === "FAIL").map(([, message]) => message); }
  finally { fs.unlinkSync(zipPath); }
}
afterAll(() => fs.rmdirSync(directory));

describe("SDK 1.5.0 submission bundle rules", () => {
  it("permits the official SDK URL while keeping game assets relative", () => {
    expect(validate()).toEqual([]);
    expect(validate(validHtml.replace("./game.js", "/game.js"))).toContain("Absolute URLs in index.html: /game.js");
  });
  it("rejects the obsolete SDK URL and a commented-out SDK tag", () => {
    expect(validate(validHtml.replace(sdk, "/api/v1/sdk/platform-sdk.js"))).toContain(`Official GoLive SDK script tag present (${sdk})`);
    expect(validate(validHtml.replace(`<script src="${sdk}"></script>`, `<!--<script src="${sdk}"></script>-->`))).toContain(`Official GoLive SDK script tag present (${sdk})`);
  });
  it.each(["assets/tool.exe", "tool.ps1", "server.php", ".htaccess", "tool.py"])("rejects prohibited file %s", (name) => {
    expect(validate(validHtml, [name])).toContain(`Prohibited or unsupported files: ${name}`);
  });
  it("rejects path traversal and navigation out of the iframe", () => {
    expect(validate(validHtml, ["../escape.js"])).toContain("Unsafe paths: ../escape.js");
    expect(validate(validHtml, [], "window.top.location.href='https://example.com';")).toContain("Iframe escape navigation in: game.js");
  });
  it("rejects code that loads art missing from the ZIP", () => {
    expect(validate(validHtml, ["assets/farm-AbC123.webp"], 'new URL("assets/farm-AbC123.webp", import.meta.url)')).toEqual([]);
    expect(validate(validHtml, [], 'new URL("assets/farm-AbC123.webp", import.meta.url)')).toContain("Assets referenced but missing from the ZIP: assets/farm-AbC123.webp");
  });
  it("rejects a viewport that permits unwanted mobile zoom", () => {
    expect(validate(validHtml.replace(", maximum-scale=1.0, user-scalable=no", ""))).toContain("Viewport prevents unwanted mobile zooming");
  });
});
