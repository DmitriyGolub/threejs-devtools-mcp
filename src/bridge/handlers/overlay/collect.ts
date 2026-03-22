/** Collect deep object info for agent clipboard copy. */
import { readColorHex } from '../color-utils.js';

export function collectObjectInfo(obj: any): Record<string, any> {
  const p = (v: any) => v ? { x: +v.x.toFixed(4), y: +v.y.toFixed(4), z: +v.z.toFixed(4) } : undefined;
  const result: Record<string, any> = {
    name: obj.name || '(unnamed)', type: obj.type || obj.constructor?.name || '?',
    uuid: obj.uuid, visible: obj.visible,
    position: p(obj.position), rotation: p(obj.rotation), scale: p(obj.scale),
    castShadow: obj.castShadow || false, receiveShadow: obj.receiveShadow || false,
    frustumCulled: obj.frustumCulled, renderOrder: obj.renderOrder || 0,
    layers: obj.layers?.mask, childCount: (obj.children || []).length,
  };
  const pp: string[] = [];
  let cur = obj;
  while (cur) { pp.unshift(cur.name || cur.type || '?'); cur = cur.parent; }
  result.scenePath = pp.join(' > ');

  if (obj.geometry) {
    const g = obj.geometry, attrs: Record<string, any> = {};
    if (g.attributes) for (const [key, attr] of Object.entries(g.attributes)) {
      const a = attr as any;
      attrs[key] = { itemSize: a.itemSize, count: a.count, normalized: a.normalized || false };
    }
    const p2 = (v: any) => ({ x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(2) });
    result.geometry = {
      type: g.type || '?', uuid: g.uuid, vertices: g.attributes?.position?.count || 0,
      indexed: !!g.index, faces: g.index ? Math.floor(g.index.count / 3) : 0, attributes: attrs,
      boundingBox: g.boundingBox ? { min: p2(g.boundingBox.min), max: p2(g.boundingBox.max) } : undefined,
      morphAttributes: g.morphAttributes ? Object.keys(g.morphAttributes) : [],
    };
  }

  if (obj.material) {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    result.materials = mats.map((m: any) => collectMat(m));
  }
  if (obj.isLight) {
    result.light = {
      color: obj.color ? readColorHex(obj.color) : undefined, intensity: obj.intensity,
      castShadow: obj.castShadow, distance: obj.distance, decay: obj.decay,
      angle: obj.angle, penumbra: obj.penumbra,
      groundColor: obj.groundColor ? readColorHex(obj.groundColor) : undefined,
    };
    if (obj.shadow) result.light.shadow = {
      mapSize: obj.shadow.mapSize ? { x: obj.shadow.mapSize.x, y: obj.shadow.mapSize.y } : undefined,
      bias: obj.shadow.bias, normalBias: obj.shadow.normalBias, radius: obj.shadow.radius,
    };
  }
  if (obj.isCamera) result.camera = { fov: obj.fov, near: obj.near, far: obj.far, zoom: obj.zoom, aspect: obj.aspect };
  if (obj.isInstancedMesh) result.instancedMesh = { count: obj.count, maxCount: obj.instanceMatrix?.count || 0, hasInstanceColors: !!obj.instanceColor };
  if (obj.userData && Object.keys(obj.userData).length > 0) {
    try { result.userData = JSON.parse(JSON.stringify(obj.userData)); } catch { result.userData = '(non-serializable)'; }
  }
  if (obj.children?.length > 0) {
    const t: Record<string, number> = {};
    obj.children.forEach((c: any) => { const k = c.type || '?'; t[k] = (t[k] || 0) + 1; });
    result.childrenByType = t;
  }
  return result;
}

function collectMat(m: any): Record<string, any> {
  const mi: Record<string, any> = {
    name: m.name || '(unnamed)', type: m.type || m.constructor?.name || '?',
    uuid: m.uuid, visible: m.visible, side: m.side, transparent: m.transparent,
    opacity: m.opacity, depthWrite: m.depthWrite, depthTest: m.depthTest,
    wireframe: m.wireframe, fog: m.fog, blending: m.blending,
  };
  if (m.color) mi.color = readColorHex(m.color);
  if (m.emissive) mi.emissive = readColorHex(m.emissive);
  if (m.roughness !== undefined) mi.roughness = m.roughness;
  if (m.metalness !== undefined) mi.metalness = m.metalness;
  if (m.envMapIntensity !== undefined) mi.envMapIntensity = m.envMapIntensity;
  if (m.flatShading) mi.flatShading = true;
  if (m.alphaTest > 0) mi.alphaTest = m.alphaTest;
  const slots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'displacementMap', 'bumpMap', 'alphaMap', 'envMap', 'lightMap'];
  const maps: Record<string, any> = {};
  for (const s of slots) {
    if (m[s]) { const t = m[s]; maps[s] = { name: t.name || '(unnamed)', uuid: t.uuid, image: t.image ? { width: t.image.width, height: t.image.height } : null }; }
  }
  if (Object.keys(maps).length > 0) mi.textureMaps = maps;
  if (m.uniforms) {
    const unis: Record<string, any> = {};
    for (const [k, u] of Object.entries(m.uniforms)) {
      const v = (u as any).value;
      if (v === null || v === undefined) { unis[k] = null; continue; }
      if (typeof v === 'number' || typeof v === 'boolean') { unis[k] = v; continue; }
      if (v.isColor) { unis[k] = { type: 'Color', value: readColorHex(v) }; continue; }
      if (v.isVector2) { unis[k] = { type: 'Vector2', x: v.x, y: v.y }; continue; }
      if (v.isVector3) { unis[k] = { type: 'Vector3', x: v.x, y: v.y, z: v.z }; continue; }
      if (v.isVector4) { unis[k] = { type: 'Vector4', x: v.x, y: v.y, z: v.z, w: v.w }; continue; }
      unis[k] = typeof v;
    }
    if (Object.keys(unis).length > 0) mi.uniforms = unis;
  }
  return mi;
}
