import { CAMPAIGN_1, type CampaignDefinition } from "./campaigns";
import { enemyHeadCount, gapToTarget, MILITIA_CAP, resolveBattle, type BattleRound, type EnemyArmy } from "./battle";
import {
  CONSTRUCTION_DURATION_SECONDS,
  BUILDINGS,
  isBuildingEligible,
  isKnownBuildingId,
  MAX_CAMPAIGN_MOVES,
  nextBuildingOffer,
  OPENING_BUILD_OPTIONS,
  populationForLevel,
  TOTAL_SETTLEMENT_LEVELS,
} from "./content";
import {
  ageBonus, BARRACKS_TRAINING_BONUS, canAfford, emptyStockpile, formatBag, goldValue, GRAIN_SPOIL_CAP, GRANARY_GRAIN,
  HOUSE_PEOPLE_PER_MOVE, MARKET_PLANK_RESERVE, MARKET_SALES_PER_MOVE, MINIMUM_MOVE_STOCKPILE, planSwap, PROCESSORS, RAW_OUTPUT, RESOURCE_NAMES,
  SELL_PRICE, SELLSWORD_COST, SOLDIER_TYPES, SOLDIERS, SOLDIERS_PER_RATION, startingStockpile, TRAINING_BASE, UPKEEP_WEIGHT,
  type ResourceBag, type ResourceName, type SoldierType, type SwapPlan,
} from "./economy";

/*
 * The authoritative game rules. `SettlementSimulation` owns all gameplay state
 * and is advanced only through its public methods; each returns a list of
 * `SimulationEvent`s describing what changed, and the render/UI layers react
 * to those. Nothing here knows about the DOM or Three.js, so it is fully
 * unit-testable, and the balance test can play every build order.
 *
 * One move:
 *   awaiting-choice --chooseBuilding() (cost paid)--> construction --update() x N--> (30 s)
 *     -> building completes, civic level rises, the economy runs (production,
 *        processing, training, market, upkeep, spoilage), a move summary is emitted
 *     -> next card offered, or after the last move the muster begins.
 *   gather() is open on every choice turn: no building, but the move still
 *   runs (production, training, upkeep). A stuck move (nothing affordable)
 *   can also be solved by swapAndBuild() with a Bazaar.
 * The finale:
 *   muster --muster(hire)--> the battle is resolved, stars awarded --> complete.
 */

/** Top-level phase of a run. */
export type SimulationMode = "awaiting-choice" | "construction" | "muster" | "complete";
export type CampaignOutcome = "Victory" | "Settlement Lost";
/** Stockpile of every resource. Always contains every key (missing keys from old saves are filled with 0). */
export type ResourceLedger = Record<ResourceName, number>;
/** Bump this when `SettlementState`'s shape changes incompatibly, and add a migration in `migrateSnapshot`. */
export const SAVE_SCHEMA_VERSION = 6 as const;

export interface TrainedUnits { archers: number; swordsmen: number; horsemen: number; }

/** The defending army, by role (roles match the character art in render/characterAssets.ts). */
export interface ArmyUnits { militia: number; spearmen: number; archers: number; swordsmen: number; horsemen: number; mercenaries: number; }

export interface SellswordHire { archers: number; swordsmen: number }

/** The end-of-campaign result, computed once by `muster()`. */
export interface ArmyReport {
  outcome: CampaignOutcome;
  win: boolean;
  stars: 0 | 1 | 2 | 3;
  playerStrength: number;
  enemyStrength: number;
  /** yours ÷ theirs − 1; negative on a defeat. */
  margin: number;
  units: ArmyUnits;
  totalUnits: number;
  sellswords: SellswordHire;
  enemy: EnemyArmy;
  enemyCount: number;
  /** Units standing after each of the four battle rounds, for the unit strip. */
  rounds: BattleRound[];
  goldAvailable: number;
  goldSpent: number;
  explanations: string[];
  /** On a defeat: what would have won. On a win short of 3 stars: what would reach the next star. */
  gap: string | null;
}
export interface BuildOrderEntry { move: number; buildingId: string; }

/** Why a building produced or trained nothing this move. */
export interface StallNote { buildingId: string; reason: string }

/**
 * One line of the move report: what one building (or the army, or spoilage)
 * took from the stockpile and put into it this move. `source` is a building
 * id, "camp" (supplies topping the stockpile up to its floor), "army"
 * (rations eaten) or "spoilage" (grain lost).
 */
export interface LedgerLine {
  source: string;
  used: ResourceBag;
  made: ResourceBag;
  trained?: Partial<TrainedUnits>;
  /** @deprecated Legacy (before v0.10.0): soldiers who left for lack of rations. New moves never set it. */
  deserted?: number;
  /** Why it did nothing this move (idle buildings). */
  idle?: string;
}

/** Everything that happened in one move, for the move summary card. */
export interface MoveSummary {
  move: number;
  /** The building completed this move, or null for a Gather move. */
  buildingId: string | null;
  civicLevel: number;
  population: number;
  produced: ResourceBag;
  consumed: ResourceBag;
  trained: TrainedUnits;
  upkeep: number;
  /** @deprecated Legacy (before v0.10.0); always 0 for new moves, kept so older saves load. */
  deserted: number;
  stalled: StallNote[];
  warnings: string[];
  sold: number;
  /** Per building, in the order the economy ran (absent in older saves). */
  ledger?: LedgerLine[];
  /** The stockpile before the move's economy ran (absent in older saves). */
  before?: ResourceBag;
}

