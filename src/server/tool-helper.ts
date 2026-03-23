import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { BridgeServer } from '../bridge/server.js';

/**
 * Tools that modify the scene at runtime.
 * set_* tools need code changes too; debug tools are runtime-only.
 */
const RUNTIME_PREVIEW_TOOLS = new Set([
  'set_material_property', 'set_uniform', 'set_object_transform',
  'set_light', 'set_fog', 'set_renderer', 'set_camera',
  'set_texture', 'set_shadow', 'set_morph_target',
  'set_instanced_mesh', 'set_layers', 'set_animation',
]);

const DEBUG_ONLY_TOOLS = new Set([
  'highlight_object', 'run_js', 'toggle_wireframe',
  'bounding_boxes', 'add_helper', 'remove_helper',
  'toggle_overlay',
]);

function getScope(toolName: string, isRemote: boolean): string | null {
  if (RUNTIME_PREVIEW_TOOLS.has(toolName)) {
    if (isRemote) {
      return 'REMOTE MODE: Visual/runtime changes only — no source code access. Changes are lost on page reload.';
    }
    return 'Runtime preview — lost on page reload. You MUST ask the user first: runtime preview only, or also update source code?';
  }
  if (DEBUG_ONLY_TOOLS.has(toolName)) {
    return 'Debug only — page reload will reset. No code changes needed.';
  }
  return null;
}

function getAnnotations(toolName: string): ToolAnnotations {
  if (RUNTIME_PREVIEW_TOOLS.has(toolName)) {
    return { destructiveHint: true, readOnlyHint: false, idempotentHint: true, openWorldHint: false };
  }
  if (DEBUG_ONLY_TOOLS.has(toolName)) {
    return toolName === 'run_js'
      ? { destructiveHint: true, readOnlyHint: false, idempotentHint: false, openWorldHint: true }
      : { destructiveHint: false, readOnlyHint: false, idempotentHint: true, openWorldHint: false };
  }
  // Read-only inspection tools
  return { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
}

/** Register a tool that proxies a request to the browser bridge */
export function bridgeTool(
  server: McpServer,
  bridge: BridgeServer,
  name: string,
  description: string,
  schema: Record<string, z.ZodType>,
  timeoutMs?: number,
): void {
  const hasParams = Object.keys(schema).length > 0;
  // Use non-remote scope for static description (tool listing)
  const staticScope = getScope(name, false);

  // Prepend scope tag to description so AI clients see it
  const taggedDescription = staticScope
    ? `${description}\n\n${staticScope}`
    : description;

  server.registerTool(name, {
    description: taggedDescription,
    annotations: getAnnotations(name),
    ...(hasParams ? { inputSchema: schema } : {}),
  }, async (params) => {
    try {
      const result = await bridge.request(name, (params ?? {}) as Record<string, unknown>, timeoutMs);

      const text = JSON.stringify(result, null, 2);

      // Compute scope at call time so remote status is current
      const scope = getScope(name, bridge.isRemote);

      // Append scope note to response for mutation/debug tools
      if (scope) {
        return {
          content: [
            { type: 'text' as const, text },
            { type: 'text' as const, text: `\n_note: ${scope}` },
          ],
        };
      }

      return {
        content: [{ type: 'text' as const, text }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  });
}
