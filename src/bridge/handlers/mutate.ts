/**
 * Mutation handlers — modify Three.js objects at runtime.
 */
import type { Handler } from '../types.js';
import { findObjectByName, findObjectByUuid, findMaterial } from '../traversal.js';
import { serializeVector3 } from '../serializers/vector.js';
import { setColorFromHex, readColorHex } from './color-utils.js';

// ── Helpers ──────────────────────────────────────────────

export function resolveObject(ctx: any, params: Record<string, unknown>): any {
  let obj: any = null;
  if (params.uuid) obj = findObjectByUuid(ctx.scene, params.uuid as string);
  else if (params.name) obj = findObjectByName(ctx.scene, params.name as string);
  if (!obj) throw new Error(`Object not found: ${params.name || params.uuid}`);
  return obj;
}

function resolveMaterial(ctx: any, params: Record<string, unknown>): any {
  // Try direct material lookup first
  let mat = findMaterial(ctx.scene, params.name as string, params.uuid as string);
  if (mat) return mat;

  // Fallback: maybe "name" is actually an object name — get its material
  if (params.name) {
    const obj = findObjectByName(ctx.scene, params.name as string);
    if (obj?.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      return mats[0];
    }
  }

  throw new Error(`Material not found: ${params.name || params.uuid}`);
}

// ── set_material_property ────────────────────────────────

const SETTABLE_MATERIAL_PROPS = new Set([
  'color', 'emissive', 'roughness', 'metalness', 'opacity',
  'transparent', 'wireframe', 'visible', 'side', 'depthWrite',
  'depthTest', 'alphaTest', 'flatShading', 'fog',
]);

export const setMaterialPropertyHandler: Handler = (ctx, params) => {
  const mat = resolveMaterial(ctx, params);
  const prop = params.property as string;
  const value = params.value;

  if (!prop) throw new Error('Missing "property" parameter');
  if (value === undefined) throw new Error('Missing "value" parameter');
  if (!SETTABLE_MATERIAL_PROPS.has(prop)) {
    throw new Error(`Property "${prop}" is not settable. Allowed: ${[...SETTABLE_MATERIAL_PROPS].join(', ')}`);
  }

  // Color properties need special handling (sRGB input → linear internal)
  if (prop === 'color' || prop === 'emissive') {
    if (!mat[prop]) throw new Error(`Material has no "${prop}" property`);
    setColorFromHex(mat[prop], value);
  } else {
    mat[prop] = value;
  }

  mat.needsUpdate = true;

  return {
    success: true,
    material: mat.uuid,
    property: prop,
    newValue: mat[prop]?.isColor ? readColorHex(mat[prop]) : mat[prop],
  };
};

// ── set_uniform ──────────────────────────────────────────

export const setUniformHandler: Handler = (ctx, params) => {
  const mat = resolveMaterial(ctx, params);
  const uniformName = params.uniform as string;
  const value = params.value;

  if (!uniformName) throw new Error('Missing "uniform" parameter');
  if (value === undefined) throw new Error('Missing "value" parameter');
  if (!mat.uniforms) throw new Error('Material has no uniforms (not a ShaderMaterial)');
  if (!mat.uniforms[uniformName]) throw new Error(`Uniform "${uniformName}" not found. Available: ${Object.keys(mat.uniforms).join(', ')}`);

  const uniform = mat.uniforms[uniformName];
  const currentValue = uniform.value;

  // Color uniform (sRGB input → linear internal)
  if (currentValue?.isColor) {
    setColorFromHex(currentValue, value);
  }
  // Vector2
  else if (currentValue?.isVector2 && typeof value === 'object' && value !== null) {
    const v = value as { x?: number; y?: number };
    if (v.x !== undefined) currentValue.x = v.x;
    if (v.y !== undefined) currentValue.y = v.y;
  }
  // Vector3
  else if (currentValue?.isVector3 && typeof value === 'object' && value !== null) {
    const v = value as { x?: number; y?: number; z?: number };
    if (v.x !== undefined) currentValue.x = v.x;
    if (v.y !== undefined) currentValue.y = v.y;
    if (v.z !== undefined) currentValue.z = v.z;
  }
  // Scalar (number, boolean)
  else {
    uniform.value = value;
  }

  return {
    success: true,
    material: mat.uuid,
    uniform: uniformName,
    newValue: currentValue?.isColor ? readColorHex(currentValue)
      : currentValue?.isVector3 ? { x: currentValue.x, y: currentValue.y, z: currentValue.z }
      : currentValue?.isVector2 ? { x: currentValue.x, y: currentValue.y }
      : uniform.value,
  };
};

