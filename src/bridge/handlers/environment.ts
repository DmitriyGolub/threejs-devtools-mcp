/**
 * Scene background, environment map, and color management inspection.
 */
import type { Handler } from '../types.js';
import { readColorHex } from './color-utils.js';

// ── scene_background ────────────────────────────────────

export const sceneBackgroundHandler: Handler = (ctx) => {
  const scene = ctx.scene;
  const r = ctx.renderer;

  const result: any = {
    background: null,
    environment: null,
    colorManagement: {
      outputColorSpace: r.outputColorSpace || 'srgb',
      toneMapping: r.toneMapping,
      toneMappingExposure: r.toneMappingExposure,
    },
  };

  // Scene background
  if (scene.background) {
    if (scene.background.isColor) {
      result.background = {
        type: 'Color',
        color: readColorHex(scene.background),
      };
    } else if (scene.background.isTexture) {
      const tex = scene.background;
      result.background = {
        type: tex.isCubeTexture ? 'CubeTexture' : 'Texture',
        name: tex.name || '',
        uuid: tex.uuid,
        mapping: tex.mapping,
        colorSpace: tex.colorSpace || 'unknown',
      };
      if (tex.image) {
        if (tex.isCubeTexture && tex.image[0]) {
          result.background.faceSize = tex.image[0].width || tex.image[0].naturalWidth || 'unknown';
        } else {
          result.background.width = tex.image.width || tex.image.naturalWidth || 'unknown';
          result.background.height = tex.image.height || tex.image.naturalHeight || 'unknown';
        }
      }
    }
  }

  // Scene environment (used for IBL — image-based lighting)
  if (scene.environment) {
    const env = scene.environment;
    result.environment = {
      type: env.isCubeTexture ? 'CubeTexture' : 'Texture',
      name: env.name || '',
      uuid: env.uuid,
      mapping: env.mapping,
      colorSpace: env.colorSpace || 'unknown',
      isPMREM: env.mapping === 306 || env.mapping === 307, // EquirectangularReflection/Refraction
    };
    if (env.image) {
      if (env.isCubeTexture && env.image[0]) {
        result.environment.faceSize = env.image[0].width || 'unknown';
      } else {
        result.environment.width = env.image.width || env.image.naturalWidth || 'unknown';
        result.environment.height = env.image.height || env.image.naturalHeight || 'unknown';
      }
    }
  }

  // scene.backgroundBlurriness / backgroundIntensity (Three.js r152+)
  if (scene.backgroundBlurriness !== undefined) {
    result.backgroundBlurriness = scene.backgroundBlurriness;
  }
  if (scene.backgroundIntensity !== undefined) {
    result.backgroundIntensity = scene.backgroundIntensity;
  }
  if (scene.backgroundRotation) {
    result.backgroundRotation = [
      scene.backgroundRotation.x,
      scene.backgroundRotation.y,
      scene.backgroundRotation.z,
    ];
  }
  if (scene.environmentIntensity !== undefined) {
    result.environmentIntensity = scene.environmentIntensity;
  }
  if (scene.environmentRotation) {
    result.environmentRotation = [
      scene.environmentRotation.x,
      scene.environmentRotation.y,
      scene.environmentRotation.z,
    ];
  }

  return result;
};
