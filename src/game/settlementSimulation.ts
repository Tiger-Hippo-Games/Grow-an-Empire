import { CAMPAIGN_1, type CampaignDefinition } from "./campaigns";
import { CONSTRUCTION_DURATION_SECONDS, nextBuildingOffer, OPENING_BUILD_OPTIONS, populationForLevel, type ResourceName } from "./content";

export type SimulationMode = "awaiting-choice" | "construction" | "complete";
export type CampaignOutcome = "Settlement Lost" | "Costly Survival" | "Victory" | "Decisive Victory" | "Flourishing Victory";
export type ResourceLedger = Record<ResourceName, number>;
export const SAVE_SCHEMA_VERSION = 2 as const;

export interface ArmyUnits { militia: number; spearmen: number; archers: number; veterans: number; mercenaries: number; }
export interface ArmyReport {
  outcome: CampaignOutcome; score: number; enemyStrength: number; units: ArmyUnits; totalUnits: number;
  combatStrength: number; supplyTurns: number; cityDefense: number; morale: number; explanations: string[];
}
export interface BuildOrderEntry { move: number; buildingId: string; }

export type SimulationEvent =
  | { type: "construction-started"; buildingId: string; plotIndex: number }
  | { type: "construction-complete"; buildingId: string; plotIndex: number }
  | { type: "civic-upgraded"; level: number }
  | { type: "choices-ready"; move: number; options: string[] }
  | { type: "economy-resolved"; activeBuildingIds: string[] }
  | { type: "population-changed"; total: number }
  | { type: "army-mustered"; report: ArmyReport }
  | { type: "game-complete" };

export interface SettlementState {
  mode: SimulationMode; move: number; civicLevel: number; population: number; resources: ResourceLedger;
  builtBuildingIds: string[]; availableBuildingIds: string[]; selectedBuildingId: string | null;
  activePlotIndex: number | null; constructionElapsed: number; buildingMaturity: Record<string, number>;
  armyReport: ArmyReport | null;
}

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
});

const clamp = (value: number, minimum: number, maximum: number): number => Math.max(minimum, Math.min(maximum, value));

export function isValidSnapshot(value: unknown): value is SettlementSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<SettlementSnapshot>;
  if (snapshot.schemaVersion !== SAVE_SCHEMA_VERSION || typeof snapshot.savedAt !== "string" || typeof snapshot.campaignId !== "string") return false;
  const state = snapshot.state as Partial<SettlementState> | undefined;
  if (!state || !["awaiting-choice", "construction", "complete"].includes(String(state.mode))) return false;
  return Number.isInteger(state.move) && Number.isInteger(state.civicLevel) && Number.isFinite(state.population)
    && Array.isArray(state.builtBuildingIds) && Array.isArray(state.availableBuildingIds)
    && typeof state.resources === "object" && state.resources !== null
    && typeof state.buildingMaturity === "object" && state.buildingMaturity !== null;
}

export class SettlementSimulation {
  readonly state: SettlementState = createInitialState();
  constructor(readonly campaign: CampaignDefinition = CAMPAIGN_1) {}

  get constructionProgress(): number { return Math.min(1, this.state.constructionElapsed / CONSTRUCTION_DURATION_SECONDS); }

  buildOrderSummary(): BuildOrderEntry[] {
    return this.state.builtBuildingIds.map((buildingId, index) => ({ move: index + 1, buildingId }));
  }

  serialize(): SettlementSnapshot {
    return { schemaVersion: SAVE_SCHEMA_VERSION, savedAt: new Date().toISOString(), campaignId: this.campaign.id, state: structuredClone(this.state) };
  }

  loadSnapshot(snapshot: SettlementSnapshot): void {
    if (!isValidSnapshot(snapshot)) throw new Error("Invalid or unsupported settlement snapshot");
    if (snapshot.campaignId !== this.campaign.id) throw new Error(`Snapshot belongs to ${snapshot.campaignId}, not ${this.campaign.id}`);
    Object.assign(this.state, structuredClone(snapshot.state));
  }

  chooseBuilding(buildingId: string): SimulationEvent[] {
    if (this.state.mode !== "awaiting-choice" || !this.state.availableBuildingIds.includes(buildingId)) return [];
    const plotIndex = this.state.builtBuildingIds.length;
    this.state.mode = "construction";
    this.state.selectedBuildingId = buildingId;
    this.state.activePlotIndex = plotIndex;
    this.state.constructionElapsed = 0;
    this.state.availableBuildingIds = this.state.availableBuildingIds.filter((id) => id !== buildingId);
    return [{ type: "construction-started", buildingId, plotIndex }];
  }

  reset(): void { Object.assign(this.state, createInitialState()); }

