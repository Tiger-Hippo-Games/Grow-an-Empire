import { CAMPAIGN_1, type CampaignDefinition } from "./campaigns";
import {
  CONSTRUCTION_DURATION_SECONDS,
  BUILDINGS,
  isBuildingEligible,
  isKnownBuildingId,
  nextBuildingOffer,
  OPENING_BUILD_OPTIONS,
  populationForLevel,
  RESOURCE_LABELS,
  TOTAL_SETTLEMENT_LEVELS,
  type ResourceName,
} from "./content";

/*
 * The authoritative game rules. `SettlementSimulation` owns all gameplay state
 * and is advanced only through `chooseBuilding()` and `update()`. Each returns
 * a list of `SimulationEvent`s describing what changed, and the render/UI
 * layers react to those events. Nothing here knows about the DOM or Three.js,
 * so it is fully unit-testable.
 *
 * Lifecycle of one move:
 *   awaiting-choice --chooseBuilding()--> construction --update() x N--> (30s elapsed)
 *     -> building completes, civic level rises, economy resolves, population grows
 *     -> next card is offered (awaiting-choice) or, after the last move, the army
 *        musters and the run is complete.
 */

/** Top-level phase of a run. */
export type SimulationMode = "awaiting-choice" | "construction" | "complete";
export type CampaignOutcome = "Settlement Lost" | "Costly Survival" | "Victory" | "Decisive Victory" | "Flourishing Victory";
/** Stockpile of every resource. Always contains every key (missing keys from old saves are filled with 0). */
export type ResourceLedger = Record<ResourceName, number>;
/** Bump this when `SettlementState`'s shape changes incompatibly; older saves are then discarded. */
export const SAVE_SCHEMA_VERSION = 4 as const;

export interface TrainedUnits { archers: number; swordsmen: number; }

export interface ArmyUnits { militia: number; spearmen: number; archers: number; swordsmen: number; mercenaries: number; }
/** The end-of-campaign result, computed once by `assembleArmy()` when the final move completes. */
export interface ArmyReport {
  outcome: CampaignOutcome; score: number; enemyStrength: number; units: ArmyUnits; totalUnits: number;
  combatStrength: number; supplyTurns: number; cityDefense: number; morale: number; explanations: string[];
}
export interface BuildOrderEntry { move: number; buildingId: string; }

/**
 * Everything the render/UI layers need to react to. Events from one `update()`
 * call are always emitted in this order:
 * construction-complete, civic-upgraded, economy-resolved, unit-trained (if earned), population-changed (if it changed),
 * then either choices-ready or army-mustered + game-complete.
 */
export type SimulationEvent =
  | { type: "construction-started"; buildingId: string; plotIndex: number }
  | { type: "construction-complete"; buildingId: string; plotIndex: number }
  | { type: "civic-upgraded"; level: number }
  | { type: "choices-ready"; move: number; options: string[] }
  | { type: "economy-resolved"; activeBuildingIds: string[] }
  | { type: "population-changed"; total: number }
  | { type: "unit-trained"; units: TrainedUnits; newArchers: number; newSwordsmen: number }
  | { type: "army-mustered"; report: ArmyReport }
  | { type: "game-complete" };

/**
 * All mutable gameplay state. It is plain JSON (no class instances), which is
 * what makes `serialize()` / `loadSnapshot()` a simple deep copy.
 *
 * Invariants (enforced by `isValidSnapshot` for loaded saves):
 * - `mode === "construction"` implies `selectedBuildingId` and `activePlotIndex` are set;
 * - `activePlotIndex` equals `builtBuildingIds.length` (plots fill in build order);
 * - every building id is a known catalog id and is never built twice.
 */
export interface SettlementState {
  mode: SimulationMode; move: number; civicLevel: number; population: number; resources: ResourceLedger;
  builtBuildingIds: string[]; availableBuildingIds: string[]; selectedBuildingId: string | null;
  activePlotIndex: number | null; constructionElapsed: number; buildingMaturity: Record<string, number>;
  armyReport: ArmyReport | null;
  trainedUnits: TrainedUnits;
}

/** Versioned save-file wrapper around `SettlementState`. */
export interface SettlementSnapshot {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  savedAt: string;
  campaignId: string;
  state: SettlementState;
}

