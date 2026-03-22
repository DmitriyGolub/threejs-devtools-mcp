import { serializeVector3, serializeEuler } from './vector.js';

const DEFAULT_MAX_CHILDREN = 100;

const isDefaultPosition = (p: any) => p[0] === 0 && p[1] === 0 && p[2] === 0;
const isDefaultScale = (s: any) => s[0] === 1 && s[1] === 1 && s[2] === 1;
const isDefaultRotation = (r: any) => r[0] === 0 && r[1] === 0 && r[2] === 0;

/** Get accurate type string — obj.type is often just "Mesh" for subclasses */
function resolveType(obj: any): string {
  if (obj.isInstancedMesh) return 'InstancedMesh';
  if (obj.isSkinnedMesh) return 'SkinnedMesh';
  if (obj.isBatchedMesh) return 'BatchedMesh';
  if (obj.isSprite) return 'Sprite';
  if (obj.isLine2) return 'Line2';
  if (obj.isLineSegments) return 'LineSegments';
  if (obj.isLine) return 'Line';
  if (obj.isPoints) return 'Points';
  return obj.type || obj.constructor?.name || 'Object3D';
}

export function serializeSceneNode(
  obj: any, depth: number, maxDepth: number, typeFilter?: string[], maxChildren?: number,
): any {
  if (depth > maxDepth) return null;
  const limit = maxChildren || DEFAULT_MAX_CHILDREN;

  const type = resolveType(obj);

  if (typeFilter && typeFilter.length > 0 && !typeFilter.includes(type)) {
    const matchingChildren: any[] = [];
    if (obj.children) {
      for (const child of obj.children) {
        const s = serializeSceneNode(child, depth, maxDepth, typeFilter, limit);
        if (s) matchingChildren.push(s);
      }
    }
    if (matchingChildren.length === 0) return null;
    return buildNode(obj, type, depth, maxDepth, limit, typeFilter, matchingChildren);
  }

  return buildNode(obj, type, depth, maxDepth, limit, typeFilter);
}

function buildNode(
  obj: any, type: string, depth: number, maxDepth: number,
  limit: number, typeFilter?: string[], preChildren?: any[],
): any {
  const pos = serializeVector3(obj.position);
  const rot = serializeEuler(obj.rotation);
  const scl = serializeVector3(obj.scale);
  const childCount = obj.children?.length || 0;

  // Compact JSON: omit defaults to save tokens
  const node: any = { name: obj.name || '', type };
  if (!obj.visible) node.visible = false;
  if (!isDefaultPosition(pos)) node.position = pos;
  if (!isDefaultRotation(rot)) node.rotation = rot;
  if (!isDefaultScale(scl)) node.scale = scl;
  if (childCount > 0) node.childCount = childCount;

  if (obj.isInstancedMesh) {
    node.instances = obj.count;
    node.maxInstances = obj.instanceMatrix?.count || 0;
  }

  if (obj.isLight) {
    node.intensity = obj.intensity;
  }

  if (obj.geometry) {
    const geo = obj.geometry;
    node.geometry = geo.constructor?.name || geo.type || 'BufferGeometry';
    const verts = geo.attributes?.position?.count || 0;
    if (verts > 0) node.vertices = verts;
  }

  if (obj.material) {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    node.material = mats.length === 1
      ? (mats[0].name || mats[0].constructor?.name || mats[0].type)
      : mats.map((m: any) => m.name || m.constructor?.name || m.type);
  }

  // Children
  if (preChildren) {
    node.children = preChildren;
  } else if (obj.children && childCount > 0 && depth < maxDepth) {
    const slice = obj.children.slice(0, limit);
    node.children = slice
      .map((c: any) => serializeSceneNode(c, depth + 1, maxDepth, typeFilter, limit))
      .filter(Boolean);
    if (childCount > limit) {
      node.truncated = childCount - limit;
    }
  }

  return node;
}

/** Compact text tree — minimal tokens, human-readable. */
export function compactSceneTree(
  obj: any, depth: number, maxDepth: number,
  typeFilter: string[] | undefined, maxChildren: number,
  indent: string = '',
): string {
  if (depth > maxDepth) return '';
  const type = resolveType(obj);
  const name = obj.name || '(unnamed)';
  const childCount = obj.children?.length || 0;

  // Type filter: skip non-matching, but recurse into children
  if (typeFilter && typeFilter.length > 0 && !typeFilter.includes(type)) {
    let result = '';
    if (obj.children) {
      for (const child of obj.children) {
        result += compactSceneTree(child, depth, maxDepth, typeFilter, maxChildren, indent);
      }
    }
    return result;
  }

  // Build one-line summary
  const parts: string[] = [`${indent}${name} [${type}]`];

  if (!obj.visible) parts.push('HIDDEN');
  if (obj.isInstancedMesh) parts.push(`instances=${obj.count}`);
  if (obj.isLight) parts.push(`intensity=${obj.intensity}`);
  if (childCount > 0 && depth >= maxDepth) parts.push(`(${childCount} children)`);

  let line = parts.join(' ') + '\n';

  // Recurse into children
  if (obj.children && childCount > 0 && depth < maxDepth) {
    const limit = Math.min(childCount, maxChildren);
    for (let i = 0; i < limit; i++) {
      line += compactSceneTree(
        obj.children[i], depth + 1, maxDepth, typeFilter, maxChildren, indent + '  ',
      );
    }
    if (childCount > limit) {
      line += `${indent}  ... +${childCount - limit} more\n`;
    }
  }

  return line;
}
