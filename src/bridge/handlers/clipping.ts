/**
 * Clipping plane inspection and modification handlers.
 */
import type { Handler } from '../types.js';
import { collectMaterials } from '../traversal.js';

// ── clipping_details ────────────────────────────────────

export const clippingDetailsHandler: Handler = (ctx) => {
  const renderer = ctx.renderer;

  const global: Record<string, unknown> = {
    localClippingEnabled: renderer.localClippingEnabled ?? false,
    globalClippingEnabled: false,
    globalPlanes: [] as Record<string, unknown>[],
  };

  const rendererPlanes = renderer.clippingPlanes;
  if (Array.isArray(rendererPlanes) && rendererPlanes.length > 0) {
    global.globalClippingEnabled = true;
    global.globalPlanes = rendererPlanes.map((plane: any, i: number) => serializePlane(plane, i));
  }

  // Per-material clipping (capped at 20)
  const materials = collectMaterials(ctx.scene);
  const materialClipping: Record<string, unknown>[] = [];

  for (const mat of materials.values()) {
    if (materialClipping.length >= 20) break;
    if (!mat.clippingPlanes || !Array.isArray(mat.clippingPlanes) || mat.clippingPlanes.length === 0) continue;

    materialClipping.push({
      materialName: mat.name || '',
      materialType: mat.type || mat.constructor?.name || 'unknown',
      clipIntersection: mat.clipIntersection ?? false,
      clipShadows: mat.clipShadows ?? false,
      planes: mat.clippingPlanes.map((plane: any, i: number) => serializePlane(plane, i)),
    });
  }

  // ClippingGroup objects (r162+)
  const clippingGroups: Record<string, unknown>[] = [];
  ctx.scene.traverse((obj: any) => {
    if (obj.isClippingGroup && clippingGroups.length < 20) {
      clippingGroups.push({
        name: obj.name || '',
        uuid: obj.uuid,
        enabled: obj.enabled !== false,
        clipIntersection: obj.clipIntersection ?? false,
        clipShadows: obj.clipShadows ?? false,
        planes: Array.isArray(obj.clippingPlanes)
          ? obj.clippingPlanes.map((p: any, i: number) => serializePlane(p, i))
          : [],
        children: obj.children?.length || 0,
      });
    }
  });

  return {
    renderer: global,
    materialClipping: materialClipping.length > 0 ? materialClipping : null,
    clippingGroups: clippingGroups.length > 0 ? clippingGroups : null,
  };
};

// ── set_clipping ────────────────────────────────────────

export const setClippingHandler: Handler = (ctx, params) => {
  const renderer = ctx.renderer;
  const target = params.target as string | undefined;

  if (!target || target === 'renderer') {
    if (params.localClippingEnabled !== undefined) {
      renderer.localClippingEnabled = !!params.localClippingEnabled;
    }

    if (params.planes !== undefined) {
      const planeData = params.planes as Array<{ normal: number[]; constant: number }>;
      if (!Array.isArray(planeData)) {
        throw new Error('planes must be an array of { normal: [x,y,z], constant: number }');
      }

      const THREE = findThreeNamespace();
      if (!THREE?.Plane || !THREE?.Vector3) {
        throw new Error('THREE.Plane not available. Expose THREE globally: window.THREE = THREE');
      }

      renderer.clippingPlanes = planeData.map((p, i) => {
        if (!Array.isArray(p.normal) || p.normal.length !== 3) {
          throw new Error(`Invalid normal at plane ${i}: expected [x, y, z]`);
        }
        const normal = new THREE.Vector3(p.normal[0], p.normal[1], p.normal[2]);
        return new THREE.Plane(normal, p.constant);
      });
    }

    return {
      success: true,
      target: 'renderer',
      localClippingEnabled: renderer.localClippingEnabled,
      globalPlanes: renderer.clippingPlanes?.length || 0,
    };
  }

  if (target === 'material') {
    const matName = params.name as string | undefined;
    const matUuid = params.uuid as string | undefined;
    if (!matName && !matUuid) throw new Error('Provide material name or uuid');

    const materials = collectMaterials(ctx.scene);
    let mat: any = null;

    if (matUuid) mat = materials.get(matUuid);
    if (!mat && matName) {
      for (const m of materials.values()) {
        if (m.name === matName) { mat = m; break; }
      }
    }
    if (!mat) throw new Error(`Material not found: ${matName || matUuid}`);

    if (params.clipIntersection !== undefined) {
      mat.clipIntersection = !!params.clipIntersection;
    }
    if (params.clipShadows !== undefined) {
      mat.clipShadows = !!params.clipShadows;
    }
    if (params.enabled === false) {
      mat.clippingPlanes = null;
    }

    if (params.planes !== undefined) {
      const planeData = params.planes as Array<{ normal: number[]; constant: number }>;
      const THREE = findThreeNamespace();
      if (!THREE?.Plane || !THREE?.Vector3) {
        throw new Error('THREE.Plane not available. Expose THREE globally: window.THREE = THREE');
      }
      mat.clippingPlanes = planeData.map((p, i) => {
        if (!Array.isArray(p.normal) || p.normal.length !== 3) {
          throw new Error(`Invalid normal at plane ${i}: expected [x, y, z]`);
        }
        const normal = new THREE.Vector3(p.normal[0], p.normal[1], p.normal[2]);
        return new THREE.Plane(normal, p.constant);
      });
    }

    mat.needsUpdate = true;

    return {
      success: true,
      target: 'material',
      material: mat.name || mat.uuid,
      clipIntersection: mat.clipIntersection,
      clipShadows: mat.clipShadows,
      planes: mat.clippingPlanes?.length || 0,
    };
  }

  throw new Error(`Unknown target: "${target}". Use "renderer" or "material".`);
};

// ── helpers ─────────────────────────────────────────────

function serializePlane(plane: any, index: number): Record<string, unknown> {
  if (!plane) return { index, error: 'null plane' };
  return {
    index,
    normal: plane.normal
      ? [
          Math.round(plane.normal.x * 10000) / 10000,
          Math.round(plane.normal.y * 10000) / 10000,
          Math.round(plane.normal.z * 10000) / 10000,
        ]
      : [0, 0, 0],
    constant: Math.round((plane.constant ?? 0) * 10000) / 10000,
  };
}

function findThreeNamespace(): any {
  if (typeof window !== 'undefined') {
    if ((window as any).THREE) return (window as any).THREE;
  }
  return null;
}