/**
 * Everything the render/UI layers need to react to. Events from one move are
 * always emitted in this order: construction-complete (not for Gather),
 * civic-upgraded, economy-resolved, unit-trained (if any), population-changed
 * (if it changed), move-summary, then either
 * choices-ready or muster-ready. muster() emits army-mustered + game-complete.
 */
export type SimulationEvent =
  | { type: "construction-started"; buildingId: string; plotIndex: number }
  | { type: "construction-complete"; buildingId: string; plotIndex: number }
  | { type: "gathered"; move: number }
  | { type: "swapped"; buildingId: string; plan: SwapPlan }
  | { type: "civic-upgraded"; level: number }
  | { type: "choices-ready"; move: number; options: string[] }
  | { type: "economy-resolved"; activeBuildingIds: string[] }
  | { type: "population-changed"; total: number }
  | { type: "unit-trained"; units: TrainedUnits; newArchers: number; newSwordsmen: number; newHorsemen: number }
  | { type: "move-summary"; summary: MoveSummary }
  | { type: "muster-ready" }
  | { type: "army-mustered"; report: ArmyReport }
  | { type: "game-complete" };

/**
 * All mutable gameplay state. It is plain JSON (no class instances), which is
 * what makes `serialize()` / `loadSnapshot()` a simple deep copy.
 *
 * Invariants (enforced by `describeSnapshotProblem` for loaded saves):
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
  /**
   * @deprecated Legacy (before v0.10.0): soldiers who left for lack of rations
   * over the run. The economy no longer causes desertion, so new runs keep 0;
   * an older save's count is still explained at the muster and in the report.
   */
  deserted: number;
  /** Moves spent gathering instead of building. */
  gatherMoves: number;
  /** Stuck moves solved at the Bazaar. */
  swaps: number;
  /** The summary of the last completed move (shown again after a reload). */
  lastSummary: MoveSummary | null;
}

/** Versioned save-file wrapper around `SettlementState`. */
export interface SettlementSnapshot {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  savedAt: string;
  campaignId: string;
  state: SettlementState;
}

