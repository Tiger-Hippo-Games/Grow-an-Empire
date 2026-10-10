/**
 * Static game content: the building catalog, the offer rules that decide which
 * three cards the player sees, the population curve, and display labels.
 *
 * Everything in this file is pure data or pure functions: no DOM, no Three.js,
 * no mutable state. That is what lets the test suite enumerate every possible
 * build order exhaustively.
 */

import {
  BUILDING_COSTS, formatBag, HOUSE_PEOPLE_PER_MOVE, PROCESSORS, RAW_OUTPUT, SOLDIERS, TRAINING_BASE,
  type ResourceBag, type ResourceName,
} from "./economy";

export { RESOURCE_LABELS, type ResourceName } from "./economy";

/** Moves in a campaign that doesn't set its own (`CampaignSeed.moves`). Read `campaign.moveLimit`, never assume 12. */
export const TOTAL_MOVES = 12;
/**
 * Longest campaign. Campaigns may set 8–12 moves; longer ones are clamped.
 * Raising it needs more `CIVIC_LEVEL_NAMES` (one per level), civic-centre art
 * for the new levels and an offer-path test at the new length.
 */
export const MAX_CAMPAIGN_MOVES = 12;
/** One civic level per completed move, plus the founding campsite. */
export const TOTAL_SETTLEMENT_LEVELS = MAX_CAMPAIGN_MOVES + 1;
/** Simulation seconds each construction takes at 1x speed. */
export const CONSTRUCTION_DURATION_SECONDS = 30;

/**
 * One entry in the building catalog.
 *
 * Offer rules: a building can only appear as a card once `move >= offerMove`
 * and its prerequisites are met (`requiresAll`: every listed building is built;
 * `requiresAny`: at least one is). `offerPriority` is the unique tie-breaker
 * when several buildings are eligible at once (lower = offered first).
 *
 * `benefit` is generated from the numbers in `economy.ts`, so the card text can
 * never drift from the rules. `unlocks` is hand-written flavour.
 */
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
  /** Paid when construction starts (economy.ts). */
  cost: ResourceBag;
}

/** Identity helper: gives each catalog entry full type checking without widening the record. */
function building(definition: Omit<BuildingDefinition, "cost" | "benefit"> & { benefit?: string }): BuildingDefinition {
  return { ...definition, cost: BUILDING_COSTS[definition.id] ?? {}, benefit: definition.benefit ?? benefitText(definition.id) };
}

/** Card text for what a building does each move, from the economy's numbers. */
export function benefitText(id: string): string {
  const raw = RAW_OUTPUT[id];
  if (raw) return `+${raw[1]} ${raw[0]} each move, growing with age`;
  const processor = PROCESSORS.find((entry) => entry.id === id);
  if (processor) return `Up to ${processor.cycles} × (${formatBag(processor.input)} → ${formatBag(processor.output)}) a move`;
  const soldier = Object.values(SOLDIERS).find((entry) => entry.building === id);
  if (soldier) return `Trains ${TRAINING_BASE} ${soldier.singular} a move for ${formatBag(soldier.cost)} and a villager`;
  switch (id) {
    case "house": return `+${HOUSE_PEOPLE_PER_MOVE} people for every move it stands`;
    case "granary": return "+1 grain a move; stops grain spoiling";
    case "marketplace": return "Sells soma for gold; swaps goods when you're stuck";
    case "barracks": return "+1 soldier a move at every military building";
    default: return "";
  }
}

