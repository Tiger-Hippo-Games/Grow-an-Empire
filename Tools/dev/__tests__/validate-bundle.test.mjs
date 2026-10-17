import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createZip } from "../zip.mjs";
import { validateBundle } from "../validate-bundle.mjs";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gae-bundle-validation-"));
let sequence = 0;
const sdk = "/sdk/v2/platform-sdk.js";
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

describe("SDK v2 submission bundle rules", () => {
  it("rejects inline boot scripts under the live portal security policy", () => {
    for (const script of ['<script>window.boot=true;</script>', '<script type="module">boot();</script>', '<script data-src="fake.js">boot();</script>']) {
      expect(validate(validHtml + script)).toContain("index.html contains 1 inline script block(s); move scripts into .js files");
    }
    expect(validate(validHtml + '<!-- <script>boot();</script> -->')).toEqual([]);
    expect(validate(validHtml + '<script src="./boot-stage.js"></script>', ["boot-stage.js"])).toEqual([]);
    expect(validate(validHtml + '<script src="./boot-stage.js"></script>')).toContain("index.html loads files missing from the ZIP: boot-stage.js");
  });
  it("permits the official SDK URL while keeping game assets relative", () => {
    expect(validate()).toEqual([]);
    expect(validate(validHtml.replace("./game.js", "/game.js"))).toContain("Absolute URLs in index.html: /game.js");
  });
  it("rejects the obsolete SDK URL and a commented-out SDK tag", () => {
    expect(validate(validHtml.replace(sdk, "/api/v1/sdk/platform-sdk.js"))).toContain(`Official Hippo Arcade SDK script tag present (${sdk})`);
    expect(validate(validHtml.replace(`<script src="${sdk}"></script>`, `<!--<script src="${sdk}"></script>-->`))).toContain(`Official Hippo Arcade SDK script tag present (${sdk})`);
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
