/** Interactive 3D preview helpers. */
import type { ThreeContext } from '../../types.js';
import { attachOrbit } from './orbit.js';
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
  if (!c.PCam) {
    const root = (ctx.scene as any)?.__r3f?.root;
    const gs = root?.getState || root?.store?.getState;
    if (typeof gs === 'function') { const cam = gs()?.camera; if (cam) c.PCam = cam.constructor; }
  }
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
function makeSphere(c: any): any {
  if (c.SphereGeometry) return new c.SphereGeometry(1, 32, 32);
  if (!c.BG || !c.BA) return null;
  const g = new c.BG(), s = 20, pos: number[] = [], nrm: number[] = [], idx: number[] = [];
  for (let y = 0; y <= s; y++) for (let x = 0; x <= s; x++) {
    const u = x / s, v = y / s, t = u * Math.PI * 2, p = v * Math.PI;
    const px = -Math.cos(t) * Math.sin(p), py = Math.cos(p), pz = Math.sin(t) * Math.sin(p);
    pos.push(px, py, pz); nrm.push(px, py, pz);
  }
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const a = y * (s + 1) + x, b = a + s + 1; idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  g.setIndex(idx);
  g.setAttribute('position', new c.BA(new Float32Array(pos), 3));
  g.setAttribute('normal', new c.BA(new Float32Array(nrm), 3));
  return g;
}
export type PreviewCleanup = () => void;

export function objectPreview(ctx: ThreeContext, container: HTMLElement, obj: any, sz = 200): PreviewCleanup | null {
  try {
    const c = getCtors(ctx), r = getRenderer(ctx, sz);
    if (!r || !c.Scene || !c.PCam || !c.V3) return null;
    const scene = new c.Scene();
    let target: any; try { target = obj.clone(true); } catch { return null; } scene.add(target);
    const mn = new c.V3(Infinity, Infinity, Infinity), mx = new c.V3(-Infinity, -Infinity, -Infinity);
    target.updateMatrixWorld?.(true);
    target.traverse((ch: any) => {
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
    const cam = new c.PCam(45, 1, 0.01, diag * 10);
    r.domElement.className = '__pv'; container.innerHTML = ''; container.appendChild(r.domElement);
    attachOrbit(r, scene, cam, center, dist * 1.5);
    return () => { target.traverse((ch: any) => { ch.geometry?.dispose?.(); }); };
  } catch { return null; }
}
export function materialPreview(ctx: ThreeContext, container: HTMLElement, mat: any, sz = 200): PreviewCleanup | null {
  try {
    const c = getCtors(ctx), r = getRenderer(ctx, sz);
    if (!r || !c.Scene || !c.Mesh || !c.PCam) return null;
    const scene = new c.Scene(), geo = makeSphere(c); if (!geo) return null;
    scene.add(new c.Mesh(geo, mat));
    if (c.AL) scene.add(new c.AL(0x606060));
    if (c.DL) { const d = new c.DL(0xffffff, 1.2); d.position.set(3, 4, 5); scene.add(d); }
    const cam = new c.PCam(45, 1, 0.1, 100), center = { x: 0, y: 0, z: 0 };
    r.domElement.className = '__pv'; container.innerHTML = ''; container.appendChild(r.domElement);
    attachOrbit(r, scene, cam, center, 2.8);
    return () => { geo.dispose(); };
  } catch { return null; }
}
