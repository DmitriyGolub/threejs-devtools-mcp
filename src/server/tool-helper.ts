import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
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
]);

function getScope(toolName: string): string | null {
  if (RUNTIME_PREVIEW_TOOLS.has(toolName)) {
    return 'Runtime preview — lost on page reload. You MUST ask the user first: runtime preview only, or also update source code?';
  }
  if (DEBUG_ONLY_TOOLS.has(toolName)) {
    return 'Debug only — page reload will reset. No code changes needed.';
  }
  return null;
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
  const scope = getScope(name);

  // Prepend scope tag to description so AI clients see it
  const taggedDescription = scope
    ? `${description}\n\n${scope}`
    : description;

  server.registerTool(name, {
    description: taggedDescription,
    ...(hasParams ? { inputSchema: schema } : {}),
  }, async (params) => {
    try {
      const result = await bridge.request(name, (params ?? {}) as Record<string, unknown>, timeoutMs);

      // Append scope note to response for mutation/debug tools
      if (scope) {
        const data = typeof result === 'object' && result !== null
          ? { ...result as Record<string, unknown>, _note: scope }
          : result;
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  });
}
