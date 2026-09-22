const importedAssets = import.meta.glob<string>(
  [
    "../../Assets/Art/Production/Characters/WoodcutterMale01/Runtime2x/Sheets/*.png",
    "../../Assets/Art/Production/Environment/Trees/Deciduous01/Runtime2x/*.png",
    "../../Assets/Art/Production/Props/LogStockpile01/Runtime2x/log-stockpile-01-state-*.png",
    "../../Assets/Art/Production/Buildings/*/Runtime2x/*.png",
  ],
  { eager: true, query: "?url", import: "default" },
);

// Built once at module load rather than rescanned on every assetUrl() call:
// with ~15 buildings × 4 stages plus character/tree/prop art, a linear scan
// per lookup adds up across the many sprites this game loads and clones.
const assetUrlByFilename = new Map<string, string>();
for (const [path, url] of Object.entries(importedAssets)) {
  const filename = path.slice(path.lastIndexOf("/") + 1);
  if (assetUrlByFilename.has(filename)) {
    throw new Error(`Duplicate bundled asset filename "${filename}" (from ${path}); asset lookups are by filename only.`);
  }
  assetUrlByFilename.set(filename, url);
}

export function assetUrl(filename: string): string {
  const url = assetUrlByFilename.get(filename);
  if (!url) throw new Error(`Bundled asset not found: ${filename}`);
  return url;
}