const createInitialState = (): SettlementState => ({
  mode: "awaiting-choice", move: 1, civicLevel: 0, population: 1, resources: startingStockpile(),
  builtBuildingIds: [], availableBuildingIds: [...OPENING_BUILD_OPTIONS], selectedBuildingId: null,
  activePlotIndex: null, constructionElapsed: 0, buildingMaturity: {}, armyReport: null,
  trainedUnits: { archers: 0, swordsmen: 0, horsemen: 0 },
  deserted: 0, gatherMoves: 0, swaps: 0, lastSummary: null,
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isKnownIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isKnownBuildingId) && new Set(value).size === value.length;

const MODES: SimulationMode[] = ["awaiting-choice", "construction", "muster", "complete"];

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const isAmount = (value: unknown): value is number => Number.isFinite(value) && (value as number) >= 0;
const hasCounts = (value: unknown, keys: readonly string[]): boolean =>
  isPlainObject(value) && keys.every((key) => isCount(value[key]));
const ARMY_COUNT_KEYS = ["archers", "swordsmen", "horsemen"] as const;
const ARMY_UNIT_KEYS = ["militia", "spearmen", "archers", "swordsmen", "horsemen", "mercenaries"] as const;

/**
 * True when `value` looks like a report written by this version (checked
 * before a finished city is shown). Every field the result dialog and the
 * battle strip read is checked, so a hand-edited or truncated save can't
 * crash them: it is re-fought instead.
 */
function isValidReport(value: unknown): value is ArmyReport {
  if (!isPlainObject(value)) return false;
  const win = value.outcome === "Victory";
  if (!win && value.outcome !== "Settlement Lost") return false;
  if (value.win !== win) return false;
  if (![0, 1, 2, 3].includes(value.stars as number) || (win && value.stars === 0) || (!win && value.stars !== 0)) return false;
  if (!["playerStrength", "enemyStrength", "margin", "goldAvailable", "goldSpent"].every((key) => Number.isFinite(value[key]))) return false;
  if (!isCount(value.totalUnits) || !isCount(value.enemyCount)) return false;
  if (!hasCounts(value.units, ARMY_UNIT_KEYS) || !hasCounts(value.sellswords, ["archers", "swordsmen"])) return false;
  if (!hasCounts(value.enemy, ARMY_COUNT_KEYS) || !Number.isFinite((value.enemy as Record<string, unknown>).veterancy)) return false;
  if (!Array.isArray(value.rounds) || value.rounds.length === 0) return false;
  if (!value.rounds.every((round) => isPlainObject(round) && hasCounts(round.player, [...ARMY_COUNT_KEYS, "militia"]) && hasCounts(round.enemy, ARMY_COUNT_KEYS))) return false;
  if (!Array.isArray(value.explanations) || !value.explanations.every((line) => typeof line === "string")) return false;
  return value.gap === null || value.gap === undefined || typeof value.gap === "string";
}

const isBag = (value: unknown): boolean => isPlainObject(value) && Object.values(value).every((amount) => Number.isFinite(amount));

/** True for a move summary this version can show again after a reload. */
function isValidSummary(value: unknown): value is MoveSummary {
  if (!isPlainObject(value)) return false;
  return isCount(value.move) && (value.buildingId === null || isKnownBuildingId(value.buildingId))
    && isCount(value.civicLevel) && isAmount(value.population)
    && isBag(value.produced) && isBag(value.consumed) && hasCounts(value.trained, SOLDIER_TYPES)
    && Number.isFinite(value.upkeep) && isCount(value.deserted) && Number.isFinite(value.sold)
    && Array.isArray(value.warnings) && value.warnings.every((line) => typeof line === "string")
    && Array.isArray(value.stalled) && value.stalled.every((note) => isPlainObject(note) && typeof note.buildingId === "string" && typeof note.reason === "string")
    && (value.before === undefined || isBag(value.before))
    && (value.ledger === undefined || (Array.isArray(value.ledger) && value.ledger.every((entry) => isPlainObject(entry)
      && typeof entry.source === "string" && isBag(entry.used) && isBag(entry.made)
      && (entry.idle === undefined || typeof entry.idle === "string") && (entry.deserted === undefined || isCount(entry.deserted)))));
}

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
  if (!MODES.includes(state.mode as SimulationMode)) return `unknown mode ${String(state.mode)}`;
  if (!Number.isInteger(state.move) || (state.move as number) < 1 || (state.move as number) > MAX_CAMPAIGN_MOVES) return "invalid move";
  if (!Number.isInteger(state.civicLevel) || (state.civicLevel as number) < 0 || (state.civicLevel as number) >= TOTAL_SETTLEMENT_LEVELS) return "invalid civic level";
  if (!Number.isFinite(state.population) || (state.population as number) < 0) return "invalid population";
  if (!isKnownIdList(state.builtBuildingIds)) return "builtBuildingIds contains unknown or duplicate buildings";
  if (!isKnownIdList(state.availableBuildingIds)) return "availableBuildingIds contains unknown or duplicate buildings";
  if ((state.builtBuildingIds as string[]).some((id) => (state.availableBuildingIds as string[]).includes(id))) return "a building is both built and on offer";
  if (!isPlainObject(state.resources) || !Object.values(state.resources).every(isAmount)) return "invalid resources";
  if (!isPlainObject(state.buildingMaturity) || !Object.values(state.buildingMaturity).every(isAmount)) return "invalid buildingMaturity";
  for (const key of ["deserted", "gatherMoves", "swaps"] as const) {
    if (state[key] !== undefined && !isCount(state[key])) return `invalid ${key}`;
  }
  const units = state.trainedUnits;
  if (!isPlainObject(units) || !SOLDIER_TYPES.every((type) => Number.isInteger(units[type]) && (units[type] as number) >= 0)) return "invalid trainedUnits";
  // Outside construction the selection is ignored (loadSnapshot clears it),
  // but an unknown id would still be asked for art at boot and fail every visit.
  if (state.selectedBuildingId !== null && state.selectedBuildingId !== undefined && !isKnownBuildingId(state.selectedBuildingId)) return "selectedBuildingId is not a known building";
  if (state.mode === "construction") {
    if (!isKnownBuildingId(state.selectedBuildingId)) return "construction without a known selected building";
    if (state.activePlotIndex !== state.builtBuildingIds.length) return "activePlotIndex does not match build order";
    if (state.builtBuildingIds.includes(state.selectedBuildingId)) return "selected building is already built";
    if (!Number.isFinite(state.constructionElapsed)) return "invalid constructionElapsed";
  }
  // A bad report in a finished city is re-fought, and a bad move summary is
  // dropped, in loadSnapshot(): neither is worth losing the city over.
  if (state.mode !== "complete" && state.armyReport !== null && state.armyReport !== undefined) return "armyReport outside a finished city";
  return null;
}

/** Type guard: true when `value` can be passed to `loadSnapshot()` safely. */
export function isValidSnapshot(value: unknown): value is SettlementSnapshot {
  return describeSnapshotProblem(value) === null;
}

/**
 * Brings an older save up to the current version, or returns null if it can't be.
 *
 * v4 and v5 (before the economy): the city, its offers and any construction in
 * progress are kept, so the player continues where they were. Wealth becomes
 * gold; tools, arms, training and defense are dropped (the new rules spend
 * planks and stone directly). A finished v4/v5 city goes back to the muster,
 * so its battle is fought under the current rules.
 */
