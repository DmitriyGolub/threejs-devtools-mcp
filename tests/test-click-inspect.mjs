/**
 * Test: click_inspect tool — we can't simulate a real user click in headless tests,
 * so we test the timeout behavior (tool should return timeout error after N seconds).
 */
import { ok } from './test-runner.mjs';

export async function testClickInspect(client) {
  // Call with a very short timeout — should timeout since no one clicks
  const resp = await client.callTool('click_inspect', { timeout: 2 });
  const text = resp.result?.content?.[0]?.text || '';
  const isError = resp.result?.isError;

  // Expected: timeout error (no click happened)
  ok('click_inspect timeout works', isError === true && text.includes('timeout'),
    'correctly times out when no click');
}
