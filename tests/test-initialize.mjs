/**
 * Test: MCP server initializes correctly.
 */
import { ok } from './test-runner.mjs';

export async function testInitialize(client) {
  const resp = await client.initialize();
  const name = resp.result?.serverInfo?.name;
  ok('initialize', !!name, name);
  ok('has tools capability', !!resp.result?.capabilities?.tools);
}
