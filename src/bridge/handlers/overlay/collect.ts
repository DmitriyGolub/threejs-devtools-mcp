/** Collect concise object info for AI agent — only actionable data for code edits. */
import { readColorHex } from '../color-utils.js';

export function collectObjectInfo(obj: any): Record<string, any> {
  const v3 = (v: any) => v ? [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)] : undefined;

  // Scene path (how to find this object)
  const path: string[] = [];
  let cur = obj; while (cur) { path.unshift(cur.name || cur.type || '?'); cur = cur.parent; }

  const r: Record<string, any> = {
    path: path.join(' > '),
    name: obj.name || '(unnamed)',
    type: obj.type,
    position: v3(obj.position),
    rotation: v3(obj.rotation),
  };
  if (obj.scale && (obj.scale.x !== 1 || obj.scale.y !== 1 || obj.scale.z !== 1))
    r.scale = v3(obj.scale);
  if (!obj.visible) r.visible = false;
  if (obj.castShadow) r.castShadow = true;
  if (obj.receiveShadow) r.receiveShadow = true;

  // Geometry summary
  if (obj.geometry) {
    r.vertices = obj.geometry.attributes?.position?.count || 0;
    if (obj.geometry.index) r.faces = Math.floor(obj.geometry.index.count / 3);
  }

  // Material — only key properties for code changes
  if (obj.material) {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    r.materials = mats.map((m: any) => {
      const mi: Record<string, any> = { name: m.name || m.type, type: m.type };
      if (m.color) mi.color = readColorHex(m.color);
      if (m.roughness !== undefined) mi.roughness = m.roughness;
      if (m.metalness !== undefined) mi.metalness = m.metalness;
      if (m.opacity < 1) mi.opacity = m.opacity;
      if (m.transparent) mi.transparent = true;
      if (m.side === 2) mi.doubleSide = true;
      // Texture map names
      const maps: string[] = [];
      for (const s of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
        if (m[s]) maps.push(s);
      }
      if (maps.length) mi.textures = maps;
      // Shader uniforms (only values, no types)
      if (m.uniforms) {
        const u: Record<string, any> = {};
        for (const [k, v] of Object.entries(m.uniforms)) {
          const val = (v as any).value;
          if (typeof val === 'number') u[k] = +val.toFixed(3);
          else if (typeof val === 'boolean') u[k] = val;
          else if (val?.isColor) u[k] = readColorHex(val);
          else if (val?.isVector3) u[k] = v3(val);
        }
        if (Object.keys(u).length) mi.uniforms = u;
      }
      return mi;
    });
  }

  // Light
  if (obj.isLight) {
    r.intensity = obj.intensity;
    if (obj.color) r.color = readColorHex(obj.color);
    if (obj.castShadow) r.shadow = true;
  }

  // InstancedMesh
  if (obj.isInstancedMesh) r.instances = obj.count;

  // Children count
  if (obj.children?.length) r.children = obj.children.length;

  return r;
}
