import type { ThreeContext } from './types.js';

let _capturedScene: any = null;
let _capturedRenderer: any = null;
let _capturedCamera: any = null;

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

  const canvases = document.querySelectorAll('canvas');
  for (const canvas of canvases) {
    const r3f = (canvas as any).__r3f;
    if (r3f) {
      const state = typeof r3f.store?.getState === 'function'
        ? r3f.store.getState() : r3f;
      if (state.scene && state.gl) {
        return {
          scene: state.scene, renderer: state.gl, camera: state.camera,
          gl: state.gl.getContext?.() || state.gl.domElement?.getContext('webgl2'),
        };
      }
    }
  }

  if (_capturedRenderer && _capturedScene) {
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
    if (obj.isWebGLRenderer || obj.domElement instanceof HTMLCanvasElement) _capturedRenderer = obj;
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
