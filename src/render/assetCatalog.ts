/**
 * The runtime art manifest.
 *
 * Game code asks for art by its production filename (e.g.
 * `farm-level-1-2x-v1.png`), but what ships is the WebP copy in
 * `Assets/Runtime/`, written by `Tools/ArtPipeline/export_runtime_webp.py`.
 * WebP keeps the current runtime art around 15 MB, below the portal's 50 MB
 * upload limit. The PNG masters remain outside the shipped bundle.
 *
 * Vite resolves this glob at build time into hashed URLs. With `base: "./"`
 * the URLs are relative, so the game works from the portal's sub-folder.
 * Only files in Assets/Runtime are bundled, so unused art never ships.
 */
const importedAssets = import.meta.glob<string>("../../Assets/Runtime/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

const assetUrlByName = new Map<string, string>();
for (const [path, url] of Object.entries(importedAssets)) {
  assetUrlByName.set(path.slice(path.lastIndexOf("/") + 1), url);
}

/** Maps a production filename to its runtime name: `x.png` → `x.webp`. */
export function runtimeAssetName(filename: string): string {
  return filename.replace(/\.png$/i, ".webp");
}

/** Every runtime filename that is bundled (used by tests and the load-progress counter). */
export function bundledAssetNames(): string[] {
  return [...assetUrlByName.keys()];
}

/**
 * Resolves an art filename (e.g. `farm-level-1-2x-v1.png`) to its served URL.
 * @throws Error if the art hasn't been exported to Assets/Runtime.
 */
export function assetUrl(filename: string): string {
  const url = assetUrlByName.get(runtimeAssetName(filename));
  if (!url) {
    throw new Error(
      `Bundled asset not found: ${filename}. If this is new art, add it to SOURCES in `
      + "Tools/ArtPipeline/export_runtime_webp.py and run: python Tools/ArtPipeline/export_runtime_webp.py",
    );
  }
  return url;
}
