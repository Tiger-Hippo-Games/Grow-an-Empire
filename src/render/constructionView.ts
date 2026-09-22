import * as THREE from "three";
import { BUILDINGS, HARVEST_PHASES } from "../game/content";
import { loadSpriteAsset, spriteFromAsset, type SpriteAsset } from "./spriteAssets";
import { civicGround, getBuildingPosition, treeGround, type CityLayout } from "./cityLayout";
import type { WorkerAnimation } from "./workerAnimation";

export type ConstructionStage = "foundation" | "frame" | "late" | "complete";
export type SetStatus = (label: string, progress: number) => void;

const STAGE_HEIGHTS: Record<ConstructionStage, number> = { foundation: 2.7, frame: 3.0, late: 3.15, complete: 3.25 };
const CONSTRUCTION_STAGES: ConstructionStage[] = ["foundation", "frame", "late", "complete"];

export function buildingFilename(buildingId: string, stage: ConstructionStage): string {
  const prefix = BUILDINGS[buildingId].artKey;
  if (stage === "complete") return `${prefix}-level-1-2x-v1.png`;
  const suffix = stage === "foundation" ? "01-foundation" : stage === "frame" ? "02-frame" : "03-late";
  return `${prefix}-construction-${suffix}-2x-v1.png`;
}

/**
 * Owns every constructed/constructing building's plot sprites, the shared
 * "active builder" animation while a plot is under construction or the
 * Woodcutter is harvesting, and the brief production pulse on completed
 * buildings. This is the render-side mirror of the simulation's construction
 * and production concepts — it never advances gameplay, only visualizes it.
 */
