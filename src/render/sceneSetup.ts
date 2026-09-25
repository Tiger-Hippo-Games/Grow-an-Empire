import * as THREE from "three";

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

/** Which stage layout index.html chose: the scaled 1280×720 stage, or the frame's own shape. */
function stageLayout(): "fixed" | "fluid" {
  return (window as Window & { __gaeLayout?: string }).__gaeLayout === "fluid" ? "fluid" : "fixed";
}

/** A rectangle in viewport pixels. */
interface Area { left: number; top: number; right: number; bottom: number }

/**
 * The part of the viewport the panels leave uncovered, on phones (the compact
 * fluid layouts in styles.css), or null when the panels overlay the city as
 * designed (the fixed stage, tablets, larger windows). The panel sizes here
 * mirror styles.css: change them together.
 */
function freeArea(width: number, height: number): Area | null {
  if (stageLayout() !== "fluid") return null;
  const measured = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--settlement-bottom"));
  const barsBottom = Number.isFinite(measured) && measured > 0 ? measured : height * 0.3;
  if (width > height && height <= 540) {
    // Phone landscape: build panel column on the right, controls at the bottom left.
    const panel = Math.min(340, Math.max(280, width * 0.38)) + 20;
    return { left: 0, top: barsBottom * 0.8, right: width - panel, bottom: height - 56 };
  }
  if (height >= width && width <= 760) {
    // Portrait: build panel at the bottom, above the controls.
    const panel = Math.min(height * 0.46, 440) + 64;
    return { left: 0, top: barsBottom, right: width, bottom: height - panel };
  }
  return null;
}

/**
 * The part of the city kept in the uncovered area when the panels leave only
 * part of the screen (world units; the painted terrain is 71 × 40 and the
 * buildings span about 61 × 28 around the Town Hall). Showing all of it would
 * make the buildings too small on a phone, so the outermost plots may sit
 * under a panel or past the edge.
 */
const CITY_FOCUS = { width: 52, height: 24, x: 1, y: 0 };

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
    const free = freeArea(width, height);
    let viewHeight: number;
    if (free) {
      // Fit the city into the uncovered area and centre it there.
      const freeWidth = Math.max(0.25, (free.right - free.left) / width);
      const freeHeight = Math.max(0.2, (free.bottom - free.top) / height);
      viewHeight = Math.max(CITY_FOCUS.height / freeHeight, CITY_FOCUS.width / freeWidth / aspect);
      const viewWidth = viewHeight * aspect;
      const centerX = (free.left + free.right) / 2 / width;
      const centerY = (free.top + free.bottom) / 2 / height;
      camera.position.x = CITY_FOCUS.x - viewWidth * (centerX - 0.5);
      camera.position.y = CITY_FOCUS.y - viewHeight * (0.5 - centerY);
    } else {
      viewHeight = Math.max(MIN_VIEW_HEIGHT, CITY_WIDTH_WITH_MARGIN / aspect);
      // Raise the map above the choice panel, leaving the southern districts visible.
      camera.position.x = 0;
      camera.position.y = -2.5;
    }
    camera.left = (-viewHeight * aspect) / 2;
    camera.right = (viewHeight * aspect) / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
  }

  /** The world-space rectangle the camera currently shows. */
  function viewBounds(): { width: number; height: number; centerX: number; centerY: number } {
    return { width: camera.right - camera.left, height: camera.top - camera.bottom, centerX: camera.position.x, centerY: camera.position.y };
  }

  return { renderer, scene, camera, resize, quality, viewBounds };
}
