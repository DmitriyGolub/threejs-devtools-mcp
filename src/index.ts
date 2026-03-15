import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BridgeServer } from './bridge/server.js';
import { createMcpServer } from './server.js';
import { detectDevPort } from './detect-port.js';
import { findFreePort } from './find-port.js';
import { launchBrowser, closeBrowser, type LaunchResult } from './browser.js';

const preferredPort = Number(process.env.BRIDGE_PORT) || 9222;
const port = await findFreePort(preferredPort);

// Auto-detect dev server port if not specified
const devPort = process.env.DEV_PORT
  ? Number(process.env.DEV_PORT)
  : await detectDevPort();

let browserResult: LaunchResult | null = null;

const bridge = new BridgeServer(port, devPort);
bridge.onReady(async () => {
  const url = `http://localhost:${port}`;
  browserResult = await launchBrowser(url, {
    headless: process.env.HEADLESS === 'true',
  });
});

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