export function migrateSnapshot(value: unknown): SettlementSnapshot | null {
  if (!isPlainObject(value)) return null;
  if (value.schemaVersion === SAVE_SCHEMA_VERSION) return isValidSnapshot(value) ? value : null;
  if ((value.schemaVersion !== 4 && value.schemaVersion !== 5) || !isPlainObject(value.state)) return null;
  const migrated = structuredClone(value) as Record<string, unknown>;
  const state = migrated.state as Record<string, unknown>;
  if (!isPlainObject(state.trainedUnits) || !isPlainObject(state.resources)) return null;
  const oldResources = state.resources as Record<string, unknown>;
  const resources = emptyStockpile();
  for (const name of RESOURCE_NAMES) {
    const amount = name === "gold" ? oldResources.wealth : oldResources[name];
    if (typeof amount === "number" && Number.isFinite(amount)) resources[name] = Math.max(0, Math.floor(amount));
  }
  state.resources = resources;
  const trained = state.trainedUnits as Record<string, unknown>;
  if (!Number.isInteger(trained.horsemen)) trained.horsemen = 0;
  if (state.mode === "complete") {
    state.mode = "muster";
    state.armyReport = null;
  }
  state.deserted = 0;
  state.gatherMoves = 0;
  state.swaps = 0;
  state.lastSummary = null;
  migrated.schemaVersion = SAVE_SCHEMA_VERSION;
  return isValidSnapshot(migrated) ? (migrated as unknown as SettlementSnapshot) : null;
}

function addTo(bag: ResourceBag, name: ResourceName, amount: number): void {
  if (amount) bag[name] = (bag[name] ?? 0) + amount;
}

/**
 * One campaign run. Create one per campaign; call `reset()` to start over.
 * All methods are synchronous and deterministic (no randomness, no clock),
 * so the same choices always produce the same city.
 */
export class SettlementSimulation {
  readonly state: SettlementState = createInitialState();
  constructor(readonly campaign: CampaignDefinition = CAMPAIGN_1) {}

  /** 0–1 fraction of the current construction; 0 when nothing is being built. */
  get constructionProgress(): number { return Math.min(1, this.state.constructionElapsed / CONSTRUCTION_DURATION_SECONDS); }

  /** Completed buildings in the order they were built. */
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
   * lacks get their defaults instead of leaking values from the previous run.
   * @throws Error if the snapshot is malformed or belongs to another campaign.
   *         The current state is left untouched in that case.
   */
  loadSnapshot(snapshot: SettlementSnapshot): void {
    const problem = describeSnapshotProblem(snapshot);
    if (problem) throw new Error(`Invalid or unsupported settlement snapshot: ${problem}`);
    if (snapshot.campaignId !== this.campaign.id) throw new Error(`Snapshot belongs to ${snapshot.campaignId}, not ${this.campaign.id}`);
    const loaded = structuredClone(snapshot.state);
    const resources = emptyStockpile();
    for (const key of RESOURCE_NAMES) {
      if (Number.isFinite(loaded.resources[key])) resources[key] = loaded.resources[key];
    }
    const armyReport = isValidReport(loaded.armyReport) ? loaded.armyReport : null;
    const lastSummary = isValidSummary(loaded.lastSummary) ? loaded.lastSummary : null;
    const building = loaded.mode === "construction";
    const elapsed = Number.isFinite(loaded.constructionElapsed) ? loaded.constructionElapsed : 0;
    const constructionElapsed = building ? Math.min(CONSTRUCTION_DURATION_SECONDS, Math.max(0, elapsed)) : 0;
    // Only a city under construction has a selection; a stale one elsewhere is dropped.
    const selection = building ? {} : { selectedBuildingId: null, activePlotIndex: null };
    Object.assign(this.state, createInitialState(), loaded, { resources, armyReport, lastSummary, constructionElapsed }, selection);
    // A finished city whose report is missing is re-fought without sellswords.
    if (this.state.mode === "complete" && !this.state.armyReport) this.state.armyReport = this.resolveMuster({ archers: 0, swordsmen: 0 });
  }

  /** Starts a brand-new run on the same campaign. */
  reset(): void { Object.assign(this.state, createInitialState()); }

  /** The build cost of an offered card. */
  costOf(buildingId: string): ResourceBag { return BUILDINGS[buildingId]?.cost ?? {}; }

  canAffordBuilding(buildingId: string): boolean { return canAfford(this.state.resources, this.costOf(buildingId)); }

  /** True while awaiting a choice and no offered card can be paid for. */
  isStuck(): boolean {
    return this.state.mode === "awaiting-choice" && !this.state.availableBuildingIds.some((id) => this.canAffordBuilding(id));
  }

  get hasMarketplace(): boolean { return this.state.builtBuildingIds.includes("marketplace"); }

  /** On a stuck move with a Bazaar: the swap that would pay for `buildingId`, or null. */
  swapPlanFor(buildingId: string): SwapPlan | null {
    if (!this.isStuck() || !this.hasMarketplace || !this.state.availableBuildingIds.includes(buildingId)) return null;
    return planSwap(this.state.resources, this.costOf(buildingId));
  }

