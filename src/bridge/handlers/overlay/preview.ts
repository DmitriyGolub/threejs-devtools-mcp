/** Interactive 3D preview helpers. */
import type { ThreeContext } from '../../types.js';
import { attachOrbit } from './orbit.js';
import { makeGrid, makeAxes, makeSphere } from './grid.js';
let _pr: any = null; export type PreviewCleanup = () => void;
const _texKeys = ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','alphaMap'];
function cleanMat(m: any): void {
  m.wireframe = false; if (m.emissive) m.emissive.setRGB(0, 0, 0);
  for (const k of _texKeys) { if (m[k]?.image && m[k].image.width <= 4) m[k] = null; }
}
function getCtors(ctx: ThreeContext): Record<string, any> {
  const T = (window as any).THREE || (window as any).__THREEJS_DEVTOOLS_CONSTRUCTORS__ || {};
  const c: Record<string, any> = {
    Scene: T.Scene || ctx.scene?.constructor, V3: T.Vector3 || ctx.scene?.position?.constructor,
    PCam: T.PerspectiveCamera || T.Camera || ctx.camera?.constructor,
    Mesh: T.Mesh, BG: T.BufferGeometry, BA: T.BufferAttribute, DL: T.DirectionalLight, AL: T.AmbientLight,
  };
  ctx.scene?.traverse((o: any) => {
    if (o.isMesh && !c.Mesh) c.Mesh = o.constructor;
    if (o.geometry?.attributes?.position && !c.BA) { c.BG = c.BG || o.geometry.constructor; c.BA = o.geometry.attributes.position.constructor; }
    if (o.isDirectionalLight && !c.DL) c.DL = o.constructor;
    if (o.isAmbientLight && !c.AL) c.AL = o.constructor;
  });
  if (!c.PCam) { const root = (ctx.scene as any)?.__r3f?.root; const gs = root?.getState || root?.store?.getState; if (typeof gs === 'function') c.PCam = gs()?.camera?.constructor; }
  if (!c.PCam) ctx.scene?.traverse((o: any) => { if (!c.PCam && (o.isPerspectiveCamera || o.isOrthographicCamera)) c.PCam = o.constructor; });
  if (!c.PCam) c.PCam = (window as any).__tdt_PCam;
  return c;
}
function getRenderer(ctx: ThreeContext, sz: number): any {
  if (_pr) return _pr;
  try { const cv = document.createElement('canvas'); cv.style.cssText = 'width:100%;height:100%;display:block';
    _pr = new (ctx.renderer.constructor)({ canvas: cv, antialias: true, alpha: true }); _pr.setSize(sz, sz, false); return _pr;
  } catch { return null; }
}
function setupView(r: any, el: HTMLElement, scene: any, cam: any, center: any, dist: number, sz: number): void {
  el.innerHTML = ''; el.appendChild(r.domElement); r.setSize(sz, sz, false); r.setViewport(0, 0, sz, sz);
  attachOrbit(r, scene, cam, center, dist);
}

function copyTransform(dst: any, src: any): void { dst.position.copy(src.position); dst.rotation.copy(src.rotation); dst.scale.copy(src.scale); }
function imToMesh(c: any, im: any): any | null {
  const mat = Array.isArray(im.material) ? im.material[0] : im.material;
  if (mat?.isShaderMaterial) return null;
  const m = new c.Mesh(im.geometry, im.material); copyTransform(m, im); return m;
}

export function objectPreview(ctx: ThreeContext, container: HTMLElement, obj: any, sz = 200): PreviewCleanup | null {
  try {
    const c = getCtors(ctx), r = getRenderer(ctx, sz);
    if (!r || !c.Scene || !c.PCam || !c.V3) return null;
    const scene = new c.Scene();
    let target: any;
    try {
      if (obj.isInstancedMesh && c.Mesh) { target = imToMesh(c, obj); if (!target) return null; }
      else { target = obj.clone(true); }
    } catch { return null; }
    const toConvert: any[] = [];
    target.traverse((ch: any) => { if (ch.isInstancedMesh && ch.parent && c.Mesh) toConvert.push(ch); });
    for (const ch of toConvert) { const m = imToMesh(c, ch); if (m) { ch.parent.add(m); } ch.parent.remove(ch); }
    scene.add(target);
    const mn = new c.V3(Infinity, Infinity, Infinity), mx = new c.V3(-Infinity, -Infinity, -Infinity);
    let srcMat: any = null;
    target.updateMatrixWorld?.(true);
    target.traverse((ch: any) => {
      if (ch.material) {
        ch.material = Array.isArray(ch.material) ? ch.material.map((m: any) => m.clone()) : ch.material.clone();
        const ms = Array.isArray(ch.material) ? ch.material : [ch.material];
        for (const m of ms) cleanMat(m);
        if (!srcMat) srcMat = ms[0];
      }
      if (!ch.geometry?.attributes?.position) return;
      ch.geometry.computeBoundingBox?.();
      const bb = ch.geometry.boundingBox; if (!bb) return;
      for (const corner of [bb.min, bb.max]) { const p = corner.clone().applyMatrix4(ch.matrixWorld); mn.min(p); mx.max(p); }
    });
    const center = mn.clone().add(mx).multiplyScalar(0.5), diag = mx.clone().sub(mn).length() || 2;
    const dist = diag / (2 * Math.tan(Math.PI * 45 / 360));
    if (c.AL) scene.add(new c.AL(0x808080));
    if (c.DL) { const d = new c.DL(0xffffff, 0.9); d.position.set(dist, dist, dist); scene.add(d); }
    const helpers: any[] = [], gc = { x: center.x, y: mn.y, z: center.z };
    const grid = makeGrid(c, gc, mn.y, diag * 1.5, srcMat);
    if (grid) { scene.add(grid); helpers.push(grid); }
    for (const ax of makeAxes(c, gc, diag * 0.5, srcMat)) { scene.add(ax); helpers.push(ax); }
    setupView(r, container, scene, new c.PCam(45, 1, 0.01, diag * 10), center, dist * 1.5, sz);
    return () => { target.traverse((ch: any) => { ch.geometry?.dispose?.(); ch.material?.dispose?.(); }); for (const h of helpers) { h.geometry?.dispose(); h.material?.dispose(); } };
  } catch { return null; }
}
export function materialPreview(ctx: ThreeContext, container: HTMLElement, mat: any, sz = 200): PreviewCleanup | null {
  try {
    const c = getCtors(ctx), r = getRenderer(ctx, sz);
    if (!r || !c.Scene || !c.Mesh || !c.PCam) return null;
    const scene = new c.Scene(), geo = makeSphere(c); if (!geo) return null;
    const pvMat = mat.clone(); cleanMat(pvMat); scene.add(new c.Mesh(geo, pvMat));
    if (c.AL) scene.add(new c.AL(0x606060));
    if (c.DL) { const d = new c.DL(0xffffff, 1.2); d.position.set(3, 4, 5); scene.add(d); }
    setupView(r, container, scene, new c.PCam(45, 1, 0.1, 100), { x: 0, y: 0, z: 0 }, 2.8, sz);
    return () => { geo.dispose(); pvMat.dispose(); };
  } catch { return null; }
}
