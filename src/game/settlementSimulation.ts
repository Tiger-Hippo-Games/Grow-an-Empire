import {
  BUILDINGS,
  CONSTRUCTION_DURATION_SECONDS,
  nextBuildingOffer,
  OPENING_BUILD_OPTIONS,
  populationForLevel,
  TOTAL_MOVES,
  type ResourceName,
} from "./content";

export type SimulationMode = "awaiting-choice" | "construction" | "complete";

export type SimulationEvent =
  | { type: "construction-started"; buildingId: string; plotIndex: number }
  | { type: "construction-complete"; buildingId: string; plotIndex: number }
  | { type: "civic-upgraded"; level: number }
  | { type: "choices-ready"; move: number; options: string[] }
  | { type: "resource-produced"; buildingId: string; resource: ResourceName; total: number }
  | { type: "population-changed"; total: number }
  | { type: "game-complete" };

export type ResourceLedger = Record<ResourceName, number>;

export interface SettlementState {
  mode: SimulationMode;
  move: number;
  civicLevel: number;
  population: number;
  resources: ResourceLedger;
  builtBuildingIds: string[];
  availableBuildingIds: string[];
  selectedBuildingId: string | null;
  activePlotIndex: number | null;
  constructionElapsed: number;
  productionElapsed: Record<string, number>;
}

const emptyResources = (): ResourceLedger => ({ wood: 0, grain: 0, food: 0, stone: 0, planks: 0, wealth: 0, tools: 0, fruit: 0, wine: 0, arms: 0, defense: 0 });

export class SettlementSimulation {
  readonly state: SettlementState = {
    mode: "awaiting-choice",
    move: 1,
    civicLevel: 0,
    population: 1,
    resources: emptyResources(),
    builtBuildingIds: [],
    availableBuildingIds: [...OPENING_BUILD_OPTIONS],
    selectedBuildingId: null,
    activePlotIndex: null,
    constructionElapsed: 0,
    productionElapsed: {},
  };

  get constructionProgress(): number {
    return Math.min(1, this.state.constructionElapsed / CONSTRUCTION_DURATION_SECONDS);
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

  reset(): void {
    Object.assign(this.state, {
      mode: "awaiting-choice",
      move: 1,
      civicLevel: 0,
      population: 1,
      resources: emptyResources(),
      builtBuildingIds: [],
      availableBuildingIds: [...OPENING_BUILD_OPTIONS],
      selectedBuildingId: null,
      activePlotIndex: null,
      constructionElapsed: 0,
      productionElapsed: {},
    });
  }

  update(seconds: number): SimulationEvent[] {
    if (!Number.isFinite(seconds) || seconds <= 0) return [];
    const events: SimulationEvent[] = [];
    this.updateProduction(seconds, events);

    if (this.state.mode !== "construction") return events;
    this.state.constructionElapsed += seconds;
    if (this.state.constructionElapsed < CONSTRUCTION_DURATION_SECONDS) return events;

    const buildingId = this.state.selectedBuildingId!;
    const plotIndex = this.state.activePlotIndex!;
    const completedMove = this.state.move;
    this.state.builtBuildingIds.push(buildingId);
    this.state.productionElapsed[buildingId] = 0;
    this.state.civicLevel = completedMove;
    this.state.selectedBuildingId = null;
    this.state.activePlotIndex = null;
    this.state.constructionElapsed = 0;
    events.push({ type: "construction-complete", buildingId, plotIndex });
    events.push({ type: "civic-upgraded", level: this.state.civicLevel });
    this.state.population = populationForLevel(this.state.civicLevel);
    events.push({ type: "population-changed", total: this.state.population });

    if (completedMove >= TOTAL_MOVES) {
      this.state.mode = "complete";
      events.push({ type: "game-complete" });
      return events;
    }

    this.state.move = completedMove + 1;
    const nextOffer = nextBuildingOffer(
      this.state.builtBuildingIds,
      this.state.availableBuildingIds,
      this.state.move,
      buildingId,
    );
    if (nextOffer) this.state.availableBuildingIds.push(nextOffer);
    this.state.mode = "awaiting-choice";
    events.push({ type: "choices-ready", move: this.state.move, options: [...this.state.availableBuildingIds] });
    return events;
  }

  private updateProduction(seconds: number, events: SimulationEvent[]): void {
    const hasFarm = this.state.builtBuildingIds.includes("farm");
    const hasWoodcutter = this.state.builtBuildingIds.includes("woodcutter");
    const hasSwineFarm = this.state.builtBuildingIds.includes("swine-farm");
    const hasOrchard = this.state.builtBuildingIds.includes("fruit-orchard");
    const hasBlacksmith = this.state.builtBuildingIds.includes("blacksmith");
    const hasWeaponsWorkshop = this.state.builtBuildingIds.includes("weapons-workshop");
    const toolBoost = 1 + this.state.resources.tools * 0.04;

    for (const buildingId of this.state.builtBuildingIds) {
      const building = BUILDINGS[buildingId];
      if (!building.resource || !building.productionSeconds || !building.productionAmount) continue;
      const elapsed = (this.state.productionElapsed[buildingId] ?? 0) + seconds * toolBoost;
      const cycles = Math.floor(elapsed / building.productionSeconds);
      this.state.productionElapsed[buildingId] = elapsed - cycles * building.productionSeconds;
      if (cycles === 0) continue;

      let amount = cycles * building.productionAmount;
      if (buildingId === "bakery" && hasFarm) amount *= 2;
      if (buildingId === "sawmill" && hasWoodcutter) amount *= 2;
      if (buildingId === "butchery" && hasSwineFarm) amount *= 2;
      if (buildingId === "winery" && hasOrchard) amount *= 2;
      if (buildingId === "weapons-workshop" && hasBlacksmith) amount *= 2;
      if (buildingId === "barracks" && hasWeaponsWorkshop) amount *= 2;
      this.state.resources[building.resource] += amount;
      events.push({ type: "resource-produced", buildingId, resource: building.resource, total: this.state.resources[building.resource] });
    }
  }
}