  /**
   * Starts constructing one of the currently offered buildings and pays its cost.
   * Ignored (returns `[]`) unless the run is awaiting a choice, the card is on
   * offer, its prerequisites are met and the stockpile can pay for it.
   * The building takes the next plot, so `plotIndex` equals the number of buildings already built.
   */
  chooseBuilding(buildingId: string): SimulationEvent[] {
    if (this.state.mode !== "awaiting-choice" || !this.state.availableBuildingIds.includes(buildingId)) return [];
    const definition = BUILDINGS[buildingId];
    if (!definition || !isBuildingEligible(definition, this.state.builtBuildingIds, this.state.move)) return [];
    if (!this.canAffordBuilding(buildingId)) return [];
    for (const [name, amount] of Object.entries(definition.cost) as Array<[ResourceName, number]>) this.state.resources[name] -= amount;
    const plotIndex = this.state.builtBuildingIds.length;
    this.state.mode = "construction";
    this.state.selectedBuildingId = buildingId;
    this.state.activePlotIndex = plotIndex;
    this.state.constructionElapsed = 0;
    this.state.availableBuildingIds = this.state.availableBuildingIds.filter((id) => id !== buildingId);
    return [{ type: "construction-started", buildingId, plotIndex }];
  }

  /**
   * Stuck move, with a Bazaar: sells goods to cover the card's shortfall
   * (at twice the selling price) and starts building it.
   */
  swapAndBuild(buildingId: string): SimulationEvent[] {
    const plan = this.swapPlanFor(buildingId);
    if (!plan) return [];
    const before = { ...this.state.resources };
    for (const [name, amount] of Object.entries(plan.sell) as Array<[ResourceName, number]>) this.state.resources[name] -= amount;
    for (const [name, amount] of Object.entries(plan.buy) as Array<[ResourceName, number]>) this.state.resources[name] += amount;
    // Goods sell in whole units, so a swap can raise more gold than it needs: the change is kept.
    if (plan.change > 0) this.state.resources.gold += plan.change;
    const started = this.chooseBuilding(buildingId);
    if (!started.length) {
      // The plan covers the card, so this shouldn't happen; if it does, undo the trade.
      this.state.resources = before;
      return [];
    }
    this.state.swaps += 1;
    return [{ type: "swapped", buildingId, plan }, ...started];
  }

  /** Gather is a strategic alternative on every build-choice turn. */
  canGather(): boolean {
    return this.state.mode === "awaiting-choice";
  }

  /**
   * Build nothing, but every building still runs and the move counts.
   * Offered cards stay available for the next turn.
   */
  gather(): SimulationEvent[] {
    if (!this.canGather()) return [];
    this.state.gatherMoves += 1;
    const events: SimulationEvent[] = [{ type: "gathered", move: this.state.move }];
    return events.concat(this.completeMove(null));
  }

  /**
   * Advances construction by `seconds` of simulation time (already multiplied
   * by the speed setting). Only construction consumes time. When construction
   * reaches 30 s the whole move resolves in one step. Any overshoot is discarded.
   */
  update(seconds: number): SimulationEvent[] {
    if (!Number.isFinite(seconds) || seconds <= 0 || this.state.mode !== "construction") return [];
    this.state.constructionElapsed += seconds;
    if (this.state.constructionElapsed < CONSTRUCTION_DURATION_SECONDS) return [];
    const buildingId = this.state.selectedBuildingId;
    if (buildingId === null || this.state.activePlotIndex === null) {
      // Unreachable through chooseBuilding()/loadSnapshot(); guards against direct state edits.
      throw new Error("Settlement is in construction mode without a selected building");
    }
    return this.completeMove(buildingId);
  }

  /** Finishes the current move: the building (if any), then the economy, then the next offer or the muster. */
  private completeMove(buildingId: string | null): SimulationEvent[] {
    const events: SimulationEvent[] = [];
    const completedMove = this.state.move;
    if (buildingId !== null) {
      const plotIndex = this.state.builtBuildingIds.length;
      this.state.builtBuildingIds.push(buildingId);
      this.state.buildingMaturity[buildingId] = 0;
      events.push({ type: "construction-complete", buildingId, plotIndex });
    }
    this.state.civicLevel = completedMove;
    this.state.selectedBuildingId = null;
    this.state.activePlotIndex = null;
    this.state.constructionElapsed = 0;
    events.push({ type: "civic-upgraded", level: this.state.civicLevel });

    const previousPopulation = this.state.population;
    const summary = this.resolveMoveEconomy(buildingId);
    events.push({ type: "economy-resolved", activeBuildingIds: [...this.state.builtBuildingIds] });
    if (summary.trained.archers || summary.trained.swordsmen || summary.trained.horsemen) {
      events.push({ type: "unit-trained", units: { ...this.state.trainedUnits }, newArchers: summary.trained.archers, newSwordsmen: summary.trained.swordsmen, newHorsemen: summary.trained.horsemen });
    }
    if (this.state.population !== previousPopulation) events.push({ type: "population-changed", total: this.state.population });

    const lastMove = completedMove >= this.campaign.moveLimit;
    if (!lastMove) {
      this.state.move = completedMove + 1;
      // A Gather move builds nothing, so no new card arrives. The campaign
      // whitelist is applied while ranking, so a disallowed top pick falls
      // through to the next eligible building instead of shrinking the pool.
      if (buildingId !== null) {
        const nextOffer = nextBuildingOffer(this.state.builtBuildingIds, this.state.availableBuildingIds, this.state.move, buildingId, this.campaign.availableBuildingIds);
        if (nextOffer) this.state.availableBuildingIds.push(nextOffer);
      }
      this.state.mode = "awaiting-choice";
      if (this.isStuck()) summary.warnings.unshift("Nothing on offer is affordable: gather resources, or swap at the Bazaar if available.");
      summary.warnings = summary.warnings.slice(0, 2);
    }
    this.state.lastSummary = summary;
    events.push({ type: "move-summary", summary });
    if (lastMove) {
      this.state.mode = "muster";
      events.push({ type: "muster-ready" });
    } else {
      events.push({ type: "choices-ready", move: this.state.move, options: [...this.state.availableBuildingIds] });
    }
    return events;
  }