export function createConstructionView(scene: THREE.Scene, workerAnimation: WorkerAnimation, cityLayout: CityLayout, setStatus: SetStatus) {
  const buildingAssets = new Map<string, Record<ConstructionStage, SpriteAsset>>();
  const plotSprites = new Map<number, Record<ConstructionStage, THREE.Sprite>>();
  const plotBuildingIds = new Map<number, string>();
  const productionPulseUntil = new Map<string, number>();

  async function loadBuildingAssets(): Promise<void> {
    await Promise.all(Object.keys(BUILDINGS).map(async (buildingId) => {
      const stages = {} as Record<ConstructionStage, SpriteAsset>;
      await Promise.all(CONSTRUCTION_STAGES.map(async (stage) => {
        stages[stage] = await loadSpriteAsset(buildingFilename(buildingId, stage));
      }));
      buildingAssets.set(buildingId, stages);
    }));
  }

  function createPlotSprites(buildingId: string, plotIndex: number): void {
    const assets = buildingAssets.get(buildingId)!;
    const sprites = {} as Record<ConstructionStage, THREE.Sprite>;
    const plot = getBuildingPosition(buildingId);
    for (const stage of CONSTRUCTION_STAGES) {
      const sprite = spriteFromAsset(assets[stage], STAGE_HEIGHTS[stage]);
      sprite.position.set(plot.x, plot.y + sprite.scale.y / 2, 1.5);
      sprite.renderOrder = 20 + plotIndex;
      sprite.visible = false;
      sprites[stage] = sprite;
      scene.add(sprite);
    }
    plotSprites.set(plotIndex, sprites);
    plotBuildingIds.set(plotIndex, buildingId);
  }

  function showPlotStage(plotIndex: number, stage: ConstructionStage): void {
    const sprites = plotSprites.get(plotIndex);
    if (!sprites) return;
    for (const [key, sprite] of Object.entries(sprites)) sprite.visible = key === stage;
  }

  function clearPlots(): void {
    for (const sprites of plotSprites.values()) {
      for (const sprite of Object.values(sprites)) scene.remove(sprite);
    }
    plotSprites.clear();
    plotBuildingIds.clear();
    productionPulseUntil.clear();
  }

  function markProduced(buildingId: string, animationElapsed: number): void {
    productionPulseUntil.set(buildingId, animationElapsed + 0.8);
  }

  /** Drives the worker + plot-stage visuals for the building currently under construction. */
  function renderConstruction(buildingId: string, plotIndex: number, progress: number, constructionElapsed: number, animationElapsed: number): void {
    const plot = getBuildingPosition(buildingId);
    const name = BUILDINGS[buildingId].name;
    cityLayout.placementMaterial.opacity = 0.13 + Math.sin(animationElapsed * 5) * 0.05;
    workerAnimation.worker.visible = true;

    if (progress < 0.22) {
      setStatus(`Surveying the ${name} site`, progress);
      workerAnimation.moveWorker(civicGround, plot, progress / 0.22);
      workerAnimation.useClip("walk", "southeast", workerAnimation.frameFor("walk", "southeast", constructionElapsed));
      showPlotStage(plotIndex, "foundation");
    } else if (progress < 0.5) {
      setStatus(`Laying the ${name} foundation`, progress);
      workerAnimation.placeWorker(plot);
      workerAnimation.useClip("chop", "southwest", workerAnimation.frameFor("chop", "southwest", constructionElapsed));
      showPlotStage(plotIndex, "foundation");
    } else if (progress < 0.76) {
      setStatus(`Raising the ${name} frame`, progress);
      workerAnimation.placeWorker(plot);
      workerAnimation.useClip("chop", "southwest", workerAnimation.frameFor("chop", "southwest", constructionElapsed));
      showPlotStage(plotIndex, "frame");
    } else if (progress < 0.94) {
      setStatus(`Finishing the ${name}`, progress);
      workerAnimation.placeWorker(plot);
      workerAnimation.useClip("chop", "southwest", workerAnimation.frameFor("chop", "southwest", constructionElapsed));
      showPlotStage(plotIndex, "late");
    } else {
      setStatus(`Opening the new ${name}`, progress);
      showPlotStage(plotIndex, "complete");
    }
  }

  /** The Woodcutter's dedicated travel -> chop -> pickup -> carry -> deposit loop; the only profession-specific animation today. */
  function renderWoodcutterActivity(animationElapsed: number, builtBuildingIds: string[]): void {
    const plotIndex = builtBuildingIds.indexOf("woodcutter");
    if (plotIndex < 0) {
      workerAnimation.worker.visible = false;
      return;
    }
    const home = getBuildingPosition("woodcutter");
    const cycleDuration = HARVEST_PHASES.reduce((sum, phase) => sum + phase.duration, 0);
    let cursor = animationElapsed % cycleDuration;
    let phase: (typeof HARVEST_PHASES)[number] = HARVEST_PHASES[0];
    for (const candidate of HARVEST_PHASES) {
      if (cursor <= candidate.duration) { phase = candidate; break; }
      cursor -= candidate.duration;
    }
    const progress = cursor / phase.duration;
    workerAnimation.worker.visible = true;
    if (phase.name === "travel") {
      workerAnimation.moveWorker(home, treeGround, progress);
      workerAnimation.useClip("walk", "southeast", workerAnimation.frameFor("walk", "southeast", cursor));
    } else if (phase.name === "chop" || phase.name === "fall") {
      workerAnimation.placeWorker(treeGround);
      workerAnimation.useClip("chop", "southeast", workerAnimation.frameFor("chop", "southeast", cursor));
    } else if (phase.name === "pickup") {
      workerAnimation.placeWorker(treeGround);
      workerAnimation.useClip("pickup", "southeast", Math.min(7, Math.floor(progress * 8)));
    } else if (phase.name === "carry") {
      workerAnimation.moveWorker(treeGround, home, progress);
      workerAnimation.useClip("carry", "southwest", workerAnimation.frameFor("carry", "southwest", cursor));
    } else {
      workerAnimation.placeWorker(home);
      workerAnimation.useClip("pickup", "southwest", 7 - Math.min(7, Math.floor(progress * 8)));
    }
  }

  function renderProductionPulses(animationElapsed: number): void {
    for (const [plotIndex, buildingId] of plotBuildingIds) {
      const sprite = plotSprites.get(plotIndex)?.complete;
      if (!sprite?.visible) continue;
      const base = sprite.userData.baseScale as THREE.Vector3;
      const active = (productionPulseUntil.get(buildingId) ?? 0) > animationElapsed;
      const until = productionPulseUntil.get(buildingId) ?? 0;
      const bump = active ? 1 + Math.sin((until - animationElapsed) * Math.PI * 4) * 0.025 : 1;
      sprite.scale.set(base.x * bump, base.y * bump, 1);
    }
  }

  return {
    loadBuildingAssets,
    createPlotSprites,
    showPlotStage,
    clearPlots,
    markProduced,
    renderConstruction,
    renderWoodcutterActivity,
    renderProductionPulses,
  };
}
