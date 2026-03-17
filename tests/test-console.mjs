/**
 * Test: console_capture tool.
 */
import { ok, toolOk } from './test-runner.mjs';

export async function testConsoleCapture(client) {
  // Clear any existing messages
  const clearResp = await client.callTool('console_capture', { clear: true });
  const clearData = toolOk('console_capture (clear)', clearResp);
  ok('cleared', clearData?.cleared === true);

  // Generate some console messages via run_js
  await client.callTool('run_js', { code: 'console.log("devtools-test-log"); return true' });
  await client.callTool('run_js', { code: 'console.warn("devtools-test-warn"); return true' });
  await client.callTool('run_js', { code: 'console.error("devtools-test-error"); return true' });

  // Read all captured messages
  const resp = await client.callTool('console_capture', {});
  const data = toolOk('console_capture (read)', resp);
  if (!data) return;

  ok('has messages', Array.isArray(data.messages), `${data.messages?.length} messages`);
  ok('has total', typeof data.total === 'number');

  // Check our test messages were captured
  const msgs = data.messages || [];
  const hasLog = msgs.some(m => m.level === 'log' && m.text.includes('devtools-test-log'));
  const hasWarn = msgs.some(m => m.level === 'warn' && m.text.includes('devtools-test-warn'));
  const hasError = msgs.some(m => m.level === 'error' && m.text.includes('devtools-test-error'));
  ok('captured log', hasLog);
  ok('captured warn', hasWarn);
  ok('captured error', hasError);

  // Test level filter
  const warnResp = await client.callTool('console_capture', { level: 'warn' });
  const warnData = toolOk('console_capture (warn only)', warnResp);
  if (warnData) {
    const allWarn = warnData.messages.every(m => m.level === 'warn');
    ok('filter by level', allWarn, `${warnData.messages.length} warn messages`);
  }

  // Test limit
  const limitResp = await client.callTool('console_capture', { limit: 2 });
  const limitData = toolOk('console_capture (limit=2)', limitResp);
  if (limitData) {
    ok('limit respected', limitData.messages.length <= 2, `${limitData.messages.length} messages`);
  }
}