  update(seconds: number): SimulationEvent[] {
    if (!Number.isFinite(seconds) || seconds <= 0 || this.state.mode !== "construction") return [];
    const events: SimulationEvent[] = [];
    this.state.constructionElapsed += seconds;
    if (this.state.constructionElapsed < CONSTRUCTION_DURATION_SECONDS) return events;

    const buildingId = this.state.selectedBuildingId!;
    const plotIndex = this.state.activePlotIndex!;
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
    const previousPopulation = this.state.population;
    const houseMaturity = this.state.buildingMaturity.house ?? 0;
    this.state.population = populationForLevel(this.state.civicLevel) + (houseMaturity > 0 ? 1 + houseMaturity : 0);
    if (this.state.population !== previousPopulation) events.push({ type: "population-changed", total: this.state.population });

    if (completedMove >= this.campaign.moveLimit) {
      this.state.mode = "complete";
      this.state.armyReport = this.assembleArmy();
      events.push({ type: "army-mustered", report: this.state.armyReport }, { type: "game-complete" });
      return events;
    }

    this.state.move = completedMove + 1;
    const nextOffer = nextBuildingOffer(this.state.builtBuildingIds, this.state.availableBuildingIds, this.state.move, buildingId);
    if (nextOffer && this.campaign.availableBuildingIds.includes(nextOffer)) this.state.availableBuildingIds.push(nextOffer);
    this.state.mode = "awaiting-choice";
    events.push({ type: "choices-ready", move: this.state.move, options: [...this.state.availableBuildingIds] });
    return events;
  }

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
    if (built.has("blacksmith")) {
      const cycles = Math.min(capacity("blacksmith"), resources.stone, resources.planks);
      resources.stone -= cycles; resources.planks -= cycles; resources.tools += cycles * 2;
    }
    if (built.has("weapons-workshop")) {
      const cycles = Math.min(capacity("weapons-workshop"), resources.tools, resources.planks);
      resources.tools -= cycles; resources.planks -= cycles; resources.arms += cycles * 2;
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

  private assembleArmy(): ArmyReport {
    const built = new Set(this.state.builtBuildingIds);
    const resources = this.state.resources;
    let recruits = Math.max(0, Math.floor((this.state.population - 8) * 0.65));
    let arms = resources.arms;
    const archers = built.has("woodcutter") && built.has("sawmill") && built.has("weapons-workshop") ? Math.min(6, Math.floor(arms * 0.35), resources.planks, recruits) : 0;
    recruits -= archers; arms -= archers;
    const veterans = built.has("barracks") ? Math.min(Math.floor(resources.training / 2), arms, recruits) : 0;
    recruits -= veterans; arms -= veterans;
    const spearmen = built.has("weapons-workshop") ? Math.min(arms, recruits) : 0;
    recruits -= spearmen;
    const militia = Math.floor(recruits * 0.6);
    const mercenaries = built.has("marketplace") ? Math.min(5, Math.floor(resources.wealth / 4), Math.floor(resources.rations / 2)) : 0;
    const units: ArmyUnits = { militia, spearmen, archers, veterans, mercenaries };
    const totalUnits = Object.values(units).reduce((sum, value) => sum + value, 0);
    const morale = clamp(50 + this.state.civicLevel * 3 + resources.wine * 4 + (built.has("marketplace") ? 8 : 0) + (built.has("house") ? 4 : 0), 40, 100);
    const baseCombat = militia + spearmen * 3 + archers * 4 + veterans * 5 + mercenaries * 4;
    const combatStrength = Math.round(baseCombat * (0.8 + morale / 250));
    const supplyTurns = Math.min(8, Math.floor(resources.rations / Math.max(1, Math.ceil(totalUnits / 4))));
    const cityDefense = resources.defense + Math.floor(resources.stone / 2) + Math.floor(resources.planks / 3) + this.state.civicLevel * 2;
    const score = Math.round(combatStrength * 0.65 + cityDefense * 0.2 + supplyTurns * 2 + morale * 0.1);
    let outcome: CampaignOutcome = "Settlement Lost";
    if (score >= 82) outcome = "Flourishing Victory";
    else if (score >= 67) outcome = "Decisive Victory";
    else if (score >= this.campaign.objective.strength) outcome = "Victory";
    else if (score >= 40) outcome = "Costly Survival";

    const explanations: string[] = [];
    explanations.push(built.has("barracks") ? `The Barracks matured for ${this.state.buildingMaturity.barracks} move(s), producing ${resources.training} training.` : "Without a Barracks, the settlement relied on militia rather than professional veterans.");
    explanations.push(built.has("weapons-workshop") ? `The workshops forged ${resources.arms} standardized arms before the muster.` : "No Weapons Workshop was completed, so recruits lacked standardized equipment.");
    explanations.push(resources.rations > 0 ? `${resources.rations} stored rations can support the army for ${supplyTurns} campaign turn(s).` : "The city entered battle without preserved campaign rations.");
    if (built.has("marketplace")) explanations.push("Marketplace wealth allowed the city to supplement its ranks with mercenaries.");
    return { outcome, score, enemyStrength: this.campaign.objective.strength, units, totalUnits, combatStrength, supplyTurns, cityDefense, morale, explanations };
  }
}
