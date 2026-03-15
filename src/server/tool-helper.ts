import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { BridgeServer } from '../bridge/server.js';

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

  server.registerTool(name, {
    description,
    ...(hasParams ? { inputSchema: schema } : {}),
  }, async (params) => {
    try {
      const result = await bridge.request(name, (params ?? {}) as Record<string, unknown>, timeoutMs);
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
