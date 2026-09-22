export const TOTAL_MOVES = 8;
export const TOTAL_SETTLEMENT_LEVELS = 9;
export const CONSTRUCTION_DURATION_SECONDS = 30;

export type ResourceName =
  | "wood"
  | "grain"
  | "food"
  | "stone"
  | "planks"
  | "wealth"
  | "tools"
  | "fruit"
  | "wine"
  | "arms"
  | "defense";

export interface BuildingDefinition {
  id: string;
  name: string;
  description: string;
  benefit: string;
  unlocks: string;
  artKey: string;
  offerMove: number;
  offerPriority: number;
  requiresAll?: string[];
  requiresAny?: string[];
  resource?: ResourceName;
  productionSeconds?: number;
  productionAmount?: number;
}

function building(definition: BuildingDefinition): BuildingDefinition {
  return definition;
}

export const BUILDINGS: Record<string, BuildingDefinition> = {
  woodcutter: building({ id: "woodcutter", name: "Woodcutter's Hut", description: "A forest camp that steadily gathers timber.", benefit: "+1 wood per cycle", unlocks: "Unlocks the Sawmill", artKey: "woodcutter", offerMove: 1, offerPriority: 1, resource: "wood", productionSeconds: 5, productionAmount: 1 }),
  farm: building({ id: "farm", name: "Farm", description: "Cultivated fields provide grain for the settlement.", benefit: "+1 grain per cycle", unlocks: "Unlocks the Bakery and Granary", artKey: "farm", offerMove: 1, offerPriority: 2, resource: "grain", productionSeconds: 6, productionAmount: 1 }),
  "swine-farm": building({ id: "swine-farm", name: "Swine Farm", description: "A sturdy piggery supplies reliable food.", benefit: "+1 food per cycle", unlocks: "Unlocks the Butchery", artKey: "swine-farm", offerMove: 1, offerPriority: 3, resource: "food", productionSeconds: 7, productionAmount: 1 }),
  bakery: building({ id: "bakery", name: "Bakery", description: "Turns the harvest into dependable meals.", benefit: "+2 food with a Farm", unlocks: "Strengthens the food chain", artKey: "bakery", offerMove: 2, offerPriority: 4, requiresAll: ["farm"], resource: "food", productionSeconds: 7, productionAmount: 1 }),
  sawmill: building({ id: "sawmill", name: "Sawmill", description: "Cuts timber into construction-ready planks.", benefit: "+2 planks with a Woodcutter", unlocks: "Accelerates future construction", artKey: "sawmill", offerMove: 2, offerPriority: 5, requiresAll: ["woodcutter"], resource: "planks", productionSeconds: 7, productionAmount: 1 }),
  butchery: building({ id: "butchery", name: "Butchery", description: "Processes livestock into a stronger food supply.", benefit: "+2 food with a Swine Farm", unlocks: "Completes the livestock chain", artKey: "butchery", offerMove: 2, offerPriority: 6, requiresAll: ["swine-farm"], resource: "food", productionSeconds: 7, productionAmount: 1 }),
  "fruit-orchard": building({ id: "fruit-orchard", name: "Fruit Orchard", description: "Rows of fruit trees broaden the harvest.", benefit: "+1 fruit per cycle", unlocks: "Unlocks the Winery", artKey: "fruit-orchard", offerMove: 3, offerPriority: 7, resource: "fruit", productionSeconds: 7, productionAmount: 1 }),
  winery: building({ id: "winery", name: "Winery", description: "Presses orchard fruit into valuable wine.", benefit: "+2 wine with an Orchard", unlocks: "Creates a trade luxury", artKey: "winery", offerMove: 3, offerPriority: 8, requiresAll: ["fruit-orchard"], resource: "wine", productionSeconds: 8, productionAmount: 1 }),
  quarry: building({ id: "quarry", name: "Quarry", description: "Extracts stone for lasting civic works.", benefit: "+1 stone per cycle", unlocks: "Unlocks the Blacksmith", artKey: "quarry", offerMove: 3, offerPriority: 9, resource: "stone", productionSeconds: 7, productionAmount: 1 }),
  house: building({ id: "house", name: "House", description: "A permanent home marks the settlement's growth.", benefit: "Supports the growing population", unlocks: "Adds a residential district", artKey: "house", offerMove: 3, offerPriority: 10 }),
  granary: building({ id: "granary", name: "Granary", description: "Stores the harvest safely between seasons.", benefit: "+1 grain per cycle", unlocks: "Secures the food economy", artKey: "granary", offerMove: 4, offerPriority: 11, requiresAny: ["farm", "fruit-orchard"], resource: "grain", productionSeconds: 8, productionAmount: 1 }),
  marketplace: building({ id: "marketplace", name: "Marketplace", description: "A lively square converts activity into wealth.", benefit: "+1 wealth per cycle", unlocks: "Establishes local trade", artKey: "marketplace", offerMove: 4, offerPriority: 12, resource: "wealth", productionSeconds: 8, productionAmount: 1 }),
  blacksmith: building({ id: "blacksmith", name: "Blacksmith", description: "Stone-built forges turn ore into useful tools.", benefit: "+1 tools per cycle", unlocks: "Unlocks the Weapons Workshop", artKey: "blacksmith", offerMove: 4, offerPriority: 13, requiresAll: ["quarry"], resource: "tools", productionSeconds: 9, productionAmount: 1 }),
  "weapons-workshop": building({ id: "weapons-workshop", name: "Weapons Workshop", description: "Specialist smiths prepare the settlement's arms.", benefit: "+2 arms with a Blacksmith", unlocks: "Unlocks the Barracks", artKey: "weapons-workshop", offerMove: 5, offerPriority: 14, requiresAll: ["blacksmith"], resource: "arms", productionSeconds: 9, productionAmount: 1 }),
  barracks: building({ id: "barracks", name: "Barracks", description: "A disciplined garrison protects the growing town.", benefit: "+2 defense with a Weapons Workshop", unlocks: "Completes the military chain", artKey: "barracks", offerMove: 6, offerPriority: 15, requiresAll: ["weapons-workshop"], resource: "defense", productionSeconds: 10, productionAmount: 1 }),
};

