import {
  _capturedCanvases,
  getCaptured,
  setCapturedScene,
  setCapturedRenderer,
  setCapturedCamera,
} from './state.js';

/** Browser globals to skip when scanning window properties */
export const WINDOW_SKIP = new Set([
  'window', 'self', 'globalThis', 'document', 'location', 'navigator',
  'performance', 'screen', 'history', 'crypto', 'caches', 'cookieStore',
  'localStorage', 'sessionStorage', 'indexedDB', 'visualViewport',
  'styleMedia', 'chrome', 'speechSynthesis', 'trustedTypes',
  'crossOriginIsolated', 'scheduler', 'originAgentCluster',
]);

/** Scan window properties (2 levels deep) for Three.js objects. */
export function scanWindowForThreeJS(): boolean {
  const win = window as any;
  let found = false;

  function checkValue(val: any): void {
    if (!val || typeof val !== 'object') return;
    try {
      if (val.isScene && !getCaptured().scene) { setCapturedScene(val); found = true; }
      if ((val.isWebGLRenderer || val.isWebGPURenderer) && !getCaptured().renderer) { setCapturedRenderer(val); found = true; }
      if ((val.isCamera || val.isPerspectiveCamera || val.isOrthographicCamera) && !getCaptured().camera) { setCapturedCamera(val); found = true; }
    } catch { /* skip */ }
  }

  for (const key of Object.keys(win)) {
    if (WINDOW_SKIP.has(key) || key.startsWith('__')) continue;
    try {
      const val = win[key];
      if (!val || typeof val !== 'object') continue;
      checkValue(val);

      if (getCaptured().scene && getCaptured().renderer) break;
      try {
        const keys = Object.keys(val);
        for (const k of keys) {
          try { checkValue(val[k]); } catch { /* skip */ }
          if (getCaptured().scene && getCaptured().renderer) break;
        }
      } catch { /* non-enumerable or restricted */ }
    } catch { /* skip inaccessible */ }
  }

  return found;
}

/** Find all canvases including Shadow DOM */
function collectCanvases(root: Document | ShadowRoot): void {
  root.querySelectorAll('canvas').forEach(c => _capturedCanvases.add(c));
  root.querySelectorAll('*').forEach(el => {
    if ((el as Element).shadowRoot) collectCanvases((el as Element).shadowRoot!);
  });
}

/** Find renderer by matching domElement to captured WebGL canvases. */
export function scanCanvasForRenderer(): boolean {
  if (getCaptured().renderer) return true;

  collectCanvases(document);
  if (_capturedCanvases.size === 0) return false;

  const win = window as any;
  for (const key of Object.keys(win)) {
    if (WINDOW_SKIP.has(key)) continue;
    try {
      const val = win[key];
      if (!val || typeof val !== 'object') continue;
      if (val.domElement && _capturedCanvases.has(val.domElement) && (val.isWebGLRenderer || val.render)) {
        setCapturedRenderer(val);
        return true;
      }
      try {
        for (const k of Object.keys(val)) {
          const nested = val[k];
          if (nested?.domElement && _capturedCanvases.has(nested.domElement) && (nested.isWebGLRenderer || nested.render)) {
            setCapturedRenderer(nested);
            return true;
          }
        }
      } catch { /* skip */ }
    } catch { /* skip */ }
  }

  return false;
}

/** Extract scene from renderer's last render call. */
export function tryExtractSceneFromRenderer(): boolean {
  const { scene, renderer } = getCaptured();
  if (scene || !renderer) return false;
  try {
    const info = renderer.info;
    if (info?.autoReset === false || info?.autoReset === true) {
      // It's a real renderer — try to find scene via internal state
    }
  } catch { /* skip */ }
  return false;
}
