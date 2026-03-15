/**
 * Test: set_dev_port tool.
 */
import { ok } from './test-runner.mjs';

export async function testSetDevPort(client) {
  const resp = await client.callTool('set_dev_port', { port: 4000 });
  const text = resp.result?.content?.[0]?.text || '';
  ok('set_dev_port', text.includes('4000'), text.split('\n')[0]);

  // Reset back
  await client.callTool('set_dev_port', { port: 3000 });
}
