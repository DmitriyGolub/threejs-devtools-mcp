import type { ThreeContext } from '../types.js';
import {
  getCaptured,
  setCapturedScene,
  setCapturedRenderer,
  setCapturedCamera,
  _capturedCanvases,
} from './state.js';
import { scanWindowForThreeJS, scanCanvasForRenderer, tryExtractSceneFromRenderer } from './scan.js';
import { tryCaptureThreeModule, tryExtractFromR3fRoot } from './three-module.js';

export function setupCapture(): void {
  if ((window as any).__THREEJS_DEVTOOLS_BRIDGE_CAPTURE__) return;
  (window as any).__THREEJS_DEVTOOLS_BRIDGE_CAPTURE__ = true;

  const win = window as any;
  if (typeof win.__THREE_DEVTOOLS__ === 'undefined') {
    win.__THREE_DEVTOOLS__ = new EventTarget();
  }

  // Strategy 1: __THREE_DEVTOOLS__ events (Three.js r118-r162)
  win.__THREE_DEVTOOLS__.addEventListener('observe', (event: any) => {
    const obj = event.detail;
    if (!obj) return;
    if (obj.isScene) { setCapturedScene(obj); tryExtractFromR3fRoot(obj); }
    if (obj.isWebGLRenderer || obj.domElement instanceof HTMLCanvasElement) {
      setCapturedRenderer(obj);
      tryCaptureThreeModule(obj);
      interceptRender(obj);
    }
    if (obj.isCamera && !getCaptured().camera) setCapturedCamera(obj);
    if (getCaptured().scene && getCaptured().renderer) notifySceneReady();
  });

  // Strategy 2: Polling — R3F, window scan, canvas scan
  let attempts = 0;
  const poll = setInterval(() => {
    attempts++;
    const { scene, renderer } = getCaptured();
    if (attempts > 120 || (renderer && scene)) { clearInterval(poll); return; }

    const canvases = document.querySelectorAll('canvas');
    for (const canvas of canvases) {
      const r3f = (canvas as any).__r3f;
      if (r3f) {
        const state = typeof r3f.store?.getState === 'function'
          ? r3f.store.getState() : r3f;
        if (state.scene && state.gl) {
          setCapturedScene(state.scene);
          setCapturedRenderer(state.gl);
          setCapturedCamera(state.camera);
          clearInterval(poll);
          console.log('[threejs-devtools-mcp] Scene discovered via R3F');
          notifySceneReady();
          return;
        }
      }
    }

    if (!(getCaptured().scene && getCaptured().renderer)) scanWindowForThreeJS();
    if (!getCaptured().renderer && _capturedCanvases.size > 0) scanCanvasForRenderer();
    if (getCaptured().renderer && !getCaptured().scene) tryExtractSceneFromRenderer();
    if (getCaptured().scene && !getCaptured().renderer) tryExtractFromR3fRoot(getCaptured().scene);

    if (getCaptured().scene && getCaptured().renderer) {
      console.log('[threejs-devtools-mcp] Scene discovered via polling');
      clearInterval(poll);
      notifySceneReady();
    }
  }, 500);
}

/** Intercept renderer.render() to capture camera from render(scene, camera) */
function interceptRender(r: any): void {
  if (r.__tdt_rp) return;
  const orig = r.render.bind(r);
  r.render = (s: any, c: any) => {
    if (c?.isCamera && !getCaptured().camera) {
      setCapturedCamera(c);
      // Store constructor globally for preview (ES module apps lack window.THREE)
      (window as any).__tdt_PCam = c.constructor;
    }
    return orig(s, c);
  };
  r.__tdt_rp = true;
}

/** Notify overlay auto-show callback when scene is first discovered */
let _notified = false;
export function notifySceneReady(): void {
  if (_notified) return;
  const { scene, renderer, camera } = getCaptured();
  if (!scene || !renderer) return;
  _notified = true;
  const cb = (window as any).__tdt_onSceneReady;
  if (typeof cb === 'function') {
    const ctx: ThreeContext = {
      scene, renderer, camera,
      gl: renderer.getContext?.(),
    };
    try { cb(ctx); } catch (e) { console.warn('[threejs-devtools-mcp] onSceneReady error:', e); }
  }
}
