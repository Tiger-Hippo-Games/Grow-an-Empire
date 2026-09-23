import * as THREE from "three";
import { loadTexture } from "./spriteAssets";
import type { ArmyUnits } from "../game/settlementSimulation";

/** Source cutouts. Each has a 512 × 512 companion PNG containing four walking poses. */
export const CHARACTER_FILES = {
  builder: "villager-builder.png",
  farmer: "villager-farmer.png",
  woodcutter: "villager-woodcutter.png",
  quarry: "villager-quarry-worker.png",
  miner: "villager-iron-miner.png",
  baker: "villager-baker.png",
  blacksmith: "villager-blacksmith.png",
  merchant: "villager-merchant.png",
  militia: "militia.png",
  spearman: "spearman.png",
  archer: "archer.png",
  swordsman: "swordsman.png",
  horseman: "horseman.png",
} as const;

export type CharacterRole = keyof typeof CHARACTER_FILES;

export function walkSheetFilename(role: CharacterRole): string {
  return CHARACTER_FILES[role].replace(/\.png$/, "-walk4.png");
}

const BUILDING_ROLES: Record<string, CharacterRole> = {
  house: "builder",
  woodcutter: "woodcutter",
  sawmill: "woodcutter",
  farm: "farmer",
  bakery: "baker",
  "swine-farm": "farmer",
  butchery: "baker",
  "fruit-orchard": "farmer",
  winery: "merchant",
  quarry: "quarry",
  granary: "farmer",
  marketplace: "merchant",
  blacksmith: "blacksmith",
  "weapons-workshop": "blacksmith",
  barracks: "spearman",
  stable: "horseman",
};

export function roleForBuilding(buildingId: string): CharacterRole {
  return BUILDING_ROLES[buildingId] ?? "builder";
}

/** Army order mirrors the muster formation and gives every unit type its own cutout. */
export function roleForArmyUnitAtIndex(units: ArmyUnits, index: number): CharacterRole {
  if (index < units.swordsmen) return "swordsman";
  index -= units.swordsmen;
  if (index < units.horsemen) return "horseman";
  index -= units.horsemen;
  if (index < units.archers) return "archer";
  index -= units.archers;
  if (index < units.spearmen) return "spearman";
  index -= units.spearmen;
  if (index < units.militia) return "militia";
  return "horseman";
}

export function createCharacterAssets() {
  const framesByRole = new Map<CharacterRole, THREE.Texture[]>();

  async function load(): Promise<void> {
    await Promise.all((Object.keys(CHARACTER_FILES) as CharacterRole[]).map(async (role) => {
      const sheet = await loadTexture(walkSheetFilename(role));
      const frames = Array.from({ length: 4 }, (_, frame) => {
        const texture = sheet.clone();
        texture.repeat.set(0.5, 0.5);
        texture.offset.set((frame % 2) * 0.5, frame < 2 ? 0.5 : 0);
        texture.needsUpdate = true;
        return texture;
      });
      framesByRole.set(role, frames);
      sheet.dispose();
    }));
  }

  function getFrame(role: CharacterRole, frame: number): THREE.Texture {
    const frames = framesByRole.get(role);
    if (!frames) throw new Error(`Character art for ${role} was requested before loading`);
    return frames[((Math.floor(frame) % 4) + 4) % 4];
  }

  return { load, getFrame };
}

export type CharacterAssets = ReturnType<typeof createCharacterAssets>;
