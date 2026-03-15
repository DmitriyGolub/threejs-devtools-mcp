/**
 * Test: screenshot capture.
 */
import { ok } from './test-runner.mjs';

export async function testScreenshot(client) {
  const resp = await client.callTool('take_screenshot');

  if (resp.result?.isError) {
    ok('take_screenshot', false, resp.result.content?.[0]?.text?.substring(0, 100));
    return;
  }

  const img = resp.result?.content?.find(c => c.type === 'image');
  const txt = resp.result?.content?.find(c => c.type === 'text');

  ok('screenshot has image', !!img?.data, `${img?.data?.length || 0} bytes`);
  ok('screenshot has dimensions', !!txt?.text, txt?.text);
}