  /** Training capacity of a military building this move (0 if not built). */
  trainingCapacity(buildingId: string): number {
    if (!this.state.builtBuildingIds.includes(buildingId)) return 0;
    const barracks = this.state.builtBuildingIds.includes("barracks") ? BARRACKS_TRAINING_BONUS : 0;
    return TRAINING_BASE + ageBonus(this.state.buildingMaturity[buildingId] ?? 1) + barracks;
  }

  get soldierCount(): number { return this.state.trainedUnits.archers + this.state.trainedUnits.swordsmen + this.state.trainedUnits.horsemen; }

  /** Villagers not working a building and not already soldiers. */
  get freeVillagers(): number { return Math.max(0, this.state.population - this.state.builtBuildingIds.length - this.soldierCount); }

  /** Rations the army eats per move. */
  get upkeep(): number {
    const weight = SOLDIER_TYPES.reduce((sum, type) => sum + this.state.trainedUnits[type] * UPKEEP_WEIGHT[type], 0);
    return Math.ceil(weight / SOLDIERS_PER_RATION);
  }

  /**
   * Runs every completed building once, at the end of each move, in a fixed order:
   *   1. every building ages by one move; population grows with the civic level and Houses;
   *   2. raw producers add resources (output +1 every 3 moves standing);
   *   3. processors (Carpenter's Yard, Royal Kitchen, Ghee House, Soma Press) convert inputs, limited by capacity and stock;
   *   4. military buildings train soldiers from materials and free villagers;
   *   5. the Bazaar sells wine (and spare planks) for gold;
   *   6. the army eats available rations; shortages slow training, never cause desertion;
   *   7. grain above the cap spoils without a Granary; camp supplies restore basic reserves.
   */
  private resolveMoveEconomy(builtThisMove: string | null): MoveSummary {
    const built = new Set(this.state.builtBuildingIds);
    const resources = this.state.resources;
    const produced: ResourceBag = {};
    const consumed: ResourceBag = {};
    const stalled: StallNote[] = [];
    const warnings: string[] = [];
    const age = (id: string): number => this.state.buildingMaturity[id] ?? 1;
    const before: ResourceBag = {};
    for (const name of RESOURCE_NAMES) if (resources[name] > 0) before[name] = resources[name];
    const ledger: LedgerLine[] = [];
    const line = (source: string): LedgerLine => {
      let entry = ledger.find((item) => item.source === source);
      if (!entry) { entry = { source, used: {}, made: {} }; ledger.push(entry); }
      return entry;
    };
    for (const id of this.state.builtBuildingIds) this.state.buildingMaturity[id] = (this.state.buildingMaturity[id] ?? 0) + 1;
    this.state.population = Math.max(this.state.population, populationForLevel(this.state.civicLevel) + HOUSE_PEOPLE_PER_MOVE * (this.state.buildingMaturity.house ?? 0));

    for (const [id, [name, base]] of Object.entries(RAW_OUTPUT)) {
      if (!built.has(id)) continue;
      const amount = base + ageBonus(age(id));
      resources[name] += amount;
      addTo(produced, name, amount);
      addTo(line(id).made, name, amount);
    }
    if (built.has("granary")) { resources.grain += GRANARY_GRAIN; addTo(produced, "grain", GRANARY_GRAIN); addTo(line("granary").made, "grain", GRANARY_GRAIN); }

    for (const processor of PROCESSORS) {
      if (!built.has(processor.id)) continue;
      const capacity = processor.cycles + ageBonus(age(processor.id));
      let cycles = 0;
      while (cycles < capacity && canAfford(resources, processor.input)) {
        for (const [name, amount] of Object.entries(processor.input) as Array<[ResourceName, number]>) { resources[name] -= amount; addTo(consumed, name, amount); addTo(line(processor.id).used, name, amount); }
        for (const [name, amount] of Object.entries(processor.output) as Array<[ResourceName, number]>) { resources[name] += amount; addTo(produced, name, amount); addTo(line(processor.id).made, name, amount); }
        cycles += 1;
      }
      if (cycles === 0) { stalled.push({ buildingId: processor.id, reason: `needs ${formatBag(processor.input)}` }); line(processor.id).idle = `needs ${formatBag(processor.input)}`; }
    }

    const trained: TrainedUnits = { archers: 0, swordsmen: 0, horsemen: 0 };
    for (const type of SOLDIER_TYPES) {
      const soldier = SOLDIERS[type];
      if (!built.has(soldier.building)) continue;
      const capacity = this.trainingCapacity(soldier.building);
      let count = 0;
      const canFeedRecruit = (): boolean => {
        const weight = SOLDIER_TYPES.reduce((sum, kind) => sum + this.state.trainedUnits[kind] * UPKEEP_WEIGHT[kind], 0) + UPKEEP_WEIGHT[type];
        return resources.rations >= Math.ceil(weight / SOLDIERS_PER_RATION);
      };
      while (count < capacity && this.freeVillagers > 0 && canAfford(resources, soldier.cost) && canFeedRecruit()) {
        for (const [name, amount] of Object.entries(soldier.cost) as Array<[ResourceName, number]>) { resources[name] -= amount; addTo(consumed, name, amount); addTo(line(soldier.building).used, name, amount); }
        this.state.trainedUnits[type] += 1;
        trained[type] += 1;
        count += 1;
      }
      if (count > 0) { const entry = line(soldier.building); entry.trained = { ...entry.trained, [type]: count }; }
      if (count === 0) {
        const reason = this.freeVillagers === 0 ? "no free villagers" : !canFeedRecruit() ? "needs rations for new recruits" : `needs ${formatBag(soldier.cost)} per ${soldier.singular}`;
        stalled.push({ buildingId: soldier.building, reason });
        line(soldier.building).idle = reason;
      }
    }

    let sold = 0;
    if (built.has("marketplace")) {
      const sales = MARKET_SALES_PER_MOVE + ageBonus(age("marketplace"));
      const market = line("marketplace");
      while (sold < sales && resources.wine > 0) { resources.wine -= 1; resources.gold += SELL_PRICE.wine; addTo(consumed, "wine", 1); addTo(produced, "gold", SELL_PRICE.wine); addTo(market.used, "wine", 1); addTo(market.made, "gold", SELL_PRICE.wine); sold += 1; }
      while (sold < sales && resources.planks > MARKET_PLANK_RESERVE) { resources.planks -= 1; resources.gold += SELL_PRICE.planks; addTo(consumed, "planks", 1); addTo(produced, "gold", SELL_PRICE.planks); addTo(market.used, "planks", 1); addTo(market.made, "gold", SELL_PRICE.planks); sold += 1; }
      if (sold === 0) market.idle = "nothing to sell";
    }

    const upkeep = this.upkeep;
    const deserted = 0; // Legacy field: economy moves never cause desertion (v0.10.0).
    if (upkeep > 0) {
      const paid = Math.min(upkeep, resources.rations);
      resources.rations -= paid;
      addTo(consumed, "rations", paid);
      if (paid > 0) addTo(line("army").used, "rations", paid);
      if (paid < upkeep) warnings.push("Food shortage: existing soldiers stay; new training needs more rations.");
    }

    if (!built.has("granary") && resources.grain > GRAIN_SPOIL_CAP) {
      const spoiled = resources.grain - GRAIN_SPOIL_CAP;
      resources.grain = GRAIN_SPOIL_CAP;
      addTo(consumed, "grain", spoiled);
      addTo(line("spoilage").used, "grain", spoiled);
      warnings.push(`${spoiled} grain spoiled: a Granary would keep it.`);
    }

    for (const [name, minimum] of Object.entries(MINIMUM_MOVE_STOCKPILE) as Array<[ResourceName, number]>) {
      const supplied = Math.max(0, minimum - resources[name]);
      if (supplied === 0) continue;
      resources[name] += supplied;
      addTo(produced, name, supplied);
      addTo(line("camp").made, name, supplied);
    }

    const nextUpkeep = this.upkeep;
    if (nextUpkeep > 0 && !warnings.some(warning => warning.startsWith("Food shortage"))) {
      if (resources.rations <= nextUpkeep * 3) warnings.push("Low food reserves: a Royal Kitchen or Ghee House improves army growth. Existing soldiers stay.");
    }

    return {
      move: this.state.civicLevel, buildingId: builtThisMove, civicLevel: this.state.civicLevel, population: this.state.population,
      produced, consumed, trained, upkeep, deserted, stalled, warnings: warnings.slice(0, 2), sold, ledger, before,
    };
  }

