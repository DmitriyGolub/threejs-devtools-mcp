/** Geometry helpers for 3D preview: grid, axes, sphere. */

/** Create a UV sphere with BufferGeometry */
export function makeSphere(c: any): any {
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

/** Create wireframe ground grid */
export function makeGrid(
  c: Record<string, any>, center: any, minY: number, size: number, srcMat: any,
): any {
  if (!c.BG || !c.BA || !c.Mesh || !srcMat) return null;
  const g = new c.BG(), d = 10, h = size / 2;
  const pos: number[] = [], idx: number[] = [];
  for (let j = 0; j <= d; j++) for (let i = 0; i <= d; i++) {
    pos.push(center.x - h + i * (size / d), minY, center.z - h + j * (size / d));
  }
  for (let j = 0; j < d; j++) for (let i = 0; i < d; i++) {
    const a = j * (d + 1) + i, b = a + 1, e = a + d + 1, f = e + 1;
    idx.push(a, b, e, b, f, e);
  }
  g.setIndex(idx);
  g.setAttribute('position', new c.BA(new Float32Array(pos), 3));
  const mat = srcMat.clone();
  mat.wireframe = true; mat.transparent = true; mat.opacity = 0.12;
  mat.depthWrite = false;
  if (mat.color) mat.color.setRGB(0.4, 0.4, 0.4);
  if (mat.emissive) mat.emissive.setRGB(0, 0, 0);
  return new c.Mesh(g, mat);
}

/** Create XYZ axis lines — cross-shaped (2 perpendicular planes) so visible from any angle */
export function makeAxes(
  c: Record<string, any>, center: any, length: number, srcMat: any,
): any[] {
  if (!c.BG || !c.BA || !c.Mesh || !srcMat) return [];
  const axes: any[] = [];
  const cx = center.x, cy = center.y, cz = center.z, t = length * 0.012;
  const dirs = [
    // X axis: cross in YZ plane
    { verts: [cx,cy-t,cz, cx+length,cy-t,cz, cx,cy+t,cz, cx+length,cy+t,cz,
              cx,cy,cz-t, cx+length,cy,cz-t, cx,cy,cz+t, cx+length,cy,cz+t], r:.9, g:.25, b:.25 },
    // Y axis: cross in XZ plane
    { verts: [cx-t,cy,cz, cx-t,cy+length,cz, cx+t,cy,cz, cx+t,cy+length,cz,
              cx,cy,cz-t, cx,cy+length,cz-t, cx,cy,cz+t, cx,cy+length,cz+t], r:.25, g:.9, b:.25 },
    // Z axis: cross in XY plane
    { verts: [cx-t,cy,cz, cx-t,cy,cz+length, cx+t,cy,cz, cx+t,cy,cz+length,
              cx,cy-t,cz, cx,cy-t,cz+length, cx,cy+t,cz, cx,cy+t,cz+length], r:.3, g:.45, b:.95 },
  ];
  for (const d of dirs) {
    const geo = new c.BG();
    geo.setAttribute('position', new c.BA(new Float32Array(d.verts), 3));
    geo.setIndex([0,1,2, 1,3,2, 4,5,6, 5,7,6]); // 2 quads = cross
    const mat = srcMat.clone();
    mat.wireframe = false; mat.transparent = true; mat.opacity = 0.8;
    mat.side = 2; // DoubleSide
    mat.depthWrite = false;
    if (mat.color) mat.color.setRGB(d.r, d.g, d.b);
    if (mat.emissive) mat.emissive.setRGB(d.r * 0.3, d.g * 0.3, d.b * 0.3);
    axes.push(new c.Mesh(geo, mat));
  }
  return axes;
}
