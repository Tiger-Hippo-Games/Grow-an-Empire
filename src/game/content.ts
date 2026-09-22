export type HarvestPhaseName = "travel" | "chop" | "fall" | "pickup" | "carry" | "deliver" | "stockpile";

export interface HarvestPhaseDefinition {
  name: HarvestPhaseName;
  label: string;
  duration: number;
}

export type BuildingStatus = "implemented" | "art-ready" | "planned" | "reserved";

export interface BuildingDefinition {
  id: string;
  name: string;
  introducedOnMove: number;
  description: string;
  benefit: string;
  unlocks: string[];
  replaces?: string;
  status: BuildingStatus;
  artKey?: string;
}

export const BUILDINGS: Record<string, BuildingDefinition> = {
  campsite: { id: "campsite", name: "Campsite", introducedOnMove: 0, description: "The settlement core and future seat of government.", benefit: "Begins the settlement", unlocks: ["population", "build-orders"], status: "implemented", artKey: "campsite" },
  woodcutter: { id: "woodcutter", name: "Woodcutter", introducedOnMove: 1, description: "Establishes a renewable timber supply.", benefit: "Automatic wood production", unlocks: ["wood-production"], status: "implemented", artKey: "woodcutter" },
  farm: { id: "farm", name: "Farm", introducedOnMove: 1, description: "Plants the settlement's first reliable grain crop.", benefit: "Automatic grain production", unlocks: ["grain-production", "bakery"], status: "art-ready", artKey: "farm" },
  "swine-farm": { id: "swine-farm", name: "Swine Farm", introducedOnMove: 1, description: "Raises livestock to keep the settlement fed.", benefit: "Automatic food production", unlocks: ["food-production"], status: "art-ready", artKey: "swine-farm" },
  bakery: { id: "bakery", name: "Bakery", introducedOnMove: 2, description: "Turns grain into bread and makes the town more resilient.", benefit: "Improves food value", unlocks: ["bread-production"], status: "planned" },
  quarry: { id: "quarry", name: "Quarry", introducedOnMove: 3, description: "Cuts durable stone for stronger civic buildings.", benefit: "Automatic stone production", unlocks: ["stone-production"], status: "planned" },
  house: { id: "house", name: "House", introducedOnMove: 4, description: "Gives new families a permanent home in the settlement.", benefit: "Increases population capacity", unlocks: ["population-growth"], status: "planned" },
  sawmill: { id: "sawmill", name: "Sawmill", introducedOnMove: 5, description: "Processes timber into valuable construction materials.", benefit: "Multiplies wood output", unlocks: ["plank-production"], status: "planned" },
  granary: { id: "granary", name: "Granary", introducedOnMove: 6, description: "Stores harvests safely through lean seasons.", benefit: "Protects and expands food storage", unlocks: ["food-storage"], status: "planned" },
  marketplace: { id: "marketplace", name: "Marketplace", introducedOnMove: 7, description: "Creates a center for exchange, visitors, and town wealth.", benefit: "Unlocks commerce", unlocks: ["commerce"], status: "planned" },
  blacksmith: { id: "blacksmith", name: "Blacksmith", introducedOnMove: 8, description: "Forges the tools needed by a growing town.", benefit: "Improves every basic industry", unlocks: ["tools"], status: "planned" },
  townHall: { id: "town-hall", name: "Town Hall", introducedOnMove: 8, description: "Transforms the original campsite into the civic center.", benefit: "Advances the settlement to town tier", unlocks: ["town-tier"], replaces: "campsite", status: "reserved" },
};

export const OPENING_BUILD_OPTIONS = ["woodcutter", "farm", "swine-farm"] as const;

/** One new card joins the two unchosen cards on each move. */
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

export const OPENING_BUILD_ID = OPENING_BUILD_OPTIONS[0];
export const CONSTRUCTION_DURATION_SECONDS = 12;

export const HARVEST_PHASES: HarvestPhaseDefinition[] = [
  { name: "travel", label: "Woodcutter walking to the forest", duration: 2.4 },
  { name: "chop", label: "Woodcutter harvesting timber", duration: 2.4 },
  { name: "fall", label: "Tree falling", duration: 1.05 },
  { name: "pickup", label: "Collecting the felled log", duration: 0.9 },
  { name: "carry", label: "Carrying timber to the lodge", duration: 2.5 },
  { name: "deliver", label: "Delivering timber", duration: 0.8 },
  { name: "stockpile", label: "Wood added to settlement stores", duration: 0.75 },
];