  // --- The muster and the battle ---------------------------------------------

  /** Gold the pre-battle market can raise by selling everything (0 without a Bazaar). */
  get musterGold(): number { return this.hasMarketplace ? goldValue(this.state.resources) : 0; }

  /** At most half the enemy's head count can be hired. */
  get sellswordCap(): number { return this.hasMarketplace ? Math.floor(enemyHeadCount(this.campaign.objective.army) / 2) : 0; }

  /** Militia: free villagers who pick up tools, up to the cap. */
  get militia(): number { return Math.min(MILITIA_CAP, this.freeVillagers); }

  /** Whether `hire` is allowed: within the cap and affordable. */
  canHire(hire: SellswordHire): boolean {
    const count = hire.archers + hire.swordsmen;
    return Number.isInteger(hire.archers) && Number.isInteger(hire.swordsmen) && hire.archers >= 0 && hire.swordsmen >= 0
      && count <= this.sellswordCap && count * SELLSWORD_COST <= this.musterGold;
  }

  /** The player's army at the battle with `hire` added. */
  armyWith(hire: SellswordHire): { archers: number; swordsmen: number; horsemen: number; militia: number } {
    return {
      archers: this.state.trainedUnits.archers + hire.archers,
      swordsmen: this.state.trainedUnits.swordsmen + hire.swordsmen,
      horsemen: this.state.trainedUnits.horsemen,
      militia: this.militia,
    };
  }

