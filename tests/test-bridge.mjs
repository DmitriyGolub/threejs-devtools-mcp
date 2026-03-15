/**
 * Test: bridge connection and status tool.
 */
import { ok } from './test-runner.mjs';

export async function testBridgeStatus(client) {
  const resp = await client.callTool('bridge_status');
  const text = resp.result?.content?.[0]?.text || '';
  const connected = text.includes('connected') && !text.includes('NOT connected');
  ok('bridge_status', connected, connected ? 'connected' : text.substring(0, 100));
  return connected;
}
