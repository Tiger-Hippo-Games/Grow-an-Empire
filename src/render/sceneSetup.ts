import * as THREE from "three";
import { fitCityCamera, type ScreenArea } from "./cameraFit";

/**
 * Owns the renderer, scene, and camera. This is intentionally minimal: it
 * knows nothing about buildings, villagers, or the simulation. Everything
 * else in `render/` and `main.ts` is handed the `scene` it returns and adds
 * its own objects to it.
 */
export type QualityTier = "high" | "low";

/**
 * How much the stage is scaled on screen (index.html fits it to the window or
 * portal frame; 1.5 for the fixed stage in a 1920×1080 frame, usually 1 in the
 * fluid layout). The canvas is laid out in stage pixels, so the pixel ratio
 * must include this scale to stay sharp.
 */
function stageScale(): number {
  const scale = (window as Window & { __gaeStageScale?: number }).__gaeStageScale;
  return typeof scale === "number" && scale > 0 ? scale : 1;
}

/** Visible chrome is measured in stage pixels; retracted controls do not reserve space. */
function freeArea(width: number, height: number): ScreenArea {
  const viewport = document.getElementById("viewport");
  const box = viewport?.getBoundingClientRect();
  const scale = box && box.width > 0 ? width / box.width : 1;
  const area = { left: 12, right: width - 12, top: 12, bottom: height - 12 };
  if (!box) return area;
  for (const selector of ["#resource-hud", ".speed-control", ".hud", "#build-panel", ".controls", "#city-ui-toggle"]) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element || element.offsetParent === null || getComputedStyle(element).opacity === "0") continue;
    const rect = element.getBoundingClientRect();
    if (rect.right <= box.left || rect.left >= box.right || rect.bottom <= box.top || rect.top >= box.bottom) continue;
    if (["#build-panel", ".controls", "#city-ui-toggle"].includes(selector)) area.bottom = Math.min(area.bottom, (rect.top - box.top) * scale - 12);
    else area.top = Math.max(area.top, (rect.bottom - box.top) * scale + 12);
  }
  // Transient dialogs may cover the city, but never produce an invalid camera.
  area.bottom = Math.max(area.top + 1, area.bottom);
  return area;
}

export function createSceneSetup(viewport: HTMLElement) {
  // MSAA mostly matters on 1x screens; on 2x+ screens the extra pixels already
  // smooth sprite edges, so skip its cost there (MOBILE_PERFORMANCE §15).
  const renderer = new THREE.WebGLRenderer({ antialias: window.devicePixelRatio < 2, alpha: false });
  const requested = new URLSearchParams(window.location.search).get("quality");
  const quality = {
    tier: (requested === "low" ? "low" : "high") as QualityTier,
    /**
     * high: one render pixel per screen pixel (stage scale × device pixel ratio), capped at 2;
     * low: at most 1 (about a quarter of the pixels on a high-density phone).
     */
    set(tier: QualityTier): void {
      quality.tier = tier;
      const screenRatio = stageScale() * window.devicePixelRatio;
      renderer.setPixelRatio(tier === "low" ? Math.min(screenRatio, 1) : Math.min(screenRatio, 2));
    },
  };
  quality.set(quality.tier);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x78945a, 1);
  viewport.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-7, 7, 4, -4, 0.1, 100);
  camera.position.set(0, 0, 10);

  /** Matches the canvas and camera to the viewport's current size. Call on window resize. */
  function resize(): void {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    // A hidden or 0x0 iframe reports zero size. Keep the last good camera
    // rather than computing Infinity/NaN bounds; the next resize fixes it.
    if (width === 0 || height === 0) return;
    quality.set(quality.tier); // The stage scale may have changed with the window.
    renderer.setSize(width, height, false);
    const fit = fitCityCamera(width, height, freeArea(width, height));
    camera.position.x = fit.x;
    camera.position.y = fit.y;
    camera.left = -fit.width / 2;
    camera.right = fit.width / 2;
    camera.top = fit.height / 2;
    camera.bottom = -fit.height / 2;
    camera.updateProjectionMatrix();
  }

  /** The world-space rectangle the camera currently shows. */
  function viewBounds(): { width: number; height: number; centerX: number; centerY: number } {
    return { width: camera.right - camera.left, height: camera.top - camera.bottom, centerX: camera.position.x, centerY: camera.position.y };
  }

  return { renderer, scene, camera, resize, quality, viewBounds };
}
