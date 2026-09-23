import * as THREE from "three";

/**
 * Owns the renderer, scene, and camera. This is intentionally minimal: it
 * knows nothing about buildings, villagers, or the simulation. Everything
 * else in `render/` and `main.ts` is handed the `scene` it returns and adds
 * its own objects to it.
 */
export function createSceneSetup(viewport: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

  return { renderer, scene, camera, resize };
}
