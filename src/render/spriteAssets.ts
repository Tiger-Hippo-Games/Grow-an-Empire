import * as THREE from "three";
import { assetUrl } from "./assetCatalog";

export interface SheetClip {
  texture: THREE.Texture;
  fps: number;
  frames: number;
}

export interface SpriteAsset {
  texture: THREE.Texture;
  aspect: number;
}

export interface CropSpec {
  image: [number, number];
  bbox: [number, number, number, number];
  height: number;
}

const textureLoader = new THREE.TextureLoader();

export function configureTexture(texture: THREE.Texture): THREE.Texture {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export async function loadSpriteAsset(filename: string): Promise<SpriteAsset> {
  const texture = configureTexture(await textureLoader.loadAsync(assetUrl(filename)));
  const image = texture.image as HTMLImageElement;
  return { texture, aspect: image.naturalWidth / image.naturalHeight };
}

export async function loadSheet(filename: string, fps: number): Promise<SheetClip> {
  const texture = configureTexture(await textureLoader.loadAsync(assetUrl(filename)));
  texture.repeat.set(0.25, 0.5);
  return { texture, fps, frames: 8 };
}

export async function loadCroppedSprite(filename: string, crop: CropSpec): Promise<THREE.Sprite> {
  const texture = configureTexture(await textureLoader.loadAsync(assetUrl(filename)));
  const [imageWidth, imageHeight] = crop.image;
  const [left, top, right, bottom] = crop.bbox;
  texture.repeat.set((right - left) / imageWidth, (bottom - top) / imageHeight);
  texture.offset.set(left / imageWidth, (imageHeight - bottom) / imageHeight);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  const aspect = (right - left) / (bottom - top);
  sprite.scale.set(crop.height * aspect, crop.height, 1);
  return sprite;
}

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
