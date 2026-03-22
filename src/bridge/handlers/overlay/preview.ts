/** Interactive 3D preview helpers. */
import type { ThreeContext } from '../../types.js';
import { attachOrbit } from './orbit.js';
import { makeGrid, makeAxes, makeSphere } from './grid.js';
let _pr: any = null;

function getCtors(ctx: ThreeContext): Record<string, any> {
  const w = window as any;
  const T = w.THREE || w.__THREEJS_DEVTOOLS_CONSTRUCTORS__ || {};
  const c: Record<string, any> = {};
  c.Scene = T.Scene || ctx.scene?.constructor;
  c.V3 = T.Vector3 || ctx.scene?.position?.constructor;
  c.PCam = T.PerspectiveCamera || T.Camera || ctx.camera?.constructor;
  c.Mesh = T.Mesh; c.BG = T.BufferGeometry; c.BA = T.BufferAttribute;
  c.DL = T.DirectionalLight; c.AL = T.AmbientLight;
  ctx.scene?.traverse((o: any) => {
    if (o.isMesh && !c.Mesh) c.Mesh = o.constructor;
    if (o.geometry?.attributes?.position && !c.BA) {
      c.BG = c.BG || o.geometry.constructor;
      c.BA = o.geometry.attributes.position.constructor;
    }
    if (o.isDirectionalLight && !c.DL) c.DL = o.constructor;
    if (o.isAmbientLight && !c.AL) c.AL = o.constructor;
  });
  if (!c.PCam) { // R3F store
    const root = (ctx.scene as any)?.__r3f?.root;
    const gs = root?.getState || root?.store?.getState;
    if (typeof gs === 'function') c.PCam = gs()?.camera?.constructor;
  }
  if (!c.PCam) ctx.scene?.traverse((o: any) => { // scene traversal
    if (!c.PCam && (o.isPerspectiveCamera || o.isOrthographicCamera)) c.PCam = o.constructor;
  });
  if (!c.PCam) c.PCam = (window as any).__tdt_PCam; // render() interception cache
  return c;
}
function getRenderer(ctx: ThreeContext, sz: number): any {
  if (_pr) { _pr.setSize(sz, sz, false); return _pr; }
  try {
    const cv = document.createElement('canvas');
    _pr = new (ctx.renderer.constructor)({ canvas: cv, antialias: true, alpha: true });
    _pr.setSize(sz, sz, false);
    return _pr;
  } catch { return null; }
}
export type PreviewCleanup = () => void;

export function objectPreview(ctx: ThreeContext, container: HTMLElement, obj: any, sz = 200): PreviewCleanup | null {
  try {
    const c = getCtors(ctx), r = getRenderer(ctx, sz);
    if (!r || !c.Scene || !c.PCam || !c.V3) return null;
    const scene = new c.Scene();
    // InstancedMesh with custom shaders can't be cloned (instanceMatrix missing)
    if (obj.isInstancedMesh) return null;
    let target: any; try { target = obj.clone(true); } catch { return null; }
    // Skip if any child is InstancedMesh (would break shaders)
    let hasInstanced = false;
    target.traverse((ch: any) => { if (ch.isInstancedMesh) hasInstanced = true; });
    if (hasInstanced) return null;
    scene.add(target);
    const mn = new c.V3(Infinity, Infinity, Infinity), mx = new c.V3(-Infinity, -Infinity, -Infinity);
    let srcMat: any = null;
    target.updateMatrixWorld?.(true);
    target.traverse((ch: any) => {
      // Clone materials — preview must not show wireframe/emissive from highlight
      if (ch.material) {
        ch.material = Array.isArray(ch.material) ? ch.material.map((m: any) => m.clone()) : ch.material.clone();
        const ms = Array.isArray(ch.material) ? ch.material : [ch.material];
        for (const m of ms) { m.wireframe = false; if (m.emissive) m.emissive.setRGB(0, 0, 0); }
        if (!srcMat) srcMat = ms[0];
      }
      // Compute bounds
      if (!ch.geometry?.attributes?.position) return;
      ch.geometry.computeBoundingBox?.();
      const bb = ch.geometry.boundingBox; if (!bb) return;
      for (const corner of [bb.min, bb.max]) { const p = corner.clone().applyMatrix4(ch.matrixWorld); mn.min(p); mx.max(p); }
    });
    const center = mn.clone().add(mx).multiplyScalar(0.5);
    const diag = mx.clone().sub(mn).length() || 2;
    const dist = diag / (2 * Math.tan(Math.PI * 45 / 360));
    if (c.AL) scene.add(new c.AL(0x808080));
    if (c.DL) { const d = new c.DL(0xffffff, 0.9); d.position.set(dist, dist, dist); scene.add(d); }
    const helpers: any[] = [];
    const groundY = mn.y;
    const groundCenter = { x: center.x, y: groundY, z: center.z };
    const grid = makeGrid(c, groundCenter, groundY, diag * 1.5, srcMat);
    if (grid) { scene.add(grid); helpers.push(grid); }
    for (const ax of makeAxes(c, groundCenter, diag * 0.5, srcMat)) { scene.add(ax); helpers.push(ax); }
    const cam = new c.PCam(45, 1, 0.01, diag * 10);
    r.domElement.className = '__pv'; container.innerHTML = ''; container.appendChild(r.domElement);
    attachOrbit(r, scene, cam, center, dist * 1.5);
    return () => {
      target.traverse((ch: any) => { ch.geometry?.dispose?.(); ch.material?.dispose?.(); });
      for (const h of helpers) { h.geometry?.dispose(); h.material?.dispose(); }
    };
  } catch { return null; }
}
export function materialPreview(ctx: ThreeContext, container: HTMLElement, mat: any, sz = 200): PreviewCleanup | null {
  try {
    const c = getCtors(ctx), r = getRenderer(ctx, sz);
    if (!r || !c.Scene || !c.Mesh || !c.PCam) return null;
    const scene = new c.Scene(), geo = makeSphere(c); if (!geo) return null;
    const pvMat = mat.clone(); pvMat.wireframe = false;
    if (pvMat.emissive) pvMat.emissive.setRGB(0, 0, 0);
    scene.add(new c.Mesh(geo, pvMat));
    if (c.AL) scene.add(new c.AL(0x606060));
    if (c.DL) { const d = new c.DL(0xffffff, 1.2); d.position.set(3, 4, 5); scene.add(d); }
    const cam = new c.PCam(45, 1, 0.1, 100), center = { x: 0, y: 0, z: 0 };
    r.domElement.className = '__pv'; container.innerHTML = ''; container.appendChild(r.domElement);
    attachOrbit(r, scene, cam, center, 2.8);
    return () => { geo.dispose(); pvMat.dispose(); };
  } catch { return null; }
}
