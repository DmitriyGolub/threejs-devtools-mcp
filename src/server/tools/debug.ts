/** Temporary visual aids — never part of the user's code */
import { z } from 'zod';
import { bridgeTool, type ToolContext } from '../tool-helper.js';
import { byName, vec3 } from './schemas.js';

const HELPER_TYPES = [
  'box', 'axes', 'skeleton', 'arrow', 'grid', 'polar_grid', 'camera',
  'directional_light', 'spot_light', 'point_light', 'hemisphere_light', 'plane',
] as const;

export function registerDebugTools(ctx: ToolContext): void {
  bridgeTool(ctx, 'toggle_overlay', 'debug',
    'In-browser inspector panel: live FPS, draw calls, scene tree, materials, lights. Clicking a tree item highlights it.',
    { enabled: z.boolean().optional().describe('true=show, false=hide, omit=toggle') });

  bridgeTool(ctx, 'overlay_selected', 'inspect',
    'Everything about the object the user selected in the overlay: materials, geometry, transforms, textures, uniforms, shadows.');

  bridgeTool(ctx, 'highlight_object', 'debug',
    'Highlight an object with wireframe, or toggle its visibility, to point it out.',
    { ...byName('Object'),
      mode: z.enum(['wireframe', 'visibility']).optional().describe('Default: wireframe'),
      enabled: z.boolean().optional().describe('Default: true') });

  bridgeTool(ctx, 'toggle_wireframe', 'debug',
    'Wireframe on all materials or one object.',
    { ...byName('Object (omit for whole scene)'),
      enabled: z.boolean().optional().describe('true=on, false=restore, omit=toggle') });

  bridgeTool(ctx, 'bounding_boxes', 'debug',
    'Show/hide bounding boxes — debug frustum culling and object bounds.',
    { ...byName('Target object (omit for all meshes)'),
      enabled: z.boolean().optional().describe('true=show (default), false=remove all'),
      clear: z.boolean().optional().describe('Remove all boxes'),
      color: z.number().optional().describe('Hex number (default: 0x00ff00)'),
      recursive: z.boolean().optional().describe('Include children of target'),
      onlyVisible: z.boolean().optional().describe('Only visible objects (default: true)'),
      limit: z.number().optional().describe('Max boxes (default: 50)') });

  bridgeTool(ctx, 'add_helper', 'debug',
    'Add a debug helper to an object: box, axes, skeleton, arrow, grid, camera frustum, light helpers, plane.',
    { target: z.string().optional().describe('Target object name'),
      targetUuid: z.string().optional().describe('Target object UUID'),
      type: z.enum(HELPER_TYPES).optional().describe('Default: box'),
      size: z.number().optional().describe('Axes/Grid/light helper size (default: 1)'),
      color: z.number().optional().describe('Hex number (default: 0x00ff00)'),
      direction: vec3('[x, y, z] for ArrowHelper/PlaneHelper'),
      origin: vec3('[x, y, z] origin for ArrowHelper'),
      length: z.number().optional().describe('ArrowHelper length (default: 1)'),
      divisions: z.number().optional().describe('GridHelper divisions (default: 10)') });

  bridgeTool(ctx, 'remove_helper', 'debug',
    'Remove a helper added with add_helper.',
    { helperId: z.string().describe('ID returned by add_helper') });

  bridgeTool(ctx, 'run_js', 'debug',
    'Run JavaScript in the page with scene, renderer, camera, gl in scope; `return` a value to get it back. '
    + 'Changes made here are NOT recorded in pending_changes — prefer the set_* tools for anything the user may want to keep.',
    { code: z.string().describe('JavaScript body. Vars: scene, renderer, camera, gl') },
    { annotations: { destructiveHint: true, openWorldHint: true } });
}
