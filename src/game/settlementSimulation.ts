import {
  CONSTRUCTION_DURATION_SECONDS,
  HARVEST_PHASES,
  OPENING_BUILD_OPTIONS,
  type HarvestPhaseDefinition,
} from "./content";

export type SimulationMode = "awaiting-choice" | "construction" | "harvesting" | "operating";

export type SimulationEvent =
  | { type: "construction-started"; buildingId: string }
  | { type: "construction-complete"; buildingId: string }
  | { type: "harvest-phase-changed"; phase: HarvestPhaseDefinition }
  | { type: "resource-produced"; resource: "wood" | "grain" | "food"; total: number };

export interface SettlementState {
  mode: SimulationMode;
  move: number;
  wood: number;
  grain: number;
  food: number;
  population: number;
  selectedBuildingId: string | null;
  constructionElapsed: number;
  harvestPhaseIndex: number;
  harvestElapsed: number;
  productionElapsed: number;
}

export class SettlementSimulation {
  readonly state: SettlementState = {
    mode: "awaiting-choice",
    move: 1,
    wood: 0,
    grain: 0,
    food: 0,
    population: 2,
    selectedBuildingId: null,
    constructionElapsed: 0,
    harvestPhaseIndex: 0,
    harvestElapsed: 0,
    productionElapsed: 0,
  };

  get constructionProgress(): number {
    return Math.min(1, this.state.constructionElapsed / CONSTRUCTION_DURATION_SECONDS);
  }

  get harvestPhase(): HarvestPhaseDefinition {
    return HARVEST_PHASES[this.state.harvestPhaseIndex];
  }

  get harvestProgress(): number {
    return Math.min(1, this.state.harvestElapsed / this.harvestPhase.duration);
  }

  chooseBuilding(buildingId: string): SimulationEvent[] {
    if (this.state.mode !== "awaiting-choice" || !OPENING_BUILD_OPTIONS.includes(buildingId as typeof OPENING_BUILD_OPTIONS[number])) return [];
    this.state.mode = "construction";
    this.state.selectedBuildingId = buildingId;
    this.state.constructionElapsed = 0;
    return [{ type: "construction-started", buildingId }];
  }

  reset(): void {
    Object.assign(this.state, {
      mode: "awaiting-choice",
      move: 1,
      wood: 0,
      grain: 0,
      food: 0,
      population: 2,
      selectedBuildingId: null,
      constructionElapsed: 0,
      harvestPhaseIndex: 0,
      harvestElapsed: 0,
      productionElapsed: 0,
    });
  }

  update(seconds: number): SimulationEvent[] {
    if (!Number.isFinite(seconds) || seconds <= 0 || this.state.mode === "awaiting-choice") return [];
    const events: SimulationEvent[] = [];
    let remaining = seconds;

    if (this.state.mode === "construction") {
      const untilComplete = CONSTRUCTION_DURATION_SECONDS - this.state.constructionElapsed;
      const consumed = Math.min(remaining, untilComplete);
      this.state.constructionElapsed += consumed;
      remaining -= consumed;
      if (this.state.constructionElapsed >= CONSTRUCTION_DURATION_SECONDS) {
        const completedBuildingId = this.state.selectedBuildingId!;
        this.state.mode = completedBuildingId === "woodcutter" ? "harvesting" : "operating";
        this.state.move = 2;
        this.state.harvestPhaseIndex = 0;
        this.state.harvestElapsed = 0;
        events.push({ type: "construction-complete", buildingId: completedBuildingId });
        if (this.state.mode === "harvesting") events.push({ type: "harvest-phase-changed", phase: this.harvestPhase });
      }
    }

    while (remaining > 0 && this.state.mode === "harvesting") {
      const untilNextPhase = this.harvestPhase.duration - this.state.harvestElapsed;
      const consumed = Math.min(remaining, untilNextPhase);
      this.state.harvestElapsed += consumed;
      remaining -= consumed;
      if (this.state.harvestElapsed >= this.harvestPhase.duration) {
        this.state.harvestElapsed = 0;
        this.state.harvestPhaseIndex = (this.state.harvestPhaseIndex + 1) % HARVEST_PHASES.length;
        if (this.harvestPhase.name === "stockpile") {
          this.state.wood += 1;
          events.push({ type: "resource-produced", resource: "wood", total: this.state.wood });
        }
        events.push({ type: "harvest-phase-changed", phase: this.harvestPhase });
      }
    }

    if (remaining > 0 && this.state.mode === "operating") {
      this.state.productionElapsed += remaining;
      while (this.state.productionElapsed >= 8) {
        this.state.productionElapsed -= 8;
        const resource = this.state.selectedBuildingId === "farm" ? "grain" : "food";
        this.state[resource] += 1;
        events.push({ type: "resource-produced", resource, total: this.state[resource] });
      }
    }

    return events;
  }
}
