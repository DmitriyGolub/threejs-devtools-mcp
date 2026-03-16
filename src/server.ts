import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeServer } from './bridge/server.js';
import { registerTools } from './server/tools.js';

export function createMcpServer(bridge: BridgeServer): McpServer {
  const server = new McpServer({
    name: 'threejs-devtools-mcp',
    version: '0.1.2',
  });

  registerTools(server, bridge);

  return server;
}
