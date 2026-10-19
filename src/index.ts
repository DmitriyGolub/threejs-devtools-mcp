import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BridgeServer } from './bridge/server.js';
import { createMcpServer } from './server.js';
import { detectDevPort } from './detect-port.js';
import { findFreePort } from './find-port.js';
import { launchBrowser, closeBrowser, type LaunchResult } from './browser.js';

// LAZY=true (or --lazy): don't start the proxy or the browser until the
// agent actually calls a tool that needs the bridge. Hosts connect MCP
// servers for every session/directory, so eager startup means idle
// sessions each grab a port and open a browser tab.
const lazy = process.env.LAZY === 'true' || process.argv.includes('--lazy');

const preferredPort = Number(process.env.BRIDGE_PORT) || 9222;
const port = await findFreePort(preferredPort);

// DEV_URL takes priority over DEV_PORT — allows remote debugging.
// In lazy mode, on-project detection is deferred to first use (sentinel 0).
const devTarget: number | string = process.env.DEV_URL
  ? process.env.DEV_URL
  : process.env.DEV_PORT
    ? Number(process.env.DEV_PORT)
    : lazy ? 0 : await detectDevPort();

let browserResult: LaunchResult | null = null;

const bridge = new BridgeServer(port, devTarget, { deferStart: lazy });
bridge.onReady(async () => {
  const url = `http://localhost:${bridge.proxyPort}`;
  browserResult = await launchBrowser(url, {
    headless: process.env.HEADLESS === 'true',
  });
});

if (lazy) {
  console.error('[threejs-devtools-mcp] LAZY mode: proxy and browser start on the first tool call');
} else {
  await bridge.ensureStarted();
}

const server = createMcpServer(bridge);

const transport = new StdioServerTransport();
await server.connect(transport);

const shutdown = async () => {
  if (browserResult) await closeBrowser(browserResult);
  bridge.close();
  process.exit(0);
};

process.on('SIGINT', () => { shutdown(); });
process.on('SIGTERM', () => { shutdown(); });
