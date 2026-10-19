/**
 * Test: LAZY mode defers proxy/listen/browser until the first tool call.
 * Runs browser-free (BROWSER=none) so it works without a Three.js app.
 */
import { ok } from './test-runner.mjs';
import { createTestClient } from './mcp-client.mjs';
import path from 'node:path';

export async function testLazyMode(serverDir = path.resolve(import.meta.dirname, '..')) {
  const client = createTestClient(serverDir, { LAZY: 'true', BROWSER: 'none' });
  try {
    await client.initialize();

    const t0 = Date.now();
    const tools = await client.listTools();
    ok('lazy: fast tool catalog without bridge', tools.result?.tools?.length > 0 && Date.now() - t0 < 2000, `${tools.result.tools.length} tools`);
    ok('lazy: cold (no proxy started)', !client.log.getStderr().includes('Proxy:'));

    // Passive config tools must not boot the bridge
    await client.callTool('set_dev_port', { port: 4321 });
    ok('lazy: set_dev_port works while cold', !client.log.getStderr().includes('[threejs-devtools-mcp] Proxy:'));

    const status = await client.callTool('bridge_status', {});
    const statusText = status.result?.content?.[0]?.text || '';
    ok('lazy: bridge_status reports deferred proxy', statusText.includes('not started'), statusText.split('\n')[1]);

    // First bridge tool → boots server + browser launch logic
    await client.callTool('scene_tree', {});
    // scene_tree will time out waiting for a bridge client (no browser), but the
    // proxy must have started while it waited:
    await new Promise(r => setTimeout(r, 1500));
    const after = client.log.getStderr();
    ok('lazy: proxy started on first bridge tool call', after.includes('[threejs-devtools-mcp] Proxy:'), after.includes('Proxy:') ? '' : 'no Proxy line');
  } finally {
    client.kill();
  }
}
