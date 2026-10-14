/**
 * BatchedMesh inspection handler.
 */
import type { Handler } from '../types.js';
import { resolveObject } from './mutate.js';
import { serializeVector3 } from '../serializers/vector.js';

export const batchedMeshDetailsHandler: Handler = (ctx, params) => {
  // If name/uuid provided, inspect a specific BatchedMesh (full detail)
  if (params.name || params.uuid) {
    const obj = resolveObject(ctx, params);
    if (!obj.isBatchedMesh) {
      throw new Error(`"${obj.name || obj.uuid}" is not a BatchedMesh (type: ${obj.type})`);
    }
    return serializeBatchedMesh(obj, true);
  }

  // Otherwise list all BatchedMeshes in the scene (compact)
  const results: ReturnType<typeof serializeBatchedMesh>[] = [];
  ctx.scene.traverse((obj: any) => {
    if (obj.isBatchedMesh && results.length < 50) {
      results.push(serializeBatchedMesh(obj, false));
    }
  });

  if (results.length === 0) {
    return { found: false, message: 'No BatchedMesh objects found in scene.' };
  }

  return { found: true, count: results.length, meshes: results };
};

function serializeBatchedMesh(obj: any, full: boolean): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: obj.name || '',
    uuid: obj.uuid,
    visible: obj.visible,
    frustumCulled: obj.frustumCulled,
    position: serializeVector3(obj.position),
    sortObjects: obj.sortObjects,
    perObjectFrustumCulled: obj.perObjectFrustumCulled,
  };

  // Geometry counts — BatchedMesh stores multiple geometries in one buffer
  const geo = obj.geometry;
  if (geo) {
    const attrs = geo.attributes || {};
    const posAttr = attrs.position;
    result.geometry = {
      totalVertices: posAttr?.count || 0,
      totalIndices: geo.index?.count || 0,
      attributes: Object.keys(attrs),
      boundingSphere: geo.boundingSphere
        ? { center: serializeVector3(geo.boundingSphere.center), radius: geo.boundingSphere.radius }
        : null,
    };
  }

  // Material (uuid only in full mode)
  if (obj.material) {
    const mat = obj.material;
    const matInfo: Record<string, unknown> = {
      type: mat.constructor?.name || mat.type || 'unknown',
      name: mat.name || '',
    };
    if (full) matInfo.uuid = mat.uuid;
    result.material = matInfo;
  }

  // Geometry/draw range counts (r155+)
  if (typeof obj.getGeometryCount === 'function') {
    result.geometryCount = obj.getGeometryCount();
  }
  if (typeof obj.getInstanceCount === 'function') {
    result.instanceCount = obj.getInstanceCount();
  }

  // Max counts
  if (obj._maxGeometryCount !== undefined) result.maxGeometryCount = obj._maxGeometryCount;
  if (obj._maxVertexCount !== undefined) result.maxVertexCount = obj._maxVertexCount;
  if (obj._maxIndexCount !== undefined) result.maxIndexCount = obj._maxIndexCount;
  if (obj._maxInstanceCount !== undefined) result.maxInstanceCount = obj._maxInstanceCount;

  // Sample draw ranges (geometry ranges within the shared buffer)
  const drawRanges: Record<string, unknown>[] = [];
  if (obj._drawRanges && Array.isArray(obj._drawRanges)) {
    const limit = Math.min(obj._drawRanges.length, 10);
    for (let i = 0; i < limit; i++) {
      const range = obj._drawRanges[i];
      if (range) {
        drawRanges.push({
          index: i,
          start: range.start,
          count: range.count,
          materialIndex: range.materialIndex,
        });
      }
    }
  }
  if (drawRanges.length > 0) result.sampleDrawRanges = drawRanges;

  // Visibility per instance (r155+)
  if (typeof obj.getVisibleAt === 'function' && result.instanceCount) {
    const visCount = result.instanceCount as number;
    let visibleCount = 0;
    let hiddenCount = 0;
    const limit = Math.min(visCount, 100);
    for (let i = 0; i < limit; i++) {
      try {
        if (obj.getVisibleAt(i)) visibleCount++;
        else hiddenCount++;
      } catch { break; }
    }
    result.visibility = {
      sampled: limit,
      visible: visibleCount,
      hidden: hiddenCount,
    };
  }

  return result;
}