export const OPENING_BUILD_OPTIONS = ["woodcutter", "farm", "swine-farm"];

export function isBuildingEligible(definition: BuildingDefinition, builtIds: string[], move: number): boolean {
  if (move < definition.offerMove) return false;
  if (definition.requiresAll && !definition.requiresAll.every((id) => builtIds.includes(id))) return false;
  if (definition.requiresAny && !definition.requiresAny.some((id) => builtIds.includes(id))) return false;
  return true;
}

export function nextBuildingOffer(
  builtIds: string[],
  currentOptions: string[],
  move: number,
  lastBuiltId: string,
): string | undefined {
  const unavailable = new Set([...builtIds, ...currentOptions]);
  return Object.values(BUILDINGS)
    .filter((candidate) => !unavailable.has(candidate.id) && isBuildingEligible(candidate, builtIds, move))
    .sort((a, b) => {
      const aDirect = [...(a.requiresAll ?? []), ...(a.requiresAny ?? [])].includes(lastBuiltId) ? 0 : 1;
      const bDirect = [...(b.requiresAll ?? []), ...(b.requiresAny ?? [])].includes(lastBuiltId) ? 0 : 1;
      return aDirect - bDirect || a.offerMove - b.offerMove || a.offerPriority - b.offerPriority;
    })[0]?.id;
}

export function populationForLevel(level: number): number {
  return 1 + (level * (level + 1)) / 2;
}

export const CIVIC_LEVEL_NAMES = [
  "Founding Campsite",
  "Gathering Place",
  "Timber Enclosure",
  "Village Green",
  "Council Lodge",
  "Civic Hall",
  "Town Chamber",
  "Great Hall",
  "Grand Town Hall",
];

export const RESOURCE_LABELS: Record<ResourceName, string> = {
  wood: "Wood", grain: "Grain", food: "Food", stone: "Stone", planks: "Planks", wealth: "Wealth",
  tools: "Tools", fruit: "Fruit", wine: "Wine", arms: "Arms", defense: "Defense",
};

export const HARVEST_PHASES = [
  { name: "travel", duration: 2.5 },
  { name: "chop", duration: 2.2 },
  { name: "fall", duration: 0.8 },
  { name: "pickup", duration: 1.1 },
  { name: "carry", duration: 2.8 },
  { name: "deposit", duration: 1.1 },
] as const;
