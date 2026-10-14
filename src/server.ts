import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeServer } from './bridge/server.js';
import { registerTools } from './server/tools/index.js';
import { registerPrompts } from './server/prompts.js';
import { SERVER_INSTRUCTIONS } from './server/instructions.js';

/** Injected from package.json at build time (tsup `define`) */
declare const __PACKAGE_VERSION__: string;

export function createMcpServer(bridge: BridgeServer): McpServer {
  const server = new McpServer(
    { name: 'threejs-devtools-mcp', version: __PACKAGE_VERSION__ },
    { instructions: SERVER_INSTRUCTIONS },
  );

  registerTools({ server, bridge });
  registerPrompts(server);

  return server;
}
