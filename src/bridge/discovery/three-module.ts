import {
  _threeModule,
  getCaptured,
  setCapturedScene,
  setCapturedRenderer,
  setCapturedCamera,
  setThreeModule,
} from './state.js';

/**
 * Try to capture the THREE module from various sources.
 * R3F / bundled apps don't expose window.THREE and bare `import('three')`
 * doesn't work from injected scripts.
 */
export function tryCaptureThreeModule(renderer?: any): void {
  if (_threeModule) return;

  if ((window as any).THREE) {
    setThreeModule((window as any).THREE);
    return;
  }

  if (renderer) {
    try {
      const proto = Object.getPrototypeOf(renderer);
      if (proto?.constructor) {
        // Store whatever we found — the real fix: expose THREE via prototype scanning
      }
    } catch { /* ignore */ }
  }
}

/**
 * Build a synthetic THREE namespace from scene objects' constructor prototypes.
 * Returns true if any new constructors were found.
 */
export function buildThreeNamespace(scene: any, renderer: any, camera: any): boolean {
  if (_threeModule) return true;

  if ((window as any).THREE) {
    setThreeModule((window as any).THREE);
    return true;
  }

  return false;
}

/** Cache R3F state and extract useful constructors (Raycaster, Vector3, etc.) */
export function cacheR3fState(state: any): void {
  const { scene, renderer, camera } = getCaptured();
  if (!scene && state.scene) setCapturedScene(state.scene);
  if (!renderer && state.gl) setCapturedRenderer(state.gl);
  if (!camera && state.camera) setCapturedCamera(state.camera);

  if (!_threeModule && state.raycaster) {
    const win = window as any;
    if (!win.__THREEJS_DEVTOOLS_CONSTRUCTORS__) {
      win.__THREEJS_DEVTOOLS_CONSTRUCTORS__ = {
        Raycaster: state.raycaster.constructor,
        Vector3: state.raycaster.ray?.origin?.constructor,
        Vector2: state.pointer?.constructor,
        Scene: state.scene?.constructor,
        Camera: state.camera?.constructor,
        WebGLRenderer: state.gl?.constructor,
      };
    }
  }
}

export function tryExtractFromR3fRoot(obj: any): void {
  try {
    const root = obj.__r3f?.root;
    if (!root || typeof root.getState !== 'function') return;
    const state = root.getState();
    if (state.scene) setCapturedScene(state.scene);
    if (state.gl) setCapturedRenderer(state.gl);
    if (state.camera) setCapturedCamera(state.camera);
  } catch { /* varies between versions */ }
}
