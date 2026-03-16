import type { ThreeContext } from './types.js';

let _capturedScene: any = null;
let _capturedRenderer: any = null;
let _capturedCamera: any = null;
let _threeModule: any = null;

/**
 * Get the captured THREE module (or null if not yet resolved).
 * Falls back to constructors extracted from R3F state.
 * Note: R3F fallback only has constructors actually used by the app (tree-shaking),
 * so helpers like BoxHelper/ArrowHelper may not be available.
 */
export function getThreeModule(): any {
  if (_threeModule) return _threeModule;
  const win = window as any;
  // Full THREE module from window.THREE or injected capture script
  if (win.THREE) { _threeModule = win.THREE; return _threeModule; }
  if (win.__THREEJS_DEVTOOLS_THREE__) { _threeModule = win.__THREEJS_DEVTOOLS_THREE__; return _threeModule; }
  // Partial: constructors extracted from R3F state (Raycaster, Vector3, etc.)
  if (win.__THREEJS_DEVTOOLS_CONSTRUCTORS__) return win.__THREEJS_DEVTOOLS_CONSTRUCTORS__;
  return null;
}

/** Set the THREE module externally (e.g. from dynamic import). */
export function setThreeModule(mod: any): void {
  _threeModule = mod;
}

export function discoverThreeJS(): ThreeContext | null {
  const win = window as any;

  if (win.__THREE_SCENE__ && win.__THREE_RENDERER__) {
    return {
      scene: win.__THREE_SCENE__,
      renderer: win.__THREE_RENDERER__,
      camera: win.__THREE_CAMERA__ || null,
      gl: win.__THREE_RENDERER__.getContext?.(),
    };
  }

  // Strategy 2a: R3F store on canvas.__r3f
  const canvases = document.querySelectorAll('canvas');
  for (const canvas of canvases) {
    const r3f = (canvas as any).__r3f;
    if (r3f) {
      const state = typeof r3f.store?.getState === 'function'
        ? r3f.store.getState() : r3f;
      if (state.scene && state.gl) {
        cacheR3fState(state);
        return {
          scene: state.scene, renderer: state.gl, camera: state.camera,
          gl: state.gl.getContext?.() || state.gl.domElement?.getContext('webgl2'),
        };
      }
    }
  }

  // Strategy 2b: R3F store on scene.__r3f.root (Next.js 16 / React 19)
  if (_capturedScene) {
    const r3fRoot = (_capturedScene as any).__r3f?.root;
    if (r3fRoot) {
      const getState = r3fRoot.getState || r3fRoot?.store?.getState;
      if (typeof getState === 'function') {
        const state = getState();
        if (state?.scene && state?.gl) {
          cacheR3fState(state);
          return {
            scene: state.scene, renderer: state.gl, camera: state.camera,
            gl: state.gl.getContext?.() || state.gl.domElement?.getContext('webgl2'),
          };
        }
      }
    }
  }

  if (_capturedRenderer && _capturedScene) {
    if (!_threeModule) tryCaptureThreeModule(_capturedRenderer);
    if (!_capturedCamera) tryExtractFromR3fRoot(_capturedScene);
    if (!_capturedCamera) {
      _capturedScene.traverse((obj: any) => {
        if (!_capturedCamera && (obj.isCamera || obj.isPerspectiveCamera)) {
          _capturedCamera = obj;
        }
      });
    }
    return {
      scene: _capturedScene, renderer: _capturedRenderer,
      camera: _capturedCamera, gl: _capturedRenderer.getContext?.(),
    };
  }

  return null;
}

