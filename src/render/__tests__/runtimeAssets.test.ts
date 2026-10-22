import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BUILDINGS } from "../../game/content";
import { assetUrl, bundledAssetNames, runtimeAssetName } from "../assetCatalog";
import { CHARACTER_FILES, walkSheetFilename, workSheetFilename, type CharacterRole } from "../characterAssets";
import { buildingFilename, type ConstructionStage } from "../constructionView";

/**
 * Guards the WebP runtime-art pipeline (Tools/ArtPipeline/export_runtime_webp.py):
 * every image the game asks for must be bundled, nothing unused may ship, and
 * no WebP may be older than its PNG source.
 */

// Vitest runs from the project root.
const ROOT = process.cwd();
const STAGES: ConstructionStage[] = ["foundation", "frame", "late", "complete"];

/** Canvas dimensions from the three WebP bitstream headers used by the exporter. */
function webpSize(data: Uint8Array): { width: number; height: number } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const chunk = String.fromCharCode(...data.subarray(12, 16));
  const uint24 = (at: number): number => data[at] + data[at + 1] * 256 + data[at + 2] * 65536;
  if (chunk === "VP8X") return { width: uint24(24) + 1, height: uint24(27) + 1 };
  if (chunk === "VP8 ") return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  if (chunk === "VP8L") {
    const bits = view.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  throw new Error(`Unsupported WebP header: ${chunk}`);
}

/** Every filename the game code requests at runtime. Keep in step with the loaders. */
function referencedFilenames(): string[] {
  const names = [
    "village-empty-terrain-16x9-v2.png",
    "southern-road-map-v6.png",
    "deciduous-01-healthy-2x-v1.png",
    ...Array.from({ length: 9 }, (_, level) => `settlement-level-${level}-2x-v1.png`),
    ...["walk", "chop", "pickup-log", "carry-log"].flatMap((action) =>
      ["southeast", "southwest"].map((direction) => `woodcutter-male-01-${action}-${direction}-sheet-2x-v1.png`)),
    ...(Object.keys(CHARACTER_FILES) as CharacterRole[]).map(walkSheetFilename),
    ...(Object.keys(CHARACTER_FILES) as CharacterRole[]).map(workSheetFilename),
    "swordsman-combat-south8-master-v1.png", "archer-combat-south8-master-v1.png",
    "horseman-combat-south8-master-v1.png", "elephant-combat-south8-master-v1.png", "enemy-combat-north8-master-v1.png",
    "enemy-archer-combat-north8-master-v1.png", "enemy-horseman-combat-north8-master-v1.png",
    ...Object.keys(BUILDINGS).flatMap((id) => STAGES.map((stage) => buildingFilename(id, stage))),
  ];
  return [...new Set(names)];
}

describe("runtime art bundle", () => {
  it("bundles every image the game loads", () => {
    for (const name of referencedFilenames()) expect(() => assetUrl(name), name).not.toThrow();
  });

  it("ships nothing the game doesn't load", () => {
    const referenced = new Set(referencedFilenames().map(runtimeAssetName));
    expect(bundledAssetNames().filter((name) => !referenced.has(name))).toEqual([]);
  });

  it("bounds decoded building textures while preserving the painted masters' proportions", () => {
    const manifest = JSON.parse(readFileSync(resolve(ROOT, "Assets/Runtime/manifest.json"), "utf8")) as Record<string, { source: string }>;
    for (const [name, entry] of Object.entries(manifest)) {
      if (!entry.source.includes("/Buildings/")) continue;
      const png = readFileSync(resolve(ROOT, entry.source));
      const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
      const source = { width: header.getUint32(16), height: header.getUint32(20) };
      const runtime = webpSize(readFileSync(resolve(ROOT, "Assets/Runtime", name)));
      expect(runtime.width, name).toBeLessThanOrEqual(768);
      expect(runtime.width, name).toBeLessThanOrEqual(source.width);
      expect(runtime.height, name).toBe(Math.round(source.height * runtime.width / source.width));
    }
  });

  it("has no WebP that is stale against its PNG source (re-run export_runtime_webp.py)", () => {
    const manifest = JSON.parse(readFileSync(resolve(ROOT, "Assets/Runtime/manifest.json"), "utf8")) as Record<string, { source: string; sha256: string }>;
    const stale = Object.entries(manifest)
      .filter(([, entry]) => existsSync(resolve(ROOT, entry.source)))
      .filter(([, entry]) => createHash("sha256").update(readFileSync(resolve(ROOT, entry.source))).digest("hex") !== entry.sha256)
      .map(([name]) => name);
    expect(stale).toEqual([]);
  }, 30_000); // Hashes every PNG master: slow when the whole suite runs in parallel.
});
