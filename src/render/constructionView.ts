import * as THREE from "three";
import { BUILDINGS, HARVEST_PHASES } from "../game/content";
import { loadSpriteAsset, spriteFromAsset, type SpriteAsset } from "./spriteAssets";
import { civicGround, getBuildingPosition, treeGround, type CityLayout } from "./cityLayout";
import type { WorkerAnimation } from "./workerAnimation";
import { CITY_ANIMATION } from "./animationDesign";

/** The four art states of a building plot, in order. */
export type ConstructionStage = "foundation" | "frame" | "late" | "complete";
/** Callback that updates the HUD's activity label and progress bar. */
export type SetStatus = (label: string, progress: number) => void;

const STAGE_HEIGHTS: Record<ConstructionStage, number> = { foundation: 2.7, frame: 3.0, late: 3.15, complete: 3.25 };
const CONSTRUCTION_STAGES: ConstructionStage[] = ["foundation", "frame", "late", "complete"];

/**
 * Art filename for a building at a construction stage, e.g. `farm-construction-02-frame-2x-v1.png`.
 * @throws Error for an id that isn't in the building catalog.
 */
export function buildingFilename(buildingId: string, stage: ConstructionStage): string {
  const definition = BUILDINGS[buildingId];
  if (!definition) throw new Error(`Unknown building "${buildingId}"`);
  const prefix = definition.artKey;
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
  const loadingAssets = new Map<string, Promise<void>>();
  const plotSprites = new Map<number, Record<ConstructionStage, THREE.Sprite>>();
  const plotBuildingIds = new Map<number, string>();
  const productionPulseUntil = new Map<string, number>();

  // The full catalog is 15 buildings x 4 stages of real production art (tens of
  // MB) — loading it all unconditionally at boot regardless of which buildings
  // a given playthrough will ever touch is real, measured load-time and decode
  // cost for no benefit. Buildings are loaded on demand instead: once when a
  // building first becomes one of the offered choices (well before the player
  // can click it), and defensively awaited again right before it's actually
  // placed, so correctness never depends on timing.
  //
  // A failed load is removed from the in-flight cache, so the next call retries
  // instead of returning the same rejected promise forever. That matters on a
  // flaky connection: one dropped request shouldn't make a building unbuildable
  // for the rest of the session.
  /** Loads (once) and caches all four stage images for one building. Safe to call repeatedly. */
  function ensureBuildingAssetsLoaded(buildingId: string): Promise<void> {
    if (buildingAssets.has(buildingId)) return Promise.resolve();
    const inFlight = loadingAssets.get(buildingId);
    if (inFlight) return inFlight;
    const promise = (async () => {
      const stages = {} as Record<ConstructionStage, SpriteAsset>;
      await Promise.all(CONSTRUCTION_STAGES.map(async (stage) => {
        stages[stage] = await loadSpriteAsset(buildingFilename(buildingId, stage));
      }));
      buildingAssets.set(buildingId, stages);
    })();
    loadingAssets.set(buildingId, promise);
    promise.then(
      () => loadingAssets.delete(buildingId),
      () => loadingAssets.delete(buildingId),
    );
    return promise;
  }

  /** True once a building's art is cached, so plot sprites can be created synchronously. */
  function hasBuildingAssets(buildingId: string): boolean {
    return buildingAssets.has(buildingId);
  }

  /** Loads several buildings in parallel. Rejects if any of them fails (the others still get cached). */
  async function loadBuildingAssets(buildingIds: string[]): Promise<void> {
    await Promise.all(buildingIds.map((buildingId) => ensureBuildingAssetsLoaded(buildingId)));
  }

  /**
   * Creates the four (initially hidden) stage sprites for a plot.
   * If the plot already has sprites (e.g. re-hydrating), they are replaced rather than duplicated.
   * @throws Error if the building's art hasn't been loaded; await `ensureBuildingAssetsLoaded` first.
   */
  function createPlotSprites(buildingId: string, plotIndex: number): void {
    const assets = buildingAssets.get(buildingId);
    if (!assets) throw new Error(`Art for "${buildingId}" must be loaded before its plot is created`);
    removePlot(plotIndex);
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

  /** Shows exactly one stage sprite for a plot. A no-op for a plot that doesn't exist. */
  function showPlotStage(plotIndex: number, stage: ConstructionStage): void {
    const sprites = plotSprites.get(plotIndex);
    if (!sprites) return;
    for (const [key, sprite] of Object.entries(sprites)) sprite.visible = key === stage;
  }

  /** Removes one plot's sprites from the scene and frees their materials (textures stay cached for reuse). */
  function removePlot(plotIndex: number): void {
    const sprites = plotSprites.get(plotIndex);
    if (!sprites) return;
    for (const sprite of Object.values(sprites)) {
      scene.remove(sprite);
      sprite.material.dispose();
    }
    plotSprites.delete(plotIndex);
    plotBuildingIds.delete(plotIndex);
  }

  /** Removes every plot (used on restart and before re-hydrating a save). */
  function clearPlots(): void {
    for (const plotIndex of [...plotSprites.keys()]) removePlot(plotIndex);
    plotSprites.clear();
    plotBuildingIds.clear();
    productionPulseUntil.clear();
  }

  /** Starts a short scale "pulse" on a completed building to show it produced this move. */
  function markProduced(buildingId: string, animationElapsed: number): void {
    productionPulseUntil.set(buildingId, animationElapsed + CITY_ANIMATION.productionPulseSeconds);
  }

  /**
   * Drives the worker + plot-stage visuals for the building under construction.
   * `progress` (0–1) selects the phase using the thresholds in `CITY_ANIMATION.construction`:
   * survey (walk to site) → foundation → frame → finishing → opening.
   */
  function renderConstruction(buildingId: string, plotIndex: number, progress: number, constructionElapsed: number, animationElapsed: number): void {
    const plot = getBuildingPosition(buildingId);
    const name = BUILDINGS[buildingId].name;
    cityLayout.placementMaterial.opacity = 0.13 + Math.sin(animationElapsed * Math.PI * 2 * CITY_ANIMATION.construction.placementPulseHz) * 0.05;
    workerAnimation.worker.visible = true;

    if (progress < CITY_ANIMATION.construction.surveyEnd) {
      setStatus(`Surveying the ${name} site`, progress);
      workerAnimation.moveWorker(civicGround, plot, progress / CITY_ANIMATION.construction.surveyEnd);
      workerAnimation.useClip("walk", "southeast", workerAnimation.frameFor("walk", "southeast", constructionElapsed));
      showPlotStage(plotIndex, "foundation");
    } else if (progress < CITY_ANIMATION.construction.foundationEnd) {
      setStatus(`Laying the ${name} foundation`, progress);
      workerAnimation.placeWorker(plot);
      workerAnimation.useClip("chop", "southwest", workerAnimation.frameFor("chop", "southwest", constructionElapsed));
      showPlotStage(plotIndex, "foundation");
    } else if (progress < CITY_ANIMATION.construction.frameEnd) {
      setStatus(`Raising the ${name} frame`, progress);
      workerAnimation.placeWorker(plot);
      workerAnimation.useClip("chop", "southwest", workerAnimation.frameFor("chop", "southwest", constructionElapsed));
      showPlotStage(plotIndex, "frame");
    } else if (progress < CITY_ANIMATION.construction.finishingEnd) {
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

  /** Per-frame: applies the production pulse scale to completed buildings. */
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
    ensureBuildingAssetsLoaded,
    hasBuildingAssets,
    createPlotSprites,
    showPlotStage,
    clearPlots,
    markProduced,
    renderConstruction,
    renderWoodcutterActivity,
    renderProductionPulses,
  };
}
