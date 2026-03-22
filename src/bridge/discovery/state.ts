import type { ThreeContext } from '../types.js';

export let _capturedScene: any = null;
export let _capturedRenderer: any = null;
export let _capturedCamera: any = null;
export let _threeModule: any = null;

/** Captured WebGL canvases via getContext interception */
export const _capturedCanvases: Set<HTMLCanvasElement> = new Set();

export function getCaptured(): { scene: any; renderer: any; camera: any } {
  return { scene: _capturedScene, renderer: _capturedRenderer, camera: _capturedCamera };
}

export function setCapturedScene(s: any): void {
  _capturedScene = s;
}

export function setCapturedRenderer(r: any): void {
  _capturedRenderer = r;
}

export function setCapturedCamera(c: any): void {
  _capturedCamera = c;
}

/**
 * Get the captured THREE module (or null if not yet resolved).
 * Falls back to constructors extracted from R3F state.
 * Note: R3F fallback only has constructors actually used by the app (tree-shaking),
 * so helpers like BoxHelper/ArrowHelper may not be available.
 */
export function getThreeModule(): any {
  if (_threeModule) return _threeModule;
  const win = window as any;
  if (win.THREE) { _threeModule = win.THREE; return _threeModule; }
  if (win.__THREEJS_DEVTOOLS_THREE__) { _threeModule = win.__THREEJS_DEVTOOLS_THREE__; return _threeModule; }
  if (win.__THREEJS_DEVTOOLS_CONSTRUCTORS__) return win.__THREEJS_DEVTOOLS_CONSTRUCTORS__;
  return null;
}

/** Set the THREE module externally (e.g. from dynamic import). */
export function setThreeModule(mod: any): void {
  _threeModule = mod;
}