// ── set_object_transform ─────────────────────────────────

export const setObjectTransformHandler: Handler = (ctx, params) => {
  const obj = resolveObject(ctx, params);

  if (params.position !== undefined) {
    const p = params.position as number[];
    if (!Array.isArray(p) || p.length !== 3) throw new Error('position must be [x, y, z]');
    obj.position.set(p[0], p[1], p[2]);
  }

  if (params.rotation !== undefined) {
    const r = params.rotation as number[];
    if (!Array.isArray(r) || r.length !== 3) throw new Error('rotation must be [x, y, z] in radians');
    obj.rotation.set(r[0], r[1], r[2]);
  }

  if (params.scale !== undefined) {
    const s = params.scale as number[];
    if (!Array.isArray(s) || s.length !== 3) throw new Error('scale must be [x, y, z]');
    obj.scale.set(s[0], s[1], s[2]);
  }

  if (params.visible !== undefined) {
    obj.visible = !!params.visible;
  }

  return {
    success: true,
    object: obj.name || obj.uuid,
    position: serializeVector3(obj.position),
    rotation: serializeVector3(obj.rotation),
    scale: serializeVector3(obj.scale),
    visible: obj.visible,
  };
};

// ── set_light ────────────────────────────────────────────

export const setLightHandler: Handler = (ctx, params) => {
  const obj = resolveObject(ctx, params);

  if (!obj.isLight) throw new Error(`"${obj.name || obj.uuid}" is not a light (type: ${obj.type})`);

  if (params.color !== undefined) {
    setColorFromHex(obj.color, params.color);
  }

  if (params.intensity !== undefined) {
    obj.intensity = params.intensity as number;
  }

  if (params.position !== undefined) {
    const p = params.position as number[];
    if (Array.isArray(p) && p.length === 3) obj.position.set(p[0], p[1], p[2]);
  }

  if (params.castShadow !== undefined) {
    obj.castShadow = !!params.castShadow;
  }

  // HemisphereLight has groundColor
  if (params.groundColor !== undefined && obj.groundColor) {
    setColorFromHex(obj.groundColor, params.groundColor);
  }

  return {
    success: true,
    light: obj.name || obj.uuid,
    type: obj.type,
    color: readColorHex(obj.color),
    intensity: obj.intensity,
    position: serializeVector3(obj.position),
    castShadow: obj.castShadow,
    ...(obj.groundColor ? { groundColor: readColorHex(obj.groundColor) } : {}),
  };
};

// ── highlight_object ─────────────────────────────────────

const highlightState = new Map<string, { material: any; wireframe: boolean }>();

export const highlightObjectHandler: Handler = (ctx, params) => {
  const obj = resolveObject(ctx, params);
  const mode = (params.mode as string) || 'wireframe';
  const enabled = params.enabled !== false; // default true

  if (mode === 'wireframe') {
    obj.traverse((child: any) => {
      if (!child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (enabled) {
          if (!highlightState.has(mat.uuid)) {
            highlightState.set(mat.uuid, { material: mat, wireframe: mat.wireframe });
          }
          mat.wireframe = true;
        } else {
          const saved = highlightState.get(mat.uuid);
          if (saved) {
            mat.wireframe = saved.wireframe;
            highlightState.delete(mat.uuid);
          }
        }
        mat.needsUpdate = true;
      }
    });
  } else if (mode === 'visibility') {
    obj.visible = enabled;
  }

  return {
    success: true,
    object: obj.name || obj.uuid,
    mode,
    enabled,
  };
};