const emptyResources = (): ResourceLedger => ({
  wood: 0, grain: 0, livestock: 0, rations: 0, stone: 0, planks: 0, wealth: 0,
  tools: 0, fruit: 0, wine: 0, arms: 0, training: 0, defense: 0,
});

const createInitialState = (): SettlementState => ({
  mode: "awaiting-choice", move: 1, civicLevel: 0, population: 1, resources: emptyResources(),
  builtBuildingIds: [], availableBuildingIds: [...OPENING_BUILD_OPTIONS], selectedBuildingId: null,
  activePlotIndex: null, constructionElapsed: 0, buildingMaturity: {}, armyReport: null,
  trainedUnits: { archers: 0, swordsmen: 0 },
});

const clamp = (value: number, minimum: number, maximum: number): number => Math.max(minimum, Math.min(maximum, value));

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isKnownIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isKnownBuildingId) && new Set(value).size === value.length;

/**
 * Explains why `value` is not a loadable snapshot, or returns `null` if it is.
 *
 * This deliberately checks more than the shape: a save that parses fine but
 * references a building that no longer exists (e.g. after a rename), or is
 * "under construction" with nothing selected, would otherwise crash the
 * renderer on every page load and lock the player out. Rejecting it here lets
 * the game fall back to a fresh settlement instead.
 */
export function describeSnapshotProblem(value: unknown): string | null {
  if (!isPlainObject(value)) return "snapshot is not an object";
  if (value.schemaVersion !== SAVE_SCHEMA_VERSION) return `unsupported schema version ${String(value.schemaVersion)}`;
  if (typeof value.savedAt !== "string" || typeof value.campaignId !== "string") return "missing savedAt or campaignId";
  const state = value.state;
  if (!isPlainObject(state)) return "missing state";
  if (!["awaiting-choice", "construction", "complete"].includes(String(state.mode))) return `unknown mode ${String(state.mode)}`;
  if (!Number.isInteger(state.move) || (state.move as number) < 1) return "invalid move";
  if (!Number.isInteger(state.civicLevel) || (state.civicLevel as number) < 0 || (state.civicLevel as number) >= TOTAL_SETTLEMENT_LEVELS) return "invalid civic level";
  if (!Number.isFinite(state.population) || (state.population as number) < 0) return "invalid population";
  if (!isKnownIdList(state.builtBuildingIds)) return "builtBuildingIds contains unknown or duplicate buildings";
  if (!isKnownIdList(state.availableBuildingIds)) return "availableBuildingIds contains unknown or duplicate buildings";
  if (!isPlainObject(state.resources) || !Object.values(state.resources).every((amount) => Number.isFinite(amount))) return "invalid resources";
  if (!isPlainObject(state.buildingMaturity) || !Object.values(state.buildingMaturity).every((amount) => Number.isFinite(amount))) return "invalid buildingMaturity";
  if (!isPlainObject(state.trainedUnits) || !Number.isInteger(state.trainedUnits.archers) || (state.trainedUnits.archers as number) < 0 || !Number.isInteger(state.trainedUnits.swordsmen) || (state.trainedUnits.swordsmen as number) < 0) return "invalid trainedUnits";
  if (state.mode === "construction") {
    if (!isKnownBuildingId(state.selectedBuildingId)) return "construction without a known selected building";
    if (state.activePlotIndex !== state.builtBuildingIds.length) return "activePlotIndex does not match build order";
    if (state.builtBuildingIds.includes(state.selectedBuildingId)) return "selected building is already built";
    if (!Number.isFinite(state.constructionElapsed)) return "invalid constructionElapsed";
  }
  return null;
}

/** Type guard: true when `value` can be passed to `loadSnapshot()` safely. */
export function isValidSnapshot(value: unknown): value is SettlementSnapshot {
  return describeSnapshotProblem(value) === null;
}

/**
 * One campaign run. Create one per page; call `reset()` to start over.
 * All methods are synchronous and deterministic (no randomness, no clock),
 * so the same choices always produce the same city.
 */
export class SettlementSimulation {
  readonly state: SettlementState = createInitialState();
  constructor(readonly campaign: CampaignDefinition = CAMPAIGN_1) {}

  /** 0–1 fraction of the current construction; 0 when nothing is being built. */
  get constructionProgress(): number { return Math.min(1, this.state.constructionElapsed / CONSTRUCTION_DURATION_SECONDS); }

