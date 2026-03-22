/** Collect concise object info for AI agent as plain text (minimal tokens). */
import { readColorHex } from '../color-utils.js';

export function collectObjectInfo(obj: any): string {
  const lines: string[] = [];
  const path: string[] = [];
  let cur = obj; while (cur) { path.unshift(cur.name || cur.type || '?'); cur = cur.parent; }

  // Header: name (type) @ path
  lines.push(`${obj.name || '(unnamed)'} (${obj.type}) @ ${path.join(' > ')}`);

  // Transform — only non-default
  const v3 = (v: any) => `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
  const parts: string[] = [];
  if (obj.position && (obj.position.x || obj.position.y || obj.position.z)) parts.push(`pos:${v3(obj.position)}`);
  if (obj.rotation && (obj.rotation.x || obj.rotation.y || obj.rotation.z)) parts.push(`rot:${v3(obj.rotation)}`);
  if (obj.scale && (obj.scale.x !== 1 || obj.scale.y !== 1 || obj.scale.z !== 1)) parts.push(`scl:${v3(obj.scale)}`);
  if (!obj.visible) parts.push('hidden');
  if (obj.castShadow) parts.push('castShadow');
  if (parts.length) lines.push(parts.join(' '));

  // Geometry
  if (obj.geometry) {
    const g = obj.geometry;
    const verts = g.attributes?.position?.count || 0;
    const faces = g.index ? Math.floor(g.index.count / 3) : 0;
    lines.push(`geo: ${verts} verts${faces ? ` ${faces} faces` : ''}`);
  }

  // Material(s)
  if (obj.material) {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      const p: string[] = [`${m.name || m.type} (${m.type})`];
      if (m.color) p.push(`color:${readColorHex(m.color)}`);
      if (m.roughness !== undefined) p.push(`rough:${m.roughness}`);
      if (m.metalness !== undefined) p.push(`metal:${m.metalness}`);
      if (m.opacity < 1) p.push(`opacity:${m.opacity}`);
      if (m.transparent) p.push('transparent');
      if (m.side === 2) p.push('doubleSide');
      const texs: string[] = [];
      for (const s of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap'])
        if (m[s]) texs.push(s);
      if (texs.length) p.push(`tex:${texs.join(',')}`);
      if (m.uniforms) {
        const u: string[] = [];
        for (const [k, v] of Object.entries(m.uniforms)) {
          const val = (v as any).value;
          if (typeof val === 'number') u.push(`${k}=${val.toFixed(3)}`);
          else if (val?.isColor) u.push(`${k}=${readColorHex(val)}`);
        }
        if (u.length) p.push(`uniforms:{${u.join(',')}}`);
      }
      lines.push(`mat: ${p.join(' ')}`);
    }
  }

  // Light
  if (obj.isLight) {
    const p = [`intensity:${obj.intensity}`];
    if (obj.color) p.push(`color:${readColorHex(obj.color)}`);
    if (obj.castShadow) p.push('shadow');
    lines.push(`light: ${p.join(' ')}`);
  }

  if (obj.isInstancedMesh) lines.push(`instances: ${obj.count}`);
  if (obj.children?.length) lines.push(`children: ${obj.children.length}`);

  return lines.join('\n');
}
