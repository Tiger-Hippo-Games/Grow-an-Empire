export type HarvestPhaseName = "travel" | "chop" | "fall" | "pickup" | "carry" | "deliver" | "stockpile";

export interface HarvestPhaseDefinition {
  name: HarvestPhaseName;
  label: string;
  duration: number;
}

export interface BuildingDefinition {
  id: string;
  name: string;
  move: number;
  description: string;
  unlocks: string[];
  replaces?: string;
  status: "implemented" | "reserved";
}

export const BUILDINGS: Record<string, BuildingDefinition> = {
  campsite: {
    id: "campsite",
    name: "Campsite",
    move: 0,
    description: "The settlement core and future seat of government.",
    unlocks: ["population", "build-orders"],
    status: "implemented",
  },
  woodcutter: {
    id: "woodcutter",
    name: "Woodcutter",
    move: 1,
    description: "Establishes a renewable timber supply.",
    unlocks: ["wood-production"],
    status: "implemented",
  },
  townHall: {
    id: "town-hall",
    name: "Town Hall",
    move: 8,
    description: "Transforms the original campsite into the civic center.",
    unlocks: ["town-tier"],
    replaces: "campsite",
    status: "reserved",
  },
};

export const OPENING_BUILD_ID = "woodcutter";
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
