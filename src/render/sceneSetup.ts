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

  /** World units visible vertically; the horizontal extent follows the viewport's aspect ratio. */
  const VIEW_HEIGHT = 40;

  /** Matches the canvas and camera to the viewport's current size. Call on window resize. */
  function resize(): void {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    renderer.setSize(width, height, false);
    const aspect = width / Math.max(height, 1);
    camera.left = (-VIEW_HEIGHT * aspect) / 2;
    camera.right = (VIEW_HEIGHT * aspect) / 2;
    camera.top = VIEW_HEIGHT / 2;
    camera.bottom = -VIEW_HEIGHT / 2;
    camera.updateProjectionMatrix();
  }

  return { renderer, scene, camera, resize };
}
