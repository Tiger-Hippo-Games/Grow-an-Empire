export type ResourceName = "wood" | "grain" | "food" | "stone" | "planks" | "wealth" | "tools";
export type HarvestPhaseName = "travel" | "chop" | "fall" | "pickup" | "carry" | "deliver" | "stockpile";

export interface HarvestPhaseDefinition {
  name: HarvestPhaseName;
  label: string;
  duration: number;
}

export interface BuildingDefinition {
  id: string;
  name: string;
  introducedOnMove: number;
  description: string;
  benefit: string;
  unlocks: string[];
  artKey: string;
  resource?: ResourceName;
  productionSeconds?: number;
  productionAmount?: number;
  populationGain?: number;
}

export const BUILDINGS: Record<string, BuildingDefinition> = {
  woodcutter: { id: "woodcutter", name: "Woodcutter", introducedOnMove: 1, description: "Establishes a renewable timber supply.", benefit: "Produces wood", unlocks: ["wood-production"], artKey: "woodcutter", resource: "wood", productionSeconds: 9, productionAmount: 1 },
  farm: { id: "farm", name: "Farm", introducedOnMove: 1, description: "Plants the settlement's first reliable grain crop.", benefit: "Produces grain", unlocks: ["grain-production", "bakery"], artKey: "farm", resource: "grain", productionSeconds: 10, productionAmount: 1 },
  "swine-farm": { id: "swine-farm", name: "Swine Farm", introducedOnMove: 1, description: "Raises livestock to keep the settlement fed.", benefit: "Produces food", unlocks: ["food-production"], artKey: "swine-farm", resource: "food", productionSeconds: 11, productionAmount: 1 },
  bakery: { id: "bakery", name: "Bakery", introducedOnMove: 2, description: "Turns local grain into nourishing bread.", benefit: "Produces food; stronger with a Farm", unlocks: ["bread-production"], artKey: "bakery", resource: "food", productionSeconds: 9, productionAmount: 1 },
  quarry: { id: "quarry", name: "Quarry", introducedOnMove: 3, description: "Cuts durable stone for civic construction.", benefit: "Produces stone", unlocks: ["stone-production"], artKey: "quarry", resource: "stone", productionSeconds: 12, productionAmount: 1 },
  house: { id: "house", name: "House", introducedOnMove: 4, description: "Gives new families a permanent home.", benefit: "+3 population", unlocks: ["population-growth"], artKey: "house", populationGain: 3 },
  sawmill: { id: "sawmill", name: "Sawmill", introducedOnMove: 5, description: "Processes timber into construction planks.", benefit: "Produces planks; stronger with Woodcutter", unlocks: ["plank-production"], artKey: "sawmill", resource: "planks", productionSeconds: 10, productionAmount: 1 },
  granary: { id: "granary", name: "Granary", introducedOnMove: 6, description: "Stores harvests safely through lean seasons.", benefit: "Produces and protects food", unlocks: ["food-storage"], artKey: "granary", resource: "food", productionSeconds: 12, productionAmount: 1 },
  marketplace: { id: "marketplace", name: "Marketplace", introducedOnMove: 7, description: "Creates a center for exchange and town wealth.", benefit: "Produces wealth", unlocks: ["commerce"], artKey: "marketplace", resource: "wealth", productionSeconds: 11, productionAmount: 1 },
  blacksmith: { id: "blacksmith", name: "Blacksmith", introducedOnMove: 8, description: "Forges better tools for every industry.", benefit: "Produces tools and accelerates industry", unlocks: ["tools"], artKey: "blacksmith", resource: "tools", productionSeconds: 13, productionAmount: 1 },
};

export const OPENING_BUILD_OPTIONS = ["woodcutter", "farm", "swine-farm"] as const;
export const BUILD_INTRODUCTION_BY_MOVE: Readonly<Record<number, readonly string[]>> = {
  1: OPENING_BUILD_OPTIONS,
  2: ["bakery"],
  3: ["quarry"],
  4: ["house"],
  5: ["sawmill"],
  6: ["granary"],
  7: ["marketplace"],
  8: ["blacksmith"],
};

export const TOTAL_MOVES = 8;
export const TOTAL_SETTLEMENT_LEVELS = 9;
export const CONSTRUCTION_DURATION_SECONDS = 30;

export const CIVIC_LEVEL_NAMES = [
  "Founding Campsite",
  "Organized Camp",
  "Meeting Ground",
  "Village Hall Frame",
  "Village Hall",
  "Expanded Civic Hall",
  "Rising Town Hall",
  "Town Hall Precinct",
  "Grand Town Hall",
] as const;

export const RESOURCE_LABELS: Record<ResourceName, string> = {
  wood: "Wood",
  grain: "Grain",
  food: "Food",
  stone: "Stone",
  planks: "Planks",
  wealth: "Wealth",
  tools: "Tools",
};

export const HARVEST_PHASES: HarvestPhaseDefinition[] = [
  { name: "travel", label: "Woodcutter walking to the forest", duration: 2.4 },
  { name: "chop", label: "Woodcutter harvesting timber", duration: 2.4 },
  { name: "fall", label: "Tree falling", duration: 1.05 },
  { name: "pickup", label: "Collecting the felled log", duration: 0.9 },
  { name: "carry", label: "Carrying timber to the lodge", duration: 2.5 },
  { name: "deliver", label: "Delivering timber", duration: 0.8 },
  { name: "stockpile", label: "Wood added to settlement stores", duration: 0.75 },
];