// ── run_js ───────────────────────────────────────────────

export const runJsHandler: Handler = (ctx, params) => {
  const code = params.code as string;
  if (!code) throw new Error('Missing "code" parameter');

  // Provide scene, renderer, camera, THREE as context variables
  const fn = new Function('scene', 'renderer', 'camera', 'gl', code);
  const result = fn(ctx.scene, ctx.renderer, ctx.camera, ctx.gl);

  // Serialize the result safely
  try {
    const json = JSON.stringify(result);
    return JSON.parse(json);
  } catch {
    return String(result);
  }
};

// ── performance_snapshot ─────────────────────────────────

export const performanceSnapshotHandler: Handler = (ctx) => {
  const r = ctx.renderer;
  const info = r.info;

  // Collect instanced mesh stats
  const instancedMeshes: any[] = [];
  ctx.scene.traverse((obj: any) => {
    if (obj.isInstancedMesh) {
      instancedMeshes.push({
        name: obj.name || obj.uuid,
        count: obj.count,
        maxCount: obj.instanceMatrix?.count || 0,
        geometry: obj.geometry?.constructor?.name || 'unknown',
        triangles: (obj.geometry?.index?.count || 0) / 3 * obj.count,
      });
    }
  });

  // Count objects by type
  const typeCounts: Record<string, number> = {};
  let totalVertices = 0;
  ctx.scene.traverse((obj: any) => {
    const type = obj.type || 'Unknown';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    if (obj.geometry?.attributes?.position) {
      totalVertices += obj.geometry.attributes.position.count;
    }
  });

  return {
    fps: Math.round(1000 / (info.render?.frame ? 16.67 : 16.67)), // approximate
    drawCalls: info.render?.calls || 0,
    triangles: info.render?.triangles || 0,
    totalVertices,
    programs: info.programs?.length || 0,
    memory: {
      geometries: info.memory?.geometries || 0,
      textures: info.memory?.textures || 0,
    },
    canvas: {
      width: r.domElement?.width || 0,
      height: r.domElement?.height || 0,
      pixelRatio: r.getPixelRatio?.() || 1,
    },
    instancedMeshes,
    objectsByType: typeCounts,
  };
};

// ── instanced_mesh_details ───────────────────────────────