  /** The hire with the best margin (for tests, the balance search, and the market's "Best mix" button). */
  bestHire(): SellswordHire {
    let best: SellswordHire = { archers: 0, swordsmen: 0 };
    let bestMargin = -Infinity;
    const budget = Math.min(this.sellswordCap, Math.floor(this.musterGold / SELLSWORD_COST));
    for (let archers = 0; archers <= budget; archers += 1) {
      const hire = { archers, swordsmen: budget - archers };
      const outcome = resolveBattle(this.armyWith(hire), this.campaign.objective.army, this.campaign.stars);
      if (outcome.margin > bestMargin + 1e-12) { bestMargin = outcome.margin; best = hire; }
    }
    return best;
  }

  /**
   * Ends the muster: hires the sellswords, fights the battle and records the result.
   * Ignored unless the run is at the muster and the hire is allowed.
   */
  muster(requested?: SellswordHire | null): SimulationEvent[] {
    const hire = requested ?? { archers: 0, swordsmen: 0 };
    if (this.state.mode !== "muster" || !this.canHire(hire)) return [];
    this.state.armyReport = this.resolveMuster(hire);
    this.state.mode = "complete";
    return [{ type: "army-mustered", report: this.state.armyReport }, { type: "game-complete" }];
  }

  private resolveMuster(hire: SellswordHire): ArmyReport {
    const enemy = this.campaign.objective.army;
    const army = this.armyWith(hire);
    const outcome = resolveBattle(army, enemy, this.campaign.stars);
    const units: ArmyUnits = {
      militia: army.militia, spearmen: 0,
      archers: army.archers, swordsmen: army.swordsmen, horsemen: army.horsemen,
      mercenaries: 0,
    };
    const totalUnits = army.archers + army.swordsmen + army.horsemen + army.militia;
    const goldSpent = (hire.archers + hire.swordsmen) * SELLSWORD_COST;
    const explanations: string[] = [];
    const t = this.state.trainedUnits;
    // trainedUnits is the army still standing (an older save's deserters had already left it).
    explanations.push(`${this.state.deserted ? "Still in the ranks" : "Trained over the campaign"}: ${t.archers} archers, ${t.swordsmen} swordsmen, ${t.horsemen} horsemen.`);
    if (hire.archers || hire.swordsmen) explanations.push(`The Bazaar hired ${hire.archers + hire.swordsmen} sellswords for ${goldSpent} gold.`);
    if (army.militia) explanations.push(`${army.militia} villagers joined as militia.`);
    if (this.state.deserted) explanations.push(`${this.state.deserted} ${this.state.deserted === 1 ? "soldier" : "soldiers"} deserted for lack of rations: a Royal Kitchen or Ghee House feeds the army.`);
    if (this.state.gatherMoves) explanations.push(`${this.state.gatherMoves} move${this.state.gatherMoves === 1 ? " was" : "s were"} spent gathering.`);
    let gap: string | null = null;
    const nextTarget = !outcome.win ? 0 : outcome.stars === 1 ? this.campaign.stars.two : outcome.stars === 2 ? this.campaign.stars.three : null;
    if (nextTarget !== null) {
      // Suggest soldiers this city could train: ones whose building stands; if
      // none does, ones whose building this campaign offers (and say which).
      const built = this.state.builtBuildingIds;
      const allowed = this.campaign.availableBuildingIds;
      const trainable = SOLDIER_TYPES.filter((type) => built.includes(SOLDIERS[type].building));
      const offered = SOLDIER_TYPES.filter((type) => !allowed || allowed.includes(SOLDIERS[type].building));
      const needed = gapToTarget(army, enemy, nextTarget, trainable.length ? trainable : offered);
      if (needed) {
        const label = needed.count === 1 ? SOLDIERS[needed.type].singular : SOLDIERS[needed.type].label;
        const building = SOLDIERS[needed.type].building;
        const via = built.includes(building) ? "" : ` (from a ${BUILDINGS[building]?.name ?? building})`;
        gap = outcome.win ? `${needed.count} more ${label}${via} would have earned ${outcome.stars + 1} stars.` : `${needed.count} more ${label}${via} would have won.`;
      }
    }
    return {
      outcome: outcome.win ? "Victory" : "Settlement Lost",
      win: outcome.win, stars: outcome.stars, playerStrength: outcome.playerStrength, enemyStrength: outcome.enemyStrength, margin: outcome.margin,
      units, totalUnits, sellswords: { ...hire }, enemy: { ...enemy }, enemyCount: enemyHeadCount(enemy),
      rounds: outcome.rounds, goldAvailable: this.musterGold, goldSpent, explanations, gap,
    };
  }
}

/** Resources a card still lacks, for the "needs 2 more planks" label. */
export function missingFor(state: SettlementState, buildingId: string): ResourceBag {
  const cost = BUILDINGS[buildingId]?.cost ?? {};
  const missing: ResourceBag = {};
  for (const [name, amount] of Object.entries(cost) as Array<[ResourceName, number]>) {
    const lack = amount - state.resources[name];
    if (lack > 0) missing[name] = lack;
  }
  return missing;
}

export type { SoldierType };
