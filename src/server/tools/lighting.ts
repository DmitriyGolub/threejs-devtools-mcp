/** Lights, shadows, environment, fog */
import { z } from 'zod';
import { bridgeTool, type ToolContext } from '../tool-helper.js';
import { byName, vec2, vec3 } from './schemas.js';

export function registerLightingTools(ctx: ToolContext): void {
  bridgeTool(ctx, 'shadow_details', 'inspect',
    'Shadow maps: global settings, per-light bias/mapSize/camera frustum, casters and receivers.');

  bridgeTool(ctx, 'scene_background', 'inspect',
    'Scene background, environment map (IBL), backgroundBlurriness/Intensity, color management.');

  bridgeTool(ctx, 'env_map_details', 'inspect',
    'Environment maps: scene.environment, scene.background, per-material envMap.');

  bridgeTool(ctx, 'fog_details', 'inspect',
    'Scene fog: type (Fog/FogExp2), color, near/far or density.');

  bridgeTool(ctx, 'set_light', 'preview',
    'Change a light: color, intensity, position, castShadow, groundColor (HemisphereLight).',
    { ...byName('Light'),
      color: z.string().optional().describe('#RRGGBB'),
      intensity: z.number().optional(),
      position: vec3(),
      castShadow: z.boolean().optional(),
      groundColor: z.string().optional().describe('HemisphereLight ground color, #RRGGBB') });

  bridgeTool(ctx, 'set_shadow', 'preview',
    'Change shadow casting/receiving on any object, and bias/mapSize/shadow camera on lights.',
    { ...byName('Object or light'),
      castShadow: z.boolean().optional(),
      receiveShadow: z.boolean().optional(),
      bias: z.number().optional().describe('Light only, e.g. -0.0001'),
      normalBias: z.number().optional().describe('Light only'),
      radius: z.number().optional().describe('Blur radius (light only)'),
      blurSamples: z.number().optional().describe('VSM blur samples (light only)'),
      mapSize: vec2('[width, height] shadow map resolution'),
      cameraNear: z.number().optional(),
      cameraFar: z.number().optional(),
      cameraLeft: z.number().optional().describe('DirectionalLight'),
      cameraRight: z.number().optional().describe('DirectionalLight'),
      cameraTop: z.number().optional().describe('DirectionalLight'),
      cameraBottom: z.number().optional().describe('DirectionalLight') });

  bridgeTool(ctx, 'set_fog', 'preview',
    'Change scene fog (color, near/far or density) and the background color.',
    { color: z.string().optional().describe('#RRGGBB'),
      near: z.number().optional().describe('Fog only'),
      far: z.number().optional().describe('Fog only'),
      density: z.number().optional().describe('FogExp2 only'),
      background: z.string().optional().describe('Scene background color, #RRGGBB') });
}