  /** Completed buildings in the order they were built (move 1 first). */
  buildOrderSummary(): BuildOrderEntry[] {
    return this.state.builtBuildingIds.map((buildingId, index) => ({ move: index + 1, buildingId }));
  }

  /** A deep, JSON-safe copy of the current state, suitable for localStorage. */
  serialize(): SettlementSnapshot {
    return { schemaVersion: SAVE_SCHEMA_VERSION, savedAt: new Date().toISOString(), campaignId: this.campaign.id, state: structuredClone(this.state) };
  }

  /**
   * Replaces the current state with a saved one.
   *
   * The loaded state is layered over a fresh initial state, so fields a save
   * lacks (and resource keys added after it was written) get their defaults
   * instead of leaking values from the previous run or becoming `undefined`.
   *
   * @throws Error if the snapshot is malformed or belongs to another campaign.
   *         The current state is left untouched in that case.
   */
  loadSnapshot(snapshot: SettlementSnapshot): void {
    const problem = describeSnapshotProblem(snapshot);
    if (problem) throw new Error(`Invalid or unsupported settlement snapshot: ${problem}`);
    if (snapshot.campaignId !== this.campaign.id) throw new Error(`Snapshot belongs to ${snapshot.campaignId}, not ${this.campaign.id}`);
    const loaded = structuredClone(snapshot.state);
    const resources = emptyResources();
    for (const key of Object.keys(RESOURCE_LABELS) as ResourceName[]) {
      if (Number.isFinite(loaded.resources[key])) resources[key] = loaded.resources[key];
    }
    Object.assign(this.state, createInitialState(), loaded, { resources, armyReport: loaded.armyReport ?? null });
  }

  /**
   * Starts constructing one of the currently offered buildings.
   * Ignored (returns `[]`) unless the run is awaiting a choice and `buildingId` is on offer.
   * The building takes the next plot, so `plotIndex` equals the number of buildings already built.
   */
  chooseBuilding(buildingId: string): SimulationEvent[] {
    if (this.state.mode !== "awaiting-choice" || !this.state.availableBuildingIds.includes(buildingId)) return [];
    const definition = BUILDINGS[buildingId];
    if (!definition || !isBuildingEligible(definition, this.state.builtBuildingIds, this.state.move)) return [];
    const plotIndex = this.state.builtBuildingIds.length;
    this.state.mode = "construction";
    this.state.selectedBuildingId = buildingId;
    this.state.activePlotIndex = plotIndex;
    this.state.constructionElapsed = 0;
    this.state.availableBuildingIds = this.state.availableBuildingIds.filter((id) => id !== buildingId);
    return [{ type: "construction-started", buildingId, plotIndex }];
  }

  /** Starts a brand-new run on the same campaign. */
  reset(): void { Object.assign(this.state, createInitialState()); }

  /**
   * Advances construction by `seconds` of simulation time (already multiplied
   * by the speed setting). Only construction consumes time: while awaiting a
   * choice or after completion this is a no-op, so the economy never runs
   * "in the background".
   *
   * When construction reaches 30s the whole move resolves in one step and the
   * resulting events are returned. Any overshoot past 30s is discarded.
   */
  update(seconds: number): SimulationEvent[] {
    if (!Number.isFinite(seconds) || seconds <= 0 || this.state.mode !== "construction") return [];
    const events: SimulationEvent[] = [];
    this.state.constructionElapsed += seconds;
    if (this.state.constructionElapsed < CONSTRUCTION_DURATION_SECONDS) return events;

    const buildingId = this.state.selectedBuildingId;
    const plotIndex = this.state.activePlotIndex;
    if (buildingId === null || plotIndex === null) {
      // Unreachable through chooseBuilding()/loadSnapshot(); guards against direct state edits.
      throw new Error("Settlement is in construction mode without a selected building");
    }
    const completedMove = this.state.move;
    this.state.builtBuildingIds.push(buildingId);
    this.state.buildingMaturity[buildingId] = 0;
    this.state.civicLevel = completedMove;
    this.state.selectedBuildingId = null;
    this.state.activePlotIndex = null;
    this.state.constructionElapsed = 0;
    events.push({ type: "construction-complete", buildingId, plotIndex }, { type: "civic-upgraded", level: this.state.civicLevel });

    this.resolveMoveEconomy();
    events.push({ type: "economy-resolved", activeBuildingIds: [...this.state.builtBuildingIds] });
    const newArchers = this.state.builtBuildingIds.includes("weapons-workshop") ? 1 : 0;
    const newSwordsmen = this.state.builtBuildingIds.includes("blacksmith") ? 1 : 0;
    this.state.trainedUnits.archers += newArchers;
    this.state.trainedUnits.swordsmen += newSwordsmen;
    if (newArchers || newSwordsmen) events.push({ type: "unit-trained", units: { ...this.state.trainedUnits }, newArchers, newSwordsmen });
    const previousPopulation = this.state.population;
    const houseMaturity = this.state.buildingMaturity.house ?? 0;
    this.state.population = populationForLevel(this.state.civicLevel) + 2 * houseMaturity;
    if (this.state.population !== previousPopulation) events.push({ type: "population-changed", total: this.state.population });

    if (completedMove >= this.campaign.moveLimit) {
      this.state.mode = "complete";
      this.state.armyReport = this.assembleArmy();
      events.push({ type: "army-mustered", report: this.state.armyReport }, { type: "game-complete" });
      return events;
    }

    this.state.move = completedMove + 1;
    // The campaign whitelist is applied while ranking, so a disallowed top pick
    // falls through to the next eligible building instead of shrinking the pool.
    const nextOffer = nextBuildingOffer(
      this.state.builtBuildingIds, this.state.availableBuildingIds, this.state.move, buildingId, this.campaign.availableBuildingIds,
    );
    if (nextOffer) this.state.availableBuildingIds.push(nextOffer);
    this.state.mode = "awaiting-choice";
    events.push({ type: "choices-ready", move: this.state.move, options: [...this.state.availableBuildingIds] });
    return events;
  }

