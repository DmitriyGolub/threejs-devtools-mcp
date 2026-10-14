/** Geometry, instancing, morph targets, skeletons, animation */
import { z } from 'zod';
import { bridgeTool, type ToolContext } from '../tool-helper.js';
import { byName } from './schemas.js';

export function registerGeometryTools(ctx: ToolContext): void {
  bridgeTool(ctx, 'geometry_details', 'inspect',
    'Geometry of a mesh: vertices, attributes, index, bounding box, morph attributes.',
    byName('Mesh'));

  bridgeTool(ctx, 'instanced_mesh_details', 'inspect',
    'InstancedMesh: count, capacity, sample transforms, instance colors and custom attributes.',
    { ...byName('InstancedMesh'),
      sampleCount: z.number().optional().describe('Instances to sample (default: 5, max: 20)'),
      startIndex: z.number().optional().describe('First sampled index (default: 0)') });

  bridgeTool(ctx, 'batched_mesh_details', 'inspect',
    'BatchedMesh: geometry counts, draw ranges, instance visibility. Lists all if no name/uuid.',
    byName('BatchedMesh'));

  bridgeTool(ctx, 'morph_targets', 'inspect',
    'Meshes with morph targets: target names and current influences.');

  bridgeTool(ctx, 'skeleton_details', 'inspect',
    'Skeletons and bones of SkinnedMesh objects.');

  bridgeTool(ctx, 'animation_details', 'inspect',
    'AnimationMixers with their actions, clips, weights and playback state.');

  bridgeTool(ctx, 'set_instanced_mesh', 'preview',
    'Change InstancedMesh count, visibility, frustumCulled.',
    { ...byName('InstancedMesh'),
      count: z.number().optional().describe('Visible instances'),
      visible: z.boolean().optional(),
      frustumCulled: z.boolean().optional() });

  bridgeTool(ctx, 'set_morph_target', 'preview',
    'Set a morph target influence.',
    { ...byName('Mesh'),
      index: z.number().optional().describe('Morph target index'),
      targetName: z.string().optional().describe('Morph target name (from morphTargetDictionary)'),
      influence: z.number().describe('0-1') });

  bridgeTool(ctx, 'set_animation', 'preview',
    'Control playback: mixer timeScale/time, action play/stop/pause/weight by clip name.',
    { mixerIndex: z.number().optional().describe('From animation_details (default: 0)'),
      timeScale: z.number().optional().describe('Mixer time scale'),
      time: z.number().optional().describe('Seek mixer time (not recorded as a change)'),
      clipName: z.string().optional().describe('Target action by clip name'),
      actionWeight: z.number().optional().describe('0-1'),
      actionTimeScale: z.number().optional(),
      actionPaused: z.boolean().optional(),
      play: z.boolean().optional(),
      stop: z.boolean().optional() });
}