export const BUILDINGS: Record<string, BuildingDefinition> = {
  woodcutter: building({ id: "woodcutter", name: "Woodcutter's Hut", description: "A forest camp that cuts sal and teak timber.", unlocks: "Unlocks the Carpenter's Yard", artKey: "woodcutter", offerMove: 1, offerPriority: 1, resource: "wood" }),
  farm: building({ id: "farm", name: "Farm", description: "Paddy fields provide grain for the settlement.", unlocks: "Opens the Granary, Mango Grove and Goshala", artKey: "farm", offerMove: 1, offerPriority: 2, resource: "grain" }),
  "swine-farm": building({ id: "swine-farm", name: "Goshala", description: "A cattle shed; the herd gives milk for ghee.", unlocks: "Unlocks the Ghee House", artKey: "swine-farm", offerMove: 2, offerPriority: 3, requiresAll: ["farm"], resource: "livestock" }),
  bakery: building({ id: "bakery", name: "Royal Kitchen", description: "The royal kitchen turns grain into rotis for the army.", unlocks: "Rations feed the army: 1 per 4 soldiers", artKey: "bakery", offerMove: 4, offerPriority: 4, requiresAll: ["farm", "sawmill", "quarry"], resource: "rations" }),
  sawmill: building({ id: "sawmill", name: "Carpenter's Yard", description: "Carpenters cut timber into construction-ready planks.", unlocks: "Enables archers and industry", artKey: "sawmill", offerMove: 2, offerPriority: 5, requiresAll: ["woodcutter"], resource: "planks" }),
  butchery: building({ id: "butchery", name: "Ghee House", description: "Churns milk into ghee, the army's best provision.", unlocks: "More rations for a bigger army", artKey: "butchery", offerMove: 3, offerPriority: 6, requiresAll: ["swine-farm", "sawmill"], resource: "rations" }),
  "fruit-orchard": building({ id: "fruit-orchard", name: "Mango Grove", description: "Mango trees broaden the harvest.", unlocks: "Unlocks the Soma Press", artKey: "fruit-orchard", offerMove: 2, offerPriority: 7, requiresAll: ["farm"], resource: "fruit" }),
  winery: building({ id: "winery", name: "Soma Press", description: "Presses fruit into soma, prized in every bazaar.", unlocks: "Soma sells for 5 gold", artKey: "winery", offerMove: 4, offerPriority: 8, requiresAll: ["farm", "sawmill", "quarry"], resource: "wine" }),
  quarry: building({ id: "quarry", name: "Quarry", description: "Cuts stone for forts and temples.", unlocks: "With Carpenter's Yard, opens stone buildings", artKey: "quarry", offerMove: 1, offerPriority: 9, resource: "stone" }),
  house: building({ id: "house", name: "House", description: "A family home brings more people into the settlement.", unlocks: "More recruits and militia", artKey: "house", offerMove: 3, offerPriority: 13, requiresAll: ["sawmill", "quarry"] }),
  granary: building({ id: "granary", name: "Granary", description: "A timber kothar on a stone base stores the harvest safely between monsoons.", unlocks: "Secures the food economy", artKey: "granary", offerMove: 2, offerPriority: 14, requiresAny: ["farm", "fruit-orchard"], resource: "grain" }),
  marketplace: building({ id: "marketplace", name: "Bazaar", description: "A busy haat turns surplus goods into gold.", unlocks: "Hires sellswords before the battle", artKey: "marketplace", offerMove: 4, offerPriority: 12, requiresAll: ["farm", "butchery"], resource: "gold" }),
  blacksmith: building({ id: "blacksmith", name: "Lohar Forge", description: "The lohar's forge arms and trains swordsmen.", unlocks: "Swordsmen stop a cavalry charge", artKey: "blacksmith", offerMove: 3, offerPriority: 11, requiresAll: ["sawmill", "quarry"], resource: "planks" }),
  "weapons-workshop": building({ id: "weapons-workshop", name: "Bow Hall", description: "Bowyers string bows and train archers.", unlocks: "Archers counter a swordsman horde", artKey: "weapons-workshop", offerMove: 3, offerPriority: 10, requiresAll: ["sawmill", "quarry"], resource: "planks" }),
  barracks: building({ id: "barracks", name: "Akhara", description: "The akhara drills every kind of soldier faster.", unlocks: "Stations the city's defenders", artKey: "barracks", offerMove: 3, offerPriority: 15, requiresAll: ["sawmill", "quarry"], resource: "rations" }),
  stable: building({ id: "stable", name: "Ashvashala", description: "Warhorses and riders train for a cavalry charge.", unlocks: "Horsemen ride down archers", artKey: "stable", offerMove: 5, offerPriority: 16, requiresAll: ["blacksmith", "weapons-workshop"], resource: "rations" }),
};

