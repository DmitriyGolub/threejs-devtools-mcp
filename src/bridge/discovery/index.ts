import type { ThreeContext } from '../types.js';
import {
  getCaptured,
  setCapturedCamera,
  getThreeModule,
  setThreeModule,
} from './state.js';
import { tryCaptureThreeModule, cacheR3fState, tryExtractFromR3fRoot, buildThreeNamespace } from './three-module.js';
import { setupCapture } from './capture.js';

export { getThreeModule, setThreeModule } from './state.js';
export { setupCapture } from './capture.js';
export { buildThreeNamespace } from './three-module.js';

/** Last known good context — reused if scene is still alive and populated */
let _lastGoodCtx: ThreeContext | null = null;

export function discoverThreeJS(): ThreeContext | null {
  // Fast path: reuse last known good scene if it's still populated
  if (_lastGoodCtx) {
    const count = _lastGoodCtx.scene.children?.length || 0;
    if (count > 0) return _lastGoodCtx;
    // Scene went empty — stale, rediscover
    _lastGoodCtx = null;
  }

  const ctx = _discoverFresh();
  if (ctx && ctx.scene.children?.length > 0) {
    _lastGoodCtx = ctx;
  }
  return ctx;
}

/** Find all <canvas> elements, including those inside Shadow DOM trees. */
function _findAllCanvases(): HTMLCanvasElement[] {
  const result: HTMLCanvasElement[] = [];
  function walk(root: Document | ShadowRoot) {
    root.querySelectorAll('canvas').forEach(c => result.push(c as HTMLCanvasElement));
    root.querySelectorAll('*').forEach(el => {
      if (el.shadowRoot) walk(el.shadowRoot);
    });
  }
  walk(document);
  return result;
}

function _discoverFresh(): ThreeContext | null {
  const win = window as any;

  // Collect all candidates, prefer scenes that actually have children
  const candidates: ThreeContext[] = [];

  // Strategy 1: explicit globals
  if (win.__THREE_SCENE__ && win.__THREE_RENDERER__) {
    candidates.push({
      scene: win.__THREE_SCENE__,
      renderer: win.__THREE_RENDERER__,
      camera: win.__THREE_CAMERA__ || null,
      gl: win.__THREE_RENDERER__.getContext?.(),
    });
  }

  // Strategy 2a: R3F store on canvas.__r3f (including Shadow DOM)
  const canvases = _findAllCanvases();
  for (const canvas of canvases) {
    const r3f = (canvas as any).__r3f;
    if (r3f) {
      const state = typeof r3f.store?.getState === 'function'
        ? r3f.store.getState() : r3f;
      if (state.scene && state.gl) {
        cacheR3fState(state);
        candidates.push({
          scene: state.scene, renderer: state.gl, camera: state.camera,
          gl: state.gl.getContext?.() || state.gl.domElement?.getContext('webgl2'),
        });
      }
    }
  }

  // Strategy 2b: R3F store on scene.__r3f.root (Next.js 16 / React 19)
  const { scene: capturedScene, renderer: capturedRenderer, camera: capturedCamera } = getCaptured();
  if (capturedScene) {
    const r3fRoot = capturedScene.__r3f?.root;
    if (r3fRoot) {
      const getState = r3fRoot.getState || r3fRoot?.store?.getState;
      if (typeof getState === 'function') {
        const state = getState();
        if (state?.scene && state?.gl) {
          cacheR3fState(state);
          candidates.push({
            scene: state.scene, renderer: state.gl, camera: state.camera,
            gl: state.gl.getContext?.() || state.gl.domElement?.getContext('webgl2'),
          });
        }
      }
    }
  }

  // Strategy 3: captured scene/renderer from state
  if (capturedRenderer && capturedScene) {
    if (!getThreeModule()) tryCaptureThreeModule(capturedRenderer);
    let cam = capturedCamera;
    if (!cam) tryExtractFromR3fRoot(capturedScene);
    cam = getCaptured().camera;
    if (!cam) {
      capturedScene.traverse((obj: any) => {
        if (!cam && (obj.isCamera || obj.isPerspectiveCamera)) {
          cam = obj;
          setCapturedCamera(obj);
        }
      });
    }
    candidates.push({
      scene: capturedScene, renderer: capturedRenderer,
      camera: cam, gl: capturedRenderer.getContext?.(),
    });
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Deduplicate by scene identity (same JS object)
  const unique: ThreeContext[] = [];
  const seen = new Set<any>();
  for (const c of candidates) {
    if (!seen.has(c.scene)) {
      seen.add(c.scene);
      unique.push(c);
    }
  }

  if (unique.length === 1) return unique[0];

  // Multiple distinct scenes — prefer the one with most descendants
  let best = unique[0];
  let bestCount = countDescendants(best.scene);
  for (let i = 1; i < unique.length; i++) {
    const count = countDescendants(unique[i].scene);
    if (count > bestCount) {
      best = unique[i];
      bestCount = count;
    }
  }

  if (bestCount === 0) {
    console.warn('[threejs-devtools-mcp] All discovered scenes have 0 children — may be stale');
  }

  return best;
}

function countDescendants(obj: any): number {
  let count = 0;
  if (obj.children) {
    for (const child of obj.children) {
      count += 1 + countDescendants(child);
    }
  }
  return count;
}
