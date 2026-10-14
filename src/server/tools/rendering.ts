/** Camera, renderer, clipping, post-processing */
import { z } from 'zod';
import { bridgeTool, type ToolContext } from '../tool-helper.js';
import { byName, paramValue, vec3 } from './schemas.js';

export function registerRenderingTools(ctx: ToolContext): void {
  bridgeTool(ctx, 'camera_details', 'inspect',
    'Active camera: type, position, FOV, near/far, aspect.');

  bridgeTool(ctx, 'renderer_info', 'inspect',
    'Renderer stats and backend (WebGL / WebGPU): draw calls, triangles, memory, capabilities.');

  bridgeTool(ctx, 'renderer_settings', 'inspect',
    'Renderer configuration: toneMapping, exposure, colorSpace, shadowMap, pixelRatio.');

  bridgeTool(ctx, 'clipping_details', 'inspect',
    'Clipping planes: renderer global, per-material, ClippingGroup objects.');

  bridgeTool(ctx, 'postprocessing_list', 'inspect',
    'EffectComposer passes: render passes, shader passes, effects (bloom, SSAO, …).');

  bridgeTool(ctx, 'set_camera', 'preview',
    'Change the active camera: position, rotation, FOV, near/far, zoom, ortho bounds.',
    { position: vec3(),
      rotation: vec3('[x, y, z] in radians'),
      fov: z.number().optional().describe('PerspectiveCamera'),
      near: z.number().optional(),
      far: z.number().optional(),
      zoom: z.number().optional(),
      aspect: z.number().optional().describe('PerspectiveCamera'),
      left: z.number().optional().describe('OrthographicCamera'),
      right: z.number().optional().describe('OrthographicCamera'),
      top: z.number().optional().describe('OrthographicCamera'),
      bottom: z.number().optional().describe('OrthographicCamera') });

  bridgeTool(ctx, 'set_renderer', 'preview',
    'Change renderer settings: tone mapping, exposure, color space, pixel ratio, shadows.',
    { toneMapping: z.number().optional().describe('0=None 1=Linear 2=Reinhard 3=Cineon 4=ACESFilmic 6=AgX 7=Neutral'),
      toneMappingExposure: z.number().optional(),
      outputColorSpace: z.string().optional().describe('srgb, srgb-linear'),
      pixelRatio: z.number().optional(),
      sortObjects: z.boolean().optional(),
      localClippingEnabled: z.boolean().optional(),
      shadowMapEnabled: z.boolean().optional(),
      shadowMapType: z.number().optional().describe('0=Basic 1=PCF 2=PCFSoft 3=VSM') });

  bridgeTool(ctx, 'set_clipping', 'preview',
    'Change clipping planes on the renderer (global) or a material.',
    { target: z.enum(['renderer', 'material']).optional().describe('Default: renderer'),
      ...byName('Material (target=material)'),
      localClippingEnabled: z.boolean().optional().describe('Renderer'),
      planes: z.array(z.object({
        normal: z.array(z.number()).length(3).describe('[x, y, z]'),
        constant: z.number().describe('Distance from origin'),
      })).optional(),
      clipIntersection: z.boolean().optional().describe('Material: intersection instead of union'),
      clipShadows: z.boolean().optional().describe('Material'),
      enabled: z.boolean().optional().describe('false removes the material\'s planes') });

  bridgeTool(ctx, 'set_postprocessing', 'preview',
    'Enable/disable passes, set pass uniforms or effect parameters. Without a pass, lists passes.',
    { passIndex: z.number().optional().describe('From postprocessing_list'),
      passName: z.string().optional().describe('Pass name or class, e.g. "UnrealBloomPass"'),
      enabled: z.boolean().optional(),
      uniforms: z.record(z.string(), paramValue).optional().describe('{ "threshold": 0.5, "strength": 1.0 }'),
      effectIndex: z.number().optional().describe('Effect inside an EffectPass (postprocessing library)'),
      effectParams: z.record(z.string(), paramValue).optional().describe('{ "intensity": 2.0 }') });
}