export const instancedMeshDetailsHandler: Handler = (ctx, params) => {
  const obj = resolveObject(ctx, params);

  if (!obj.isInstancedMesh) {
    throw new Error(`"${obj.name || obj.uuid}" is not an InstancedMesh (type: ${obj.type})`);
  }

  const result: any = {
    name: obj.name || '',
    uuid: obj.uuid,
    count: obj.count,
    maxCount: obj.instanceMatrix?.count || 0,
    frustumCulled: obj.frustumCulled,
    visible: obj.visible,
    geometry: {
      type: obj.geometry?.constructor?.name || 'unknown',
      vertices: obj.geometry?.attributes?.position?.count || 0,
      index: obj.geometry?.index?.count || 0,
      attributes: Object.keys(obj.geometry?.attributes || {}),
    },
    material: obj.material
      ? { type: obj.material.constructor?.name || 'unknown', name: obj.material.name || '' }
      : null,
    totalTriangles: ((obj.geometry?.index?.count || 0) / 3) * obj.count,
  };

  // Sample instance transforms (first N instances)
  const sampleCount = Math.min(params.sampleCount as number || 5, obj.count, 20);
  const startIndex = (params.startIndex as number) || 0;
  const samples: any[] = [];

  // Read directly from instanceMatrix.array (Float32Array, 16 floats per matrix)
  const matArray = obj.instanceMatrix?.array;
  if (matArray) {
    for (let i = startIndex; i < startIndex + sampleCount && i < obj.count; i++) {
      const offset = i * 16;
      // Column-major 4x4 matrix: [m00,m10,m20,m30, m01,m11,m21,m31, m02,m12,m22,m32, m03,m13,m23,m33]
      // Position is in column 3: elements[12], [13], [14]
      // Scale = length of each column (0-2)
      const sx = Math.sqrt(matArray[offset] ** 2 + matArray[offset + 1] ** 2 + matArray[offset + 2] ** 2);
      const sy = Math.sqrt(matArray[offset + 4] ** 2 + matArray[offset + 5] ** 2 + matArray[offset + 6] ** 2);
      const sz = Math.sqrt(matArray[offset + 8] ** 2 + matArray[offset + 9] ** 2 + matArray[offset + 10] ** 2);

      samples.push({
        index: i,
        position: [
          Math.round(matArray[offset + 12] * 1000) / 1000,
          Math.round(matArray[offset + 13] * 1000) / 1000,
          Math.round(matArray[offset + 14] * 1000) / 1000,
        ],
        scale: [
          Math.round(sx * 1000) / 1000,
          Math.round(sy * 1000) / 1000,
          Math.round(sz * 1000) / 1000,
        ],
      });
    }
  }

  result.sampleInstances = samples;

  // List custom instance attributes (beyond instanceMatrix)
  const customAttrs: any = {};
  if (obj.geometry?.attributes) {
    for (const [key, attr] of Object.entries(obj.geometry.attributes)) {
      const a = attr as any;
      if (a.isInstancedBufferAttribute) {
        customAttrs[key] = {
          itemSize: a.itemSize,
          count: a.count,
          // Sample first few values
          sample: Array.from(a.array.slice(0, Math.min(a.itemSize * sampleCount, 30))),
        };
      }
    }
  }
  if (Object.keys(customAttrs).length > 0) {
    result.instanceAttributes = customAttrs;
  }

  // InstancedMesh color if set
  if (obj.instanceColor) {
    const colorSamples: string[] = [];
    // Proper sRGB transfer function (piecewise, matches Three.js ColorManagement)
    const linearToSrgb = (v: number): number => {
      if (v <= 0.0031308) return Math.round(v * 12.92 * 255);
      return Math.round((1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255);
    };
    for (let i = startIndex; i < startIndex + sampleCount && i < obj.count; i++) {
      const r = obj.instanceColor.array[i * 3];
      const g = obj.instanceColor.array[i * 3 + 1];
      const b = obj.instanceColor.array[i * 3 + 2];
      const hex = '#' + [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)]
        .map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('');
      colorSamples.push(hex);
    }
    result.instanceColors = colorSamples;
  }

  return result;
};

// ── set_instanced_mesh ───────────────────────────────────

export const setInstancedMeshHandler: Handler = (ctx, params) => {
  const obj = resolveObject(ctx, params);

  if (!obj.isInstancedMesh) {
    throw new Error(`"${obj.name || obj.uuid}" is not an InstancedMesh (type: ${obj.type})`);
  }

  // Set count (number of visible instances)
  if (params.count !== undefined) {
    const newCount = params.count as number;
    if (newCount < 0 || newCount > (obj.instanceMatrix?.count || 0)) {
      throw new Error(`count must be 0..${obj.instanceMatrix?.count || 0}`);
    }
    obj.count = newCount;
    obj.instanceMatrix.needsUpdate = true;
  }

  // Set visibility
  if (params.visible !== undefined) {
    obj.visible = !!params.visible;
  }

  // Set frustumCulled
  if (params.frustumCulled !== undefined) {
    obj.frustumCulled = !!params.frustumCulled;
  }

  return {
    success: true,
    name: obj.name || obj.uuid,
    count: obj.count,
    maxCount: obj.instanceMatrix?.count || 0,
    visible: obj.visible,
    frustumCulled: obj.frustumCulled,
  };
};
