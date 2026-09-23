import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BUILDINGS } from "../../game/content";
import { assetUrl, bundledAssetNames, runtimeAssetName } from "../assetCatalog";
import { CHARACTER_FILES, walkSheetFilename, type CharacterRole } from "../characterAssets";
import { buildingFilename, type ConstructionStage } from "../constructionView";

/**
 * Guards the WebP runtime-art pipeline (Tools/ArtPipeline/export_runtime_webp.py):
 * every image the game asks for must be bundled, nothing unused may ship, and
 * no WebP may be older than its PNG source.
 */

// Vitest runs from the project root.
const ROOT = process.cwd();
const STAGES: ConstructionStage[] = ["foundation", "frame", "late", "complete"];

/** Every filename the game code requests at runtime. Keep in step with the loaders. */
function referencedFilenames(): string[] {
  const names = [
    "village-empty-terrain-16x9-v2.png",
    "deciduous-01-healthy-2x-v1.png",
    ...Array.from({ length: 9 }, (_, level) => `settlement-level-${level}-2x-v1.png`),
    ...["walk", "chop", "pickup-log", "carry-log"].flatMap((action) =>
      ["southeast", "southwest"].map((direction) => `woodcutter-male-01-${action}-${direction}-sheet-2x-v1.png`)),
    ...(Object.keys(CHARACTER_FILES) as CharacterRole[]).map(walkSheetFilename),
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

  it("has no WebP that is stale against its PNG source (re-run export_runtime_webp.py)", () => {
    const manifest = JSON.parse(readFileSync(resolve(ROOT, "Assets/Runtime/manifest.json"), "utf8")) as Record<string, { source: string; sha256: string }>;
    const stale = Object.entries(manifest)
      .filter(([, entry]) => existsSync(resolve(ROOT, entry.source)))
      .filter(([, entry]) => createHash("sha256").update(readFileSync(resolve(ROOT, entry.source))).digest("hex") !== entry.sha256)
      .map(([name]) => name);
    expect(stale).toEqual([]);
  });
});