  /**
   * Runs every completed building once, at the end of each move.
   *
   * Order matters and is intentional:
   *   1. every building matures by one move;
   *   2. raw producers add resources (output grows by 1 every 3 moves of maturity);
   *   3. converters consume inputs in a fixed order (sawmill, bakery, butchery, winery,
   *      weapons workshop, blacksmith, marketplace), each limited by its capacity
   *      (also +1 every 3 moves) and by the inputs available at that point;
   *   4. grain spoils above 6 without a Granary; defense accrues.
   * The Weapons Workshop uses existing tools before the Blacksmith can consume
   * the turn's planks, keeping military production viable late in the campaign.
   */
  private resolveMoveEconomy(): void {
    const built = new Set(this.state.builtBuildingIds);
    const resources = this.state.resources;
    for (const id of this.state.builtBuildingIds) this.state.buildingMaturity[id] = (this.state.buildingMaturity[id] ?? 0) + 1;
    const rawAmount = (id: string): number => 2 + Math.floor(((this.state.buildingMaturity[id] ?? 1) - 1) / 3);
    if (built.has("woodcutter")) resources.wood += rawAmount("woodcutter");
    if (built.has("farm")) resources.grain += rawAmount("farm");
    if (built.has("swine-farm")) resources.livestock += rawAmount("swine-farm");
    if (built.has("fruit-orchard")) resources.fruit += rawAmount("fruit-orchard");
    if (built.has("quarry")) resources.stone += rawAmount("quarry");
    if (built.has("granary")) resources.grain += 1;
    if (built.has("barracks")) resources.training += 3;

    const capacity = (id: string): number => 1 + Math.floor(((this.state.buildingMaturity[id] ?? 1) - 1) / 3);
    if (built.has("sawmill")) {
      const cycles = Math.min(capacity("sawmill"), Math.floor(resources.wood / 2));
      resources.wood -= cycles * 2; resources.planks += cycles * 3;
    }
    if (built.has("bakery")) {
      const cycles = Math.min(capacity("bakery"), Math.floor(resources.grain / 2));
      resources.grain -= cycles * 2; resources.rations += cycles * 3;
    }
    if (built.has("butchery")) {
      const cycles = Math.min(capacity("butchery"), resources.livestock);
      resources.livestock -= cycles; resources.rations += cycles * 3;
    }
    if (built.has("winery")) {
      const cycles = Math.min(capacity("winery"), Math.floor(resources.fruit / 2));
      resources.fruit -= cycles * 2; resources.wine += cycles * 2;
    }
    if (built.has("weapons-workshop")) {
      const cycles = Math.min(capacity("weapons-workshop"), resources.tools, resources.planks);
      resources.tools -= cycles; resources.planks -= cycles; resources.arms += cycles * 2;
    }
    if (built.has("blacksmith")) {
      const cycles = Math.min(capacity("blacksmith"), resources.stone, resources.planks);
      resources.stone -= cycles; resources.planks -= cycles; resources.tools += cycles * 2;
    }
    if (built.has("marketplace")) {
      const cycles = capacity("marketplace");
      const wineSold = Math.min(cycles, resources.wine);
      resources.wine -= wineSold; resources.wealth += wineSold * 3;
      const plankLots = Math.min(cycles - wineSold, Math.floor(resources.planks / 2));
      resources.planks -= plankLots * 2; resources.wealth += plankLots * 2;
    }
    if (!built.has("granary") && resources.grain > 6) resources.grain -= 1;
    resources.defense += (built.has("quarry") ? 1 : 0) + (built.has("sawmill") ? 1 : 0) + (built.has("barracks") ? 2 : 0);
  }

