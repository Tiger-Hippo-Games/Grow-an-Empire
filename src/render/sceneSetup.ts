import * as THREE from "three";

/**
 * Owns the renderer, scene, and camera. This is intentionally minimal: it
 * knows nothing about buildings, villagers, or the simulation. Everything
 * else in `render/` and `main.ts` is handed the `scene` it returns and adds
 * its own objects to it.
 */
export type QualityTier = "high" | "low";

/**
 * How much the 1280×720 stage is scaled on screen (index.html fits it to the
 * window or portal frame; 1.5 in a 1920×1080 frame). The canvas is laid out at
 * 1280×720, so the pixel ratio must include this scale to stay sharp.
 */
function stageScale(): number {
  const scale = (window as Window & { __gaeStageScale?: number }).__gaeStageScale;
  return typeof scale === "number" && scale > 0 ? scale : 1;
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

  /** Keep every district within the camera, even when the app panel is nearly square. */
  const MIN_VIEW_HEIGHT = 44;
  const CITY_WIDTH_WITH_MARGIN = 76;

  /** Matches the canvas and camera to the viewport's current size. Call on window resize. */
  function resize(): void {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    // A hidden or 0x0 iframe reports zero size. Keep the last good camera
    // rather than computing Infinity/NaN bounds; the next resize fixes it.
    if (width === 0 || height === 0) return;
    quality.set(quality.tier); // The stage scale may have changed with the window.
    renderer.setSize(width, height, false);
    const aspect = width / Math.max(height, 1);
    const viewHeight = Math.max(MIN_VIEW_HEIGHT, CITY_WIDTH_WITH_MARGIN / aspect);
    camera.left = (-viewHeight * aspect) / 2;
    camera.right = (viewHeight * aspect) / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    // Raise the map above the choice panel, leaving the southern districts visible.
    camera.position.y = -2.5;
    camera.updateProjectionMatrix();
  }

  /** The world-space rectangle the camera currently shows. */
  function viewBounds(): { width: number; height: number; centerX: number; centerY: number } {
    return { width: camera.right - camera.left, height: camera.top - camera.bottom, centerX: camera.position.x, centerY: camera.position.y };
  }

  return { renderer, scene, camera, resize, quality, viewBounds };
}
