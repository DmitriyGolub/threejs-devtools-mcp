/** Scene graph: finding objects, transforms, layers */
import { z } from 'zod';
import { bridgeTool, type ToolContext } from '../tool-helper.js';
import { byName, scalar, vec3 } from './schemas.js';

export function registerSceneTools(ctx: ToolContext): void {
  bridgeTool(ctx, 'scene_tree', 'inspect',
    'Scene hierarchy. Compact text tree by default (~2KB); compact=false for full JSON with positions/geometry.',
    { depth: z.number().optional().describe('Max tree depth (default: 3)'),
      types: z.array(z.string()).optional().describe('Filter by type: Mesh, Light, Group, etc.'),
      maxChildren: z.number().optional().describe('Max children per node (default: 15 compact, 100 JSON)'),
      compact: z.boolean().optional().describe('Compact text tree (default: true)') });

  bridgeTool(ctx, 'object_details', 'inspect',
    'Detailed info about one object by name, uuid, or dot path.',
    { ...byName('Object'),
      path: z.string().optional().describe('Dot path: "Scene.MyGroup.MyMesh"') });

  bridgeTool(ctx, 'find_objects', 'inspect',
    'Search objects by type, material, visibility, name pattern, or custom property.',
    { type: z.string().optional().describe('Object type: Mesh, Group, InstancedMesh, Light, etc.'),
      material: z.string().optional().describe('Material name or type'),
      visible: z.boolean().optional().describe('Filter by visibility'),
      namePattern: z.string().optional().describe('Regex to match object names'),
      property: z.string().optional().describe('Custom property name to check'),
      value: scalar.optional().describe('Expected value of the custom property'),
      hasGeometry: z.boolean().optional().describe('Objects with/without geometry'),
      minChildren: z.number().optional().describe('Minimum number of children'),
      limit: z.number().optional().describe('Max results (default: 50, max: 200)') });

  bridgeTool(ctx, 'raycast', 'inspect',
    'Cast a ray from the camera through screen coordinates and return hit objects.',
    { x: z.number().describe('Normalized device X (-1 to 1, 0 = center)'),
      y: z.number().describe('Normalized device Y (-1 to 1, 0 = center)'),
      maxHits: z.number().optional().describe('Max hits (default: 10)') });

  bridgeTool(ctx, 'click_inspect', 'inspect',
    'Click-to-inspect: the cursor becomes a crosshair — tell the user to click an object in the 3D view. Returns that object.',
    { timeout: z.number().optional().describe('Max wait in seconds (default: 15, max: 60)') },
    { timeoutMs: 65000 });

  bridgeTool(ctx, 'scene_diff', 'inspect',
    'Compare scene state over time: first call saves a snapshot, next call lists added/removed/modified objects.',
    { action: z.enum(['snapshot', 'diff', 'auto']).optional()
      .describe('snapshot=save, diff=compare with saved, auto=snapshot if none else diff (default)') });

  bridgeTool(ctx, 'layer_details', 'inspect',
    'Camera layer mask and objects with non-default layers.');

  bridgeTool(ctx, 'set_object_transform', 'preview',
    'Set position, rotation, scale, or visibility of an object.',
    { ...byName('Object'),
      position: vec3(),
      rotation: vec3('[x, y, z] in radians'),
      scale: vec3(),
      visible: z.boolean().optional().describe('Show/hide') });

  bridgeTool(ctx, 'set_layers', 'preview',
    'Set layers on an object or the camera.',
    { ...byName('Object'),
      target: z.literal('camera').optional().describe('"camera" to target the camera'),
      layer: z.number().optional().describe('Layer 0-31 to enable/disable'),
      enabled: z.boolean().optional().describe('Enable or disable that layer'),
      mask: z.number().optional().describe('Set the bitmask directly') });
}