  /**
   * Scores the settlement against the campaign enemy after the final move.
   *
   * Trained archers and swordsmen carry through from completed moves. Remaining
   * recruits come from population above 8 (65%); arms can equip reserve spearmen.
   * Mercenaries are hired with wealth and rations if a Marketplace exists.
   * The final score blends combat strength (65%), city defense (20%), supply turns
   * and morale, and maps to an outcome tier. This reads resources but does not
   * change them, so the report can be recomputed from a save.
   */
  private assembleArmy(): ArmyReport {
    const built = new Set(this.state.builtBuildingIds);
    const resources = this.state.resources;
    let recruits = Math.max(0, Math.floor((this.state.population - 8) * 0.65) - this.state.trainedUnits.archers - this.state.trainedUnits.swordsmen);
    let arms = resources.arms;
    const archers = this.state.trainedUnits.archers;
    const swordsmen = this.state.trainedUnits.swordsmen;
    const spearmen = built.has("weapons-workshop") ? Math.min(arms, recruits) : 0;
    recruits -= spearmen;
    const militia = Math.floor(recruits * 0.6);
    const mercenaries = built.has("marketplace") ? Math.min(5, Math.floor(resources.wealth / 4), Math.floor(resources.rations / 2)) : 0;
    const units: ArmyUnits = { militia, spearmen, archers, swordsmen, mercenaries };
    const totalUnits = Object.values(units).reduce((sum, value) => sum + value, 0);
    const morale = clamp(50 + this.state.civicLevel * 3 + resources.wine * 4 + (built.has("marketplace") ? 8 : 0) + (built.has("house") ? 4 : 0), 40, 100);
    const baseCombat = militia + spearmen * 3 + archers * 4 + swordsmen * 5 + mercenaries * 4;
    const combatStrength = Math.round(baseCombat * (0.8 + morale / 250));
    const supplyTurns = Math.min(8, Math.floor(resources.rations / Math.max(1, Math.ceil(totalUnits / 4))));
    const cityDefense = resources.defense + Math.floor(resources.stone / 2) + Math.floor(resources.planks / 3) + this.state.civicLevel * 2;
    const score = Math.round(combatStrength * 0.65 + cityDefense * 0.2 + supplyTurns * 2 + morale * 0.1);
    let outcome: CampaignOutcome = "Settlement Lost";
    if (score >= this.campaign.objective.strength + 37) outcome = "Flourishing Victory";
    else if (score >= this.campaign.objective.strength + 22) outcome = "Decisive Victory";
    else if (score >= this.campaign.objective.strength) outcome = "Victory";
    else if (score >= this.campaign.objective.strength * 0.6) outcome = "Costly Survival";

    const explanations: string[] = [];
    explanations.push(`${archers} archers and ${swordsmen} swordsmen trained one at a time across the completed moves.`);
    explanations.push(built.has("weapons-workshop") ? `The workshops forged ${resources.arms} standardized arms before the muster.` : "No Weapons Workshop was completed, so recruits lacked standardized equipment.");
    explanations.push(resources.rations > 0 ? `${resources.rations} stored rations can support the army for ${supplyTurns} campaign turn(s).` : "The city entered battle without preserved campaign rations.");
    if (built.has("marketplace")) explanations.push("Marketplace wealth allowed the city to supplement its ranks with mercenaries.");
    return { outcome, score, enemyStrength: this.campaign.objective.strength, units, totalUnits, combatStrength, supplyTurns, cityDefense, morale, explanations };
  }
}
