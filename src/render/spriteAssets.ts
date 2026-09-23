import * as THREE from "three";
import { assetUrl } from "./assetCatalog";

/**
 * Texture loading and sprite helpers shared by every render module.
 *
 * Sprite sheets are 4 columns x 2 rows = 8 frames. Frame 0 is top-left, and
 * frames run left-to-right along the top row, then the bottom row.
 */

/** A loaded sprite sheet plus its playback rate. */
export interface SheetClip {
  texture: THREE.Texture;
  fps: number;
  frames: number;
}

/** A single loaded image and its width/height ratio, used to size sprites without distortion. */
export interface SpriteAsset {
  texture: THREE.Texture;
  aspect: number;
}

/** Crops a sub-rectangle out of an image. `bbox` is [left, top, right, bottom] in source pixels. */
export interface CropSpec {
  image: [number, number];
  bbox: [number, number, number, number];
  height: number;
}

const textureLoader = new THREE.TextureLoader();

/** Applies the project's standard texture settings (sRGB, mipmapped, no wrapping). */
export function configureTexture(texture: THREE.Texture): THREE.Texture {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Loads one bundled image by filename.
 *
 * Three's loader rejects with a bare DOM `Event` on a network or decode
 * failure, which prints as "[object Event]". This wraps it in an `Error` that
 * names the file, so failures are diagnosable in the console and on screen.
 *
 * @throws Error if the filename isn't bundled or the image fails to load.
 */
export async function loadTexture(filename: string): Promise<THREE.Texture> {
  const url = assetUrl(filename);
  imagesRequested += 1;
  notifyProgress();
  try {
    return configureTexture(await textureLoader.loadAsync(url));
  } catch (cause) {
    throw new Error(`Failed to load image "${filename}"`, { cause });
  } finally {
    imagesSettled += 1;
    notifyProgress();
  }
}

// --- Load progress ---------------------------------------------------------
// Counts every image request so the loading screen can show real progress and
// the boot watchdog can tell "slow" from "stuck" (MOBILE_PERFORMANCE §42).

type LoadProgressListener = (settled: number, requested: number) => void;
let imagesRequested = 0;
let imagesSettled = 0;
const progressListeners = new Set<LoadProgressListener>();

function notifyProgress(): void {
  for (const listener of progressListeners) listener(imagesSettled, imagesRequested);
}

/** Calls `listener(settled, requested)` whenever an image starts or finishes loading. Returns an unsubscribe function. */
export function onImageLoadProgress(listener: LoadProgressListener): () => void {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
}

/** Loads an image as a {@link SpriteAsset} (texture + aspect ratio). */
export async function loadSpriteAsset(filename: string): Promise<SpriteAsset> {
  const texture = await loadTexture(filename);
  const image = texture.image as HTMLImageElement;
  return { texture, aspect: image.naturalWidth / image.naturalHeight };
}

/** Loads an 8-frame sprite sheet; the texture is pre-scaled to show one frame at a time. */
export async function loadSheet(filename: string, fps: number): Promise<SheetClip> {
  const texture = await loadTexture(filename);
  texture.repeat.set(0.25, 0.5);
  return { texture, fps, frames: 8 };
}

/** Loads an image and returns a sprite showing only the `crop` rectangle, `crop.height` world units tall. */
export async function loadCroppedSprite(filename: string, crop: CropSpec): Promise<THREE.Sprite> {
  const texture = await loadTexture(filename);
  const [imageWidth, imageHeight] = crop.image;
  const [left, top, right, bottom] = crop.bbox;
  texture.repeat.set((right - left) / imageWidth, (bottom - top) / imageHeight);
  texture.offset.set(left / imageWidth, (imageHeight - bottom) / imageHeight);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  const aspect = (right - left) / (bottom - top);
  sprite.scale.set(crop.height * aspect, crop.height, 1);
  return sprite;
}

/**
 * Creates a sprite `height` world units tall, preserving the asset's aspect ratio.
 * The sprite gets its own material but shares the texture, so this is cheap to call repeatedly.
 * `userData.baseScale` records the original scale for effects like the production pulse.
 */
export function spriteFromAsset(asset: SpriteAsset, height: number): THREE.Sprite {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: asset.texture, transparent: true, depthTest: false }));
  sprite.scale.set(height * asset.aspect, height, 1);
  sprite.userData.baseScale = sprite.scale.clone();
  return sprite;
}

/** Points a sprite sheet's texture at frame `frame` of a 4-column by 2-row, 8-frame sheet. */
export function setSheetFrame(clip: SheetClip, frame: number): void {
  const normalized = ((frame % clip.frames) + clip.frames) % clip.frames;
  clip.texture.offset.set((normalized % 4) * 0.25, Math.floor(normalized / 4) === 0 ? 0.5 : 0);
}

/** Same addressing as {@link setSheetFrame}, for a texture that isn't wrapped in a SheetClip (cloned villager textures). */
export function setTextureFrame(texture: THREE.Texture, frame: number): void {
  const normalized = ((frame % 8) + 8) % 8;
  texture.offset.set((normalized % 4) * 0.25, Math.floor(normalized / 4) === 0 ? 0.5 : 0);
}
