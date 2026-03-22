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
  const { scene: capturedScene, renderer: capturedRenderer, camera: capturedCamera } = getCaptured();
  if (capturedScene) {
    const r3fRoot = capturedScene.__r3f?.root;
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
    return {
      scene: capturedScene, renderer: capturedRenderer,
      camera: cam, gl: capturedRenderer.getContext?.(),
    };
  }

  return null;
}
