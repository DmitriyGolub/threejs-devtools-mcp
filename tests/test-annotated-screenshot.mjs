/**
 * Test: annotated screenshot capture.
 */
import { ok } from './test-runner.mjs';

export async function testAnnotatedScreenshot(client) {
  const resp = await client.callTool('annotated_screenshot');

  if (resp.result?.isError) {
    ok('annotated_screenshot', false, resp.result.content?.[0]?.text?.substring(0, 100));
    return;
  }

  const img = resp.result?.content?.find(c => c.type === 'image');
  const txt = resp.result?.content?.find(c => c.type === 'text');

  ok('annotated has image', !!img?.data, `${img?.data?.length || 0} bytes`);
  ok('annotated has label count', !!txt?.text && txt.text.includes('labels'), txt?.text);

  // Image should be larger than plain screenshot (has labels drawn on it)
  ok('annotated image has data', (img?.data?.length || 0) > 100);
}