export function setupCapture(): void {
  if ((window as any).__THREEJS_DEVTOOLS_BRIDGE_CAPTURE__) return;
  (window as any).__THREEJS_DEVTOOLS_BRIDGE_CAPTURE__ = true;

  const win = window as any;
  if (typeof win.__THREE_DEVTOOLS__ === 'undefined') {
    win.__THREE_DEVTOOLS__ = new EventTarget();
  }

  win.__THREE_DEVTOOLS__.addEventListener('observe', (event: any) => {
    const obj = event.detail;
    if (!obj) return;
    if (obj.isScene) { _capturedScene = obj; tryExtractFromR3fRoot(obj); }
    if (obj.isWebGLRenderer || obj.domElement instanceof HTMLCanvasElement) {
      _capturedRenderer = obj;
      // Try to capture THREE module from renderer
      tryCaptureThreeModule(obj);
    }
    if (obj.isCamera && !_capturedCamera) _capturedCamera = obj;
  });

  let attempts = 0;
  const poll = setInterval(() => {
    attempts++;
    if (attempts > 120 || (_capturedRenderer && _capturedScene)) { clearInterval(poll); return; }

    const canvases = document.querySelectorAll('canvas');
    for (const canvas of canvases) {
      const r3f = (canvas as any).__r3f;
      if (r3f) {
        const state = typeof r3f.store?.getState === 'function'
          ? r3f.store.getState() : r3f;
        if (state.scene && state.gl) {
          _capturedScene = state.scene;
          _capturedRenderer = state.gl;
          _capturedCamera = state.camera;
          clearInterval(poll);
          return;
        }
      }
    }
    if (_capturedScene && !_capturedRenderer) tryExtractFromR3fRoot(_capturedScene);
  }, 500);
}

/**
 * Try to capture the THREE module from various sources.
 * R3F / bundled apps don't expose window.THREE and bare `import('three')`
 * doesn't work from injected scripts. So we extract constructors from
 * existing scene objects' prototype chains and build a synthetic module.
 */
function tryCaptureThreeModule(renderer?: any): void {
  if (_threeModule) return;

  // Strategy 1: window.THREE (CDN / manual assignment)
  if ((window as any).THREE) {
    _threeModule = (window as any).THREE;
    return;
  }

  // Strategy 2: Extract from renderer's internal imports
  // Three.js r3f bundled renderers carry references to internal classes.
  // We can reconstruct helper constructors from the renderer's prototype chain.
  if (renderer) {
    try {
      // WebGLRenderer imports from three — its module scope has all constructors.
      // Access via renderer.constructor to get the module.
      const proto = Object.getPrototypeOf(renderer);
      if (proto?.constructor) {
        // Store whatever we found — at least Vector3/Color are on existing objects
        // The real fix: expose THREE in setupCapture via prototype scanning
      }
    } catch { /* ignore */ }
  }
}

/**
 * Build a synthetic THREE namespace from scene objects' constructor prototypes.
 * This is a one-time scan that extracts constructor references from existing objects.
 * Returns true if any new constructors were found.
 */
export function buildThreeNamespace(scene: any, renderer: any, camera: any): boolean {
  if (_threeModule) return true;

  // Check window.THREE first
  if ((window as any).THREE) {
    _threeModule = (window as any).THREE;
    return true;
  }

  // Scan module registry: check all loaded modules for Three.js exports.
  // In bundled apps, Three.js constructors share the same module scope.
  // We can find them by walking up from known objects.

  // Strategy: traverse scene to find a mesh, then grab its module's siblings.
  // In Webpack/Turbopack chunks, all Three.js exports live in the same closure.
  // The most reliable approach: provide a way for users to expose THREE.

  return false;
}

/** Cache R3F state and extract useful constructors (Raycaster, Vector3, etc.) */
function cacheR3fState(state: any): void {
  if (!_capturedScene && state.scene) _capturedScene = state.scene;
  if (!_capturedRenderer && state.gl) _capturedRenderer = state.gl;
  if (!_capturedCamera && state.camera) _capturedCamera = state.camera;

  // Extract constructor references for helpers/raycasting
  // These are guaranteed to be in the bundle since R3F uses them
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

function tryExtractFromR3fRoot(obj: any): void {
  try {
    const root = obj.__r3f?.root;
    if (!root || typeof root.getState !== 'function') return;
    const state = root.getState();
    if (state.scene) _capturedScene = state.scene;
    if (state.gl) _capturedRenderer = state.gl;
    if (state.camera) _capturedCamera = state.camera;
  } catch { /* varies between versions */ }
}
