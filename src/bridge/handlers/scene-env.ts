/**
 * Fog, renderer settings, layers, and scene environment handlers.
 */
import type { Handler } from '../types.js';
import { serializeVector3 } from '../serializers/vector.js';
import { setColorFromHex, readColorHex } from './color-utils.js';

// ── fog_details ──────────────────────────────────────────

export const fogDetailsHandler: Handler = (ctx) => {
  const scene = ctx.scene;
  const fog = scene.fog;

  if (!fog) {
    return {
      type: 'none',
      background: scene.background?.isColor ? readColorHex(scene.background) : null,
    };
  }

  const result: any = {
    type: fog.isFogExp2 ? 'FogExp2' : 'Fog',
    color: readColorHex(fog.color),
  };

  if (fog.isFogExp2) {
    result.density = fog.density;
  } else {
    result.near = fog.near;
    result.far = fog.far;
  }

  if (scene.background?.isColor) {
    result.background = readColorHex(scene.background);
  }

  return result;
};

// ── set_fog ──────────────────────────────────────────────

export const setFogHandler: Handler = (ctx, params) => {
  const scene = ctx.scene;
  const fog = scene.fog;

  if (!fog) throw new Error('Scene has no fog. Create fog first or use run_js.');

  if (params.color !== undefined) {
    setColorFromHex(fog.color, params.color);
  }

  if (fog.isFogExp2) {
    if (params.density !== undefined) fog.density = params.density as number;
  } else {
    if (params.near !== undefined) fog.near = params.near as number;
    if (params.far !== undefined) fog.far = params.far as number;
  }

  // Sync background color if requested
  if (params.background !== undefined && scene.background?.isColor) {
    setColorFromHex(scene.background, params.background);
  }

  return {
    success: true,
    type: fog.isFogExp2 ? 'FogExp2' : 'Fog',
    color: readColorHex(fog.color),
    ...(fog.isFogExp2 ? { density: fog.density } : { near: fog.near, far: fog.far }),
    ...(scene.background?.isColor ? { background: readColorHex(scene.background) } : {}),
  };
};

// ── renderer_settings ────────────────────────────────────

const TONE_MAPPING_NAMES: Record<number, string> = {
  0: 'NoToneMapping',
  1: 'LinearToneMapping',
  2: 'ReinhardToneMapping',
  3: 'CineonToneMapping',
  4: 'ACESFilmicToneMapping',
  6: 'AgXToneMapping',
  7: 'NeutralToneMapping',
};

export const rendererSettingsHandler: Handler = (ctx) => {
  const r = ctx.renderer;
  if (!r) throw new Error('No renderer found');

  return {
    toneMapping: r.toneMapping,
    toneMappingName: TONE_MAPPING_NAMES[r.toneMapping] || `Unknown(${r.toneMapping})`,
    toneMappingExposure: r.toneMappingExposure,
    outputColorSpace: r.outputColorSpace,
    pixelRatio: r.getPixelRatio?.() || 1,
    shadowMap: {
      enabled: r.shadowMap?.enabled || false,
      type: r.shadowMap?.type,
      autoUpdate: r.shadowMap?.autoUpdate,
    },
    autoClear: r.autoClear,
    autoClearColor: r.autoClearColor,
    autoClearDepth: r.autoClearDepth,
    autoClearStencil: r.autoClearStencil,
    sortObjects: r.sortObjects,
    localClippingEnabled: r.localClippingEnabled,
    physicallyCorrectLights: r.physicallyCorrectLights,
    canvas: {
      width: r.domElement?.width || 0,
      height: r.domElement?.height || 0,
    },
  };
};

// ── set_renderer ─────────────────────────────────────────

export const setRendererHandler: Handler = (ctx, params) => {
  const r = ctx.renderer;
  if (!r) throw new Error('No renderer found');

  if (params.toneMapping !== undefined) r.toneMapping = params.toneMapping as number;
  if (params.toneMappingExposure !== undefined) r.toneMappingExposure = params.toneMappingExposure as number;
  if (params.outputColorSpace !== undefined) r.outputColorSpace = params.outputColorSpace as string;
  if (params.pixelRatio !== undefined) r.setPixelRatio?.(params.pixelRatio as number);
  if (params.sortObjects !== undefined) r.sortObjects = !!params.sortObjects;
  if (params.localClippingEnabled !== undefined) r.localClippingEnabled = !!params.localClippingEnabled;

  if (params.shadowMapEnabled !== undefined && r.shadowMap) {
    r.shadowMap.enabled = !!params.shadowMapEnabled;
  }
  if (params.shadowMapType !== undefined && r.shadowMap) {
    r.shadowMap.type = params.shadowMapType as number;
    r.shadowMap.needsUpdate = true;
  }

  return {
    success: true,
    toneMapping: r.toneMapping,
    toneMappingName: TONE_MAPPING_NAMES[r.toneMapping] || `Unknown(${r.toneMapping})`,
    toneMappingExposure: r.toneMappingExposure,
    outputColorSpace: r.outputColorSpace,
    pixelRatio: r.getPixelRatio?.() || 1,
    sortObjects: r.sortObjects,
    shadowMap: r.shadowMap ? { enabled: r.shadowMap.enabled, type: r.shadowMap.type } : null,
  };
};

// ── layer_details ────────────────────────────────────────

export const layerDetailsHandler: Handler = (ctx) => {
  const cam = ctx.camera;
  const objects: any[] = [];

  ctx.scene.traverse((obj: any) => {
    // Default layer mask is 1 (layer 0 only). Report non-default
    if (obj.layers && obj.layers.mask !== 1) {
      objects.push({
        name: obj.name || '',
        uuid: obj.uuid,
        type: obj.type,
        layerMask: obj.layers.mask,
      });
    }
  });

  return {
    cameraLayers: cam?.layers?.mask || 1,
    objects,
  };
};

// ── set_layers ───────────────────────────────────────────

export const setLayersHandler: Handler = (ctx, params) => {
  let obj: any = null;

  if (params.target === 'camera') {
    obj = ctx.camera;
  } else {
    // Find by name or uuid
    const name = params.name as string;
    const uuid = params.uuid as string;
    ctx.scene.traverse((child: any) => {
      if (!obj) {
        if (uuid && child.uuid === uuid) obj = child;
        else if (name && child.name === name) obj = child;
      }
    });
  }

  if (!obj) throw new Error(`Object not found: ${params.name || params.uuid || params.target}`);

  if (params.mask !== undefined) {
    obj.layers.mask = params.mask as number;
  } else if (params.layer !== undefined) {
    const layer = params.layer as number;
    if (params.enabled) {
      obj.layers.enable(layer);
    } else {
      obj.layers.disable(layer);
    }
  }

  return {
    success: true,
    object: obj.name || obj.uuid,
    layerMask: obj.layers.mask,
  };
};
