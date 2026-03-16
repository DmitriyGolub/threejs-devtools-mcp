/**
 * Shadow inspection and mutation handlers.
 */
import type { Handler } from '../types.js';
import { readColorHex } from './color-utils.js';
import { serializeVector3 } from '../serializers/vector.js';
import { resolveObject } from './mutate.js';

const SHADOW_MAP_TYPE_NAMES: Record<number, string> = {
  0: 'BasicShadowMap',
  1: 'PCFShadowMap',
  2: 'PCFSoftShadowMap',
  3: 'VSMShadowMap',
};

// ── shadow_details ──────────────────────────────────────

export const shadowDetailsHandler: Handler = (ctx) => {
  const r = ctx.renderer;

  const globalSettings = {
    enabled: r.shadowMap?.enabled || false,
    type: r.shadowMap?.type ?? -1,
    typeName: SHADOW_MAP_TYPE_NAMES[r.shadowMap?.type] || 'Unknown',
    autoUpdate: r.shadowMap?.autoUpdate ?? true,
  };

  // Collect shadow-casting lights
  const lights: any[] = [];
  ctx.scene.traverse((obj: any) => {
    if (obj.isLight && obj.shadow) {
      const shadow = obj.shadow;
      const cam = shadow.camera;
      const light: any = {
        name: obj.name || '',
        uuid: obj.uuid,
        type: obj.type,
        castShadow: obj.castShadow,
        color: obj.color ? readColorHex(obj.color) : null,
        intensity: obj.intensity,
        position: serializeVector3(obj.position),
        shadow: {
          bias: shadow.bias,
          normalBias: shadow.normalBias,
          radius: shadow.radius,
          blurSamples: shadow.blurSamples,
          mapSize: shadow.mapSize
            ? [shadow.mapSize.x, shadow.mapSize.y]
            : null,
          hasMap: !!shadow.map,
          mapResolution: shadow.map
            ? [shadow.map.width, shadow.map.height]
            : null,
        },
      };

      // Shadow camera frustum
      if (cam) {
        if (cam.isOrthographicCamera) {
          light.shadow.camera = {
            type: 'Orthographic',
            left: cam.left,
            right: cam.right,
            top: cam.top,
            bottom: cam.bottom,
            near: cam.near,
            far: cam.far,
          };
        } else {
          light.shadow.camera = {
            type: 'Perspective',
            fov: cam.fov,
            aspect: cam.aspect,
            near: cam.near,
            far: cam.far,
          };
        }
      }

      lights.push(light);
    }
  });

  // Collect shadow casters and receivers
  const casters: any[] = [];
  const receivers: any[] = [];
  ctx.scene.traverse((obj: any) => {
    if (obj.isMesh || obj.isSkinnedMesh || obj.isInstancedMesh) {
      if (obj.castShadow) {
        casters.push({
          name: obj.name || '',
          uuid: obj.uuid,
          type: obj.type,
        });
      }
      if (obj.receiveShadow) {
        receivers.push({
          name: obj.name || '',
          uuid: obj.uuid,
          type: obj.type,
        });
      }
    }
  });

  return {
    global: globalSettings,
    lights,
    casters: { count: casters.length, objects: casters.slice(0, 50) },
    receivers: { count: receivers.length, objects: receivers.slice(0, 50) },
  };
};

// ── set_shadow ──────────────────────────────────────────

export const setShadowHandler: Handler = (ctx, params) => {
  const obj = resolveObject(ctx, params);

  // Set castShadow / receiveShadow on any object
  if (params.castShadow !== undefined) {
    obj.castShadow = !!params.castShadow;
  }
  if (params.receiveShadow !== undefined) {
    obj.receiveShadow = !!params.receiveShadow;
  }

  // Light-specific shadow settings
  if (obj.isLight && obj.shadow) {
    const shadow = obj.shadow;

    if (params.bias !== undefined) shadow.bias = params.bias as number;
    if (params.normalBias !== undefined) shadow.normalBias = params.normalBias as number;
    if (params.radius !== undefined) shadow.radius = params.radius as number;
    if (params.blurSamples !== undefined) shadow.blurSamples = params.blurSamples as number;

    if (params.mapSize !== undefined) {
      const size = params.mapSize as number[];
      if (Array.isArray(size) && size.length === 2) {
        shadow.mapSize.set(size[0], size[1]);
        // Dispose old map to force re-creation at new size
        if (shadow.map) {
          shadow.map.dispose();
          shadow.map = null;
        }
      }
    }

    // Shadow camera bounds (for directional/spot lights)
    const cam = shadow.camera;
    if (cam) {
      if (params.cameraNear !== undefined) cam.near = params.cameraNear as number;
      if (params.cameraFar !== undefined) cam.far = params.cameraFar as number;

      if (cam.isOrthographicCamera) {
        if (params.cameraLeft !== undefined) cam.left = params.cameraLeft as number;
        if (params.cameraRight !== undefined) cam.right = params.cameraRight as number;
        if (params.cameraTop !== undefined) cam.top = params.cameraTop as number;
        if (params.cameraBottom !== undefined) cam.bottom = params.cameraBottom as number;
      }

      cam.updateProjectionMatrix();
    }

    // Force shadow map to update
    if (ctx.renderer.shadowMap) {
      ctx.renderer.shadowMap.needsUpdate = true;
    }
  }

  const result: any = {
    success: true,
    object: obj.name || obj.uuid,
    type: obj.type,
    castShadow: obj.castShadow,
    receiveShadow: obj.receiveShadow,
  };

  if (obj.isLight && obj.shadow) {
    result.shadow = {
      bias: obj.shadow.bias,
      normalBias: obj.shadow.normalBias,
      radius: obj.shadow.radius,
      mapSize: obj.shadow.mapSize
        ? [obj.shadow.mapSize.x, obj.shadow.mapSize.y]
        : null,
    };
  }

  return result;
};