/** The three cards offered on Move 1 of every run. */
export const OPENING_BUILD_OPTIONS = ["woodcutter", "farm", "quarry"];

/**
 * Whether `definition` may be offered on `move`, given the buildings already built.
 * Does not check whether it is already built or already on offer; callers do that.
 */
export function isBuildingEligible(definition: BuildingDefinition, builtIds: string[], move: number): boolean {
  if (move < definition.offerMove) return false;
  if (definition.requiresAll && !definition.requiresAll.every((id) => builtIds.includes(id))) return false;
  if (definition.requiresAny && !definition.requiresAny.some((id) => builtIds.includes(id))) return false;
  return true;
}

/**
 * Picks the single building that refills the offer pool after a construction
 * completes (the pool is "rolling": the chosen card leaves, one new card arrives).
 *
 * Ranking, in order:
 *   1. Granary immediately after a farm or orchard; Akhara once a military workshop exists, then military workshops once
 *      their stone and timber prerequisites are ready;
 *   2. buildings that directly depend on the one just built;
 *   3. earliest `offerMove`, then lowest `offerPriority`.
 *
 * @param builtIds       buildings already constructed this run
 * @param currentOptions cards still on offer (never duplicated)
 * @param move           the move the new card is for
 * @param lastBuiltId    the building that just completed
 * @param allowedIds     optional campaign whitelist; buildings outside it are skipped
 *                       (rather than the whole offer being dropped)
 * @returns the building id to add, or `undefined` if nothing is eligible
 */
export function nextBuildingOffer(
  builtIds: string[],
  currentOptions: string[],
  move: number,
  lastBuiltId: string,
  allowedIds?: readonly string[],
): string | undefined {
  const unavailable = new Set([...builtIds, ...currentOptions]);
  const allowed = allowedIds ? new Set(allowedIds) : null;
  return Object.values(BUILDINGS)
    .filter((candidate) => !unavailable.has(candidate.id)
      && (!allowed || allowed.has(candidate.id))
      && isBuildingEligible(candidate, builtIds, move))
    .sort((a, b) => {
      const urgency = (id: string): number => id === "granary" && (lastBuiltId === "farm" || lastBuiltId === "fruit-orchard") ? -1
        : id === "stable" || id === "barracks" && builtIds.some((built) => built === "blacksmith" || built === "weapons-workshop")
        ? 0 : id === "blacksmith" || id === "weapons-workshop" ? 1 : 2;
      const priority = urgency(a.id) - urgency(b.id);
      if (priority) return priority;
      const aDirect = [...(a.requiresAll ?? []), ...(a.requiresAny ?? [])].includes(lastBuiltId) ? 0 : 1;
      const bDirect = [...(b.requiresAll ?? []), ...(b.requiresAny ?? [])].includes(lastBuiltId) ? 0 : 1;
      return aDirect - bDirect || a.offerMove - b.offerMove || a.offerPriority - b.offerPriority;
    })[0]?.id;
}

/** True when `id` is a key of the building catalog. Used to reject stale or tampered saves. */
export function isKnownBuildingId(id: unknown): id is string {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(BUILDINGS, id);
}

/**
 * Base population at a civic level: 1, 2, 4, 7, 11, … for levels 0–12
 * (one founder plus the triangular number of the level). A House adds a bonus on top;
 * see `resolveMoveEconomy` in settlementSimulation.ts.
 */
export function populationForLevel(level: number): number {
  return 1 + (level * (level + 1)) / 2;
}

/** Display name for each civic level, indexed by level (0 to MAX_CAMPAIGN_MOVES). */
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
  "Stone Council",
  "Defenders' Square",
  "Fortified Borough",
  "Grand Muster Hall",
];


/**
 * Timing (seconds of animation time) of the Woodcutter's visual harvest loop.
 * Purely cosmetic: production is resolved once per move, not by this loop.
 */
export const HARVEST_PHASES = [
  { name: "travel", duration: 2.5 },
  { name: "chop", duration: 2.2 },
  { name: "fall", duration: 0.8 },
  { name: "pickup", duration: 1.1 },
  { name: "carry", duration: 2.8 },
  { name: "deposit", duration: 1.1 },
] as const;
