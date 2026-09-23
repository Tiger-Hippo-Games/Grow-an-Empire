/**
 * Static game content: the building catalog, the offer rules that decide which
 * three cards the player sees, the population curve, and display labels.
 *
 * Everything in this file is pure data or pure functions: no DOM, no Three.js,
 * no mutable state. That is what lets the test suite enumerate every possible
 * build order exhaustively.
 */

/** Number of building decisions in one campaign run. */
export const TOTAL_MOVES = 12;
/** One civic level per completed move, plus the founding campsite. */
export const TOTAL_SETTLEMENT_LEVELS = TOTAL_MOVES + 1;
/** Simulation seconds each construction takes at 1x speed. */
export const CONSTRUCTION_DURATION_SECONDS = 30;

export type ResourceName =
  | "wood"
  | "grain"
  | "livestock"
  | "rations"
  | "stone"
  | "planks"
  | "wealth"
  | "tools"
  | "fruit"
  | "wine"
  | "arms"
  | "training"
  | "defense";

/**
 * One entry in the building catalog.
 *
 * Offer rules: a building can only appear as a card once `move >= offerMove`
 * and its prerequisites are met (`requiresAll`: every listed building is built;
 * `requiresAny`: at least one is). `offerPriority` is the unique tie-breaker
 * when several buildings are eligible at once (lower = offered first).
 *
 * `benefit` / `unlocks` are player-facing card text only. The real production
 * math lives in `SettlementSimulation.resolveMoveEconomy()`; keep the two in sync.
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
}

/** Identity helper: gives each catalog entry full type checking without widening the record. */
function building(definition: BuildingDefinition): BuildingDefinition {
  return definition;
}

export const BUILDINGS: Record<string, BuildingDefinition> = {
  woodcutter: building({ id: "woodcutter", name: "Woodcutter's Hut", description: "A forest camp that steadily gathers timber.", benefit: "+2 wood each move", unlocks: "Unlocks the Sawmill", artKey: "woodcutter", offerMove: 1, offerPriority: 1, resource: "wood" }),
  farm: building({ id: "farm", name: "Farm", description: "Cultivated fields provide grain for the settlement.", benefit: "+2 grain each move", unlocks: "Opens the Orchard and Swine Farm", artKey: "farm", offerMove: 1, offerPriority: 2, resource: "grain" }),
  "swine-farm": building({ id: "swine-farm", name: "Swine Farm", description: "Raises livestock for a reliable food chain.", benefit: "+2 livestock each move", unlocks: "Unlocks the Butchery", artKey: "swine-farm", offerMove: 2, offerPriority: 3, requiresAll: ["farm"], resource: "livestock" }),
  bakery: building({ id: "bakery", name: "Bakery", description: "Turns stored grain into dependable campaign rations.", benefit: "2 grain → 3 rations", unlocks: "Feeds recruits and armies", artKey: "bakery", offerMove: 4, offerPriority: 4, requiresAll: ["farm", "sawmill", "quarry"], resource: "rations" }),
  sawmill: building({ id: "sawmill", name: "Sawmill", description: "Cuts timber into construction-ready planks.", benefit: "2 wood → 3 planks", unlocks: "Enables archers and industry", artKey: "sawmill", offerMove: 2, offerPriority: 5, requiresAll: ["woodcutter"], resource: "planks" }),
  butchery: building({ id: "butchery", name: "Butchery", description: "Preserves livestock into durable army provisions.", benefit: "1 livestock → 3 rations", unlocks: "Completes the livestock chain", artKey: "butchery", offerMove: 3, offerPriority: 6, requiresAll: ["swine-farm", "sawmill"], resource: "rations" }),
  "fruit-orchard": building({ id: "fruit-orchard", name: "Fruit Orchard", description: "Rows of fruit trees broaden the harvest.", benefit: "+2 fruit each move", unlocks: "Unlocks the Winery", artKey: "fruit-orchard", offerMove: 2, offerPriority: 7, requiresAll: ["farm"], resource: "fruit" }),
  winery: building({ id: "winery", name: "Winery", description: "Presses orchard fruit into valuable wine.", benefit: "2 fruit → 2 wine", unlocks: "Raises morale and trade value", artKey: "winery", offerMove: 4, offerPriority: 8, requiresAll: ["farm", "sawmill", "quarry"], resource: "wine" }),
  quarry: building({ id: "quarry", name: "Quarry", description: "Extracts stone for lasting civic works.", benefit: "+2 stone and defense each move", unlocks: "With Sawmill, opens stone buildings", artKey: "quarry", offerMove: 1, offerPriority: 9, resource: "stone" }),
  house: building({ id: "house", name: "House", description: "A permanent home brings more people into the settlement.", benefit: "+2 people each level after building", unlocks: "More recruits at the final muster", artKey: "house", offerMove: 3, offerPriority: 13, requiresAll: ["sawmill", "quarry"] }),
  granary: building({ id: "granary", name: "Granary", description: "Stores the harvest safely between seasons.", benefit: "+1 grain and prevents spoilage", unlocks: "Secures the food economy", artKey: "granary", offerMove: 4, offerPriority: 14, requiresAll: ["farm", "sawmill", "quarry"], resource: "grain" }),
  marketplace: building({ id: "marketplace", name: "Marketplace", description: "A lively square converts surplus goods into wealth.", benefit: "Wine or planks → wealth", unlocks: "Enables mercenaries", artKey: "marketplace", offerMove: 4, offerPriority: 12, requiresAll: ["farm", "butchery"], resource: "wealth" }),
  blacksmith: building({ id: "blacksmith", name: "Blacksmith", description: "Stone-built forges turn materials into useful tools.", benefit: "+1 swordsman each move", unlocks: "Forges tools for the settlement", artKey: "blacksmith", offerMove: 3, offerPriority: 11, requiresAll: ["sawmill", "quarry"], resource: "tools" }),
  "weapons-workshop": building({ id: "weapons-workshop", name: "Weapons Workshop", description: "Specialist smiths prepare standardized arms.", benefit: "+1 archer each move", unlocks: "Forges arms for the reserve", artKey: "weapons-workshop", offerMove: 3, offerPriority: 10, requiresAll: ["sawmill", "quarry"], resource: "arms" }),
  barracks: building({ id: "barracks", name: "Barracks", description: "A disciplined garrison trains recruits every remaining move.", benefit: "+3 training and +2 defense each move", unlocks: "Stations the city's defenders", artKey: "barracks", offerMove: 3, offerPriority: 15, requiresAll: ["sawmill", "quarry"], resource: "training" }),
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
 *   1. Barracks once a military workshop exists, then military workshops once
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
      const urgency = (id: string): number => id === "barracks" && builtIds.some((built) => built === "blacksmith" || built === "weapons-workshop")
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
 * Base population at a civic level: 1, 2, 4, 7, 11, 16, 22, 29, 37 for levels 0–8
 * (one founder plus the triangular number of the level). A House adds a bonus on top;
 * see `SettlementSimulation.update()`.
 */
export function populationForLevel(level: number): number {
  return 1 + (level * (level + 1)) / 2;
}

/** Display name for each civic level, indexed by level (0–8). */
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

/** Player-facing label for each resource. Its key order is also the HUD stockpile order. */
export const RESOURCE_LABELS: Record<ResourceName, string> = {
  wood: "Wood", grain: "Grain", livestock: "Livestock", rations: "Rations", stone: "Stone", planks: "Planks",
  wealth: "Wealth", tools: "Tools", fruit: "Fruit", wine: "Wine", arms: "Arms", training: "Training", defense: "Defense",
};

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
