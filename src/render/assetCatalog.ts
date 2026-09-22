const importedAssets = import.meta.glob<string>(
  [
    "../../Assets/Art/Production/Characters/WoodcutterMale01/Runtime2x/Sheets/*.png",
    "../../Assets/Art/Production/Environment/Trees/Deciduous01/Runtime2x/*.png",
    "../../Assets/Art/Production/Props/LogStockpile01/Runtime2x/log-stockpile-01-state-*.png",
    "../../Assets/Art/Production/Buildings/*/Runtime2x/*.png",
  ],
  { eager: true, query: "?url", import: "default" },
);

export function assetUrl(filename: string): string {
  const match = Object.entries(importedAssets).find(([path]) => path.endsWith(filename));
  if (!match) throw new Error(`Bundled asset not found: ${filename}`);
  return match[1];
}
