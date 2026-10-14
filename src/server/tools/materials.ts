/** Materials, shaders, textures */
import { z } from 'zod';
import { bridgeTool, imageResult, tool, type ToolContext } from '../tool-helper.js';
import { byName, paramValue, scalar, vec2 } from './schemas.js';

export function registerMaterialTools(ctx: ToolContext): void {
  bridgeTool(ctx, 'material_list', 'inspect',
    'All materials in the scene with type, color, transparency.');

  bridgeTool(ctx, 'material_details', 'inspect',
    'Full material properties: colors, PBR/physical params, maps, uniforms, defines, NodeMaterial (TSL) slots.',
    byName('Material'));

  bridgeTool(ctx, 'shader_list', 'inspect',
    'Compiled shader programs with their materials (WebGL).');

  bridgeTool(ctx, 'shader_source', 'inspect',
    'Vertex/fragment GLSL source and uniforms of a material. NodeMaterial (TSL) has no GLSL — use material_details.',
    { materialName: z.string().optional().describe('Material name'),
      materialUuid: z.string().optional().describe('Material UUID') });

  bridgeTool(ctx, 'texture_list', 'inspect',
    'All textures: size, format, wrap, filter settings.');

  bridgeTool(ctx, 'texture_details', 'inspect',
    'Detailed info about one texture.',
    byName('Texture'));

  tool(ctx, 'texture_preview', 'inspect',
    'Show a texture as a PNG image. Use texture_list to find names/UUIDs.',
    { ...byName('Texture'),
      maxSize: z.number().optional().describe('Max dimension in px (default: 512)') },
    async (params) => {
      const r = await ctx.bridge.request('texture_preview', params, 15000) as {
        dataUrl: string; originalWidth: number; originalHeight: number; textureName: string; textureUuid: string;
      };
      const label = r.textureName || r.textureUuid;
      const safe = (r.textureName || r.textureUuid.slice(0, 8)).replace(/[^\w-]/g, '_');
      return imageResult(r.dataUrl, `texture-${safe}.png`, `Texture: ${label} (${r.originalWidth}x${r.originalHeight})`);
    });

  bridgeTool(ctx, 'set_material_property', 'preview',
    'Set a material property. Accepts the material name or the name of a mesh that uses it.',
    { name: z.string().optional().describe('Material name, or name of a mesh using it'),
      uuid: z.string().optional().describe('Material UUID'),
      property: z.string().describe('color, emissive, emissiveIntensity, roughness, metalness, opacity, transparent, wireframe, '
        + 'visible, side, depthWrite, depthTest, alphaTest, flatShading, fog, envMapIntensity; physical: clearcoat, '
        + 'clearcoatRoughness, transmission, thickness, ior, sheen, sheenColor, sheenRoughness, iridescence, anisotropy, '
        + 'dispersion, specularIntensity, specularColor, attenuationColor'),
      value: scalar.describe('Hex string for colors ("#ff0000"), number for scalars, boolean for flags') });

  bridgeTool(ctx, 'set_uniform', 'preview',
    'Set a ShaderMaterial uniform.',
    { ...byName('Material'),
      uniform: z.string().describe('Uniform name, e.g. uTime, uColor'),
      value: paramValue.describe('Hex string for Color, {x,y,z} for vectors, number/boolean for scalars') });

  bridgeTool(ctx, 'set_texture', 'preview',
    'Change texture sampling and transform: wrap, filter, anisotropy, repeat, offset, rotation, colorSpace.',
    { ...byName('Texture'),
      wrapS: z.number().optional().describe('1000=Repeat, 1001=ClampToEdge, 1002=MirroredRepeat'),
      wrapT: z.number().optional().describe('Same values as wrapS'),
      minFilter: z.number().optional().describe('1003=Nearest, 1006=Linear, 1008=LinearMipmapLinear'),
      magFilter: z.number().optional().describe('1003=Nearest, 1006=Linear'),
      anisotropy: z.number().optional().describe('1-16'),
      flipY: z.boolean().optional(),
      colorSpace: z.string().optional().describe('srgb, srgb-linear'),
      repeat: vec2('[x, y] repeat'),
      offset: vec2('[x, y] offset'),
      rotation: z.number().optional().describe('Radians') });
}
