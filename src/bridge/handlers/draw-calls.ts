/**
 * Draw call breakdown — per-object cost analysis.
 */
import type { Handler } from '../types.js';
import { resolveType } from './diagnostics.js';
import { serializeVector3 } from '../serializers/vector.js';

export const drawCallBreakdownHandler: Handler = (ctx) => {
  const objects: {
    name: string;
    uuid: string;
    type: string;
    drawCalls: number;
    triangles: number;
    visible: boolean;
    frustumCulled: boolean;
    material: string;
    position: [number, number, number];
  }[] = [];

  let totalVertices = 0;

  ctx.scene.traverse((obj: any) => {
    if (!obj.geometry) return;
    if (obj.isHelper || obj.type?.includes('Helper')) return;

    const geo = obj.geometry;
    const mats = obj.material
      ? (Array.isArray(obj.material) ? obj.material : [obj.material])
      : [];

    let drawCalls = Math.max(mats.length, 1);
    if (obj.isBatchedMesh && typeof obj.getGeometryCount === 'function') {
      drawCalls = obj.getGeometryCount();
    }

    const indexCount = geo.index?.count || 0;
    const vertexCount = geo.attributes?.position?.count || 0;
    let triangles = indexCount > 0 ? Math.floor(indexCount / 3) : Math.floor(vertexCount / 3);

    if (obj.isInstancedMesh) {
      triangles *= obj.count || 0;
    }

    if (obj.visible) totalVertices += vertexCount;

    const matNames = mats.map((m: any) => m.name || m.type || m.constructor?.name || 'unknown');

    objects.push({
      name: obj.name || '',
      uuid: obj.uuid,
      type: resolveType(obj),
      drawCalls,
      triangles,
      visible: obj.visible,
      frustumCulled: obj.frustumCulled,
      material: matNames.join(', '),
      position: serializeVector3(obj.position),
    });
  });

  objects.sort((a, b) => b.triangles - a.triangles || b.drawCalls - a.drawCalls);

  const totalDrawCalls = objects.reduce((sum, o) => sum + (o.visible ? o.drawCalls : 0), 0);
  const totalTriangles = objects.reduce((sum, o) => sum + (o.visible ? o.triangles : 0), 0);
  let hiddenCount = 0;
  let hiddenTriangles = 0;
  for (const o of objects) {
    if (!o.visible) { hiddenCount++; hiddenTriangles += o.triangles; }
  }

  const info = ctx.renderer.info;

  return {
    summary: {
      totalObjects: objects.length,
      totalDrawCalls,
      totalTriangles,
      hiddenObjects: hiddenCount,
      hiddenTriangles,
      rendererReported: {
        drawCalls: info?.render?.calls || 0,
        triangles: info?.render?.triangles || 0,
      },
    },
    topObjects: objects.slice(0, 50).map(o => ({
      name: o.name,
      uuid: o.uuid,
      type: o.type,
      drawCalls: o.drawCalls,
      triangles: o.triangles,
      costPercent: totalTriangles > 0
        ? Math.round((o.triangles / totalTriangles) * 1000) / 10
        : 0,
      visible: o.visible,
      material: o.material,
      position: o.position,
    })),
    multiMaterialObjects: objects
      .filter(o => o.drawCalls > 1)
      .slice(0, 20)
      .map(o => ({ name: o.name, drawCalls: o.drawCalls, material: o.material })),
  };
};
