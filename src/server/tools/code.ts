/** Bridge from live preview to source code */
import { z } from 'zod';
import { textResult, tool, type ToolContext } from '../tool-helper.js';
import { formatChanges, type Change } from '../code-snippets.js';
import { gltfToR3f } from '../gltf-to-r3f.js';

export function registerCodeTools(ctx: ToolContext): void {
  const { bridge } = ctx;

  tool(ctx, 'pending_changes', 'code',
    'Everything changed with live-preview tools since the last clear: before → after per property, plus ready-to-paste '
    + 'code (vanilla Three.js and/or React Three Fiber) and where to find each target. Use it to persist a preview into source; '
    + 'call again with clear=true once the code is updated.',
    { style: z.enum(['vanilla', 'r3f', 'both']).optional().describe('Code flavour (default: both)'),
      clear: z.boolean().optional().describe('Forget the listed changes (after writing them to code)') },
    async ({ style = 'both', clear }) => {
      const r = await bridge.request('pending_changes', { clear }) as { changes: Change[] };
      const text = formatChanges(r.changes, style);
      if (bridge.isRemote && r.changes.length > 0) {
        return textResult(`${text}\n\nREMOTE MODE: no local project — share these edits with whoever owns the code.`);
      }
      return textResult(clear && r.changes.length > 0 ? `${text}\n\nCleared.` : text);
    });

  tool(ctx, 'revert_changes', 'preview',
    'Undo live-preview changes in the browser (all, or selected ids from pending_changes), newest first.',
    { ids: z.array(z.number()).optional().describe('Change ids to revert (default: all)') },
    async ({ ids }) => {
      const r = await bridge.request('revert_changes', { ids }) as {
        reverted: number; failed: { id: number; error: string }[]; remaining: number;
      };
      const lines = [`Reverted ${r.reverted} change(s). ${r.remaining} still pending.`];
      for (const f of r.failed) lines.push(`  #${f.id} failed: ${f.error}`);
      return textResult(lines.join('\n'));
    });

  tool(ctx, 'gltf_to_r3f', 'code',
    'Convert a GLB/glTF file into a React Three Fiber component (like gltfjsx).',
    { filePath: z.string().describe('Absolute or relative path to the .glb/.gltf file'),
      typescript: z.boolean().optional().describe('Generate TypeScript (default: true)'),
      preload: z.boolean().optional().describe('Add useGLTF.preload() (default: true)') },
    async (params) => {
      const { component, info } = await gltfToR3f(params);
      return textResult([
        `// ${info.componentName}.tsx`,
        `// Nodes: ${info.nodes}, Meshes: ${info.meshes}, Materials: ${info.materials}, Animations: ${info.animations}`,
        `// Material names: ${info.materialNames.join(', ') || 'none'}`,
        `// Animation names: ${info.animationNames.join(', ') || 'none'}`,
        '',
        component,
      ].join('\n'));
    });
}
