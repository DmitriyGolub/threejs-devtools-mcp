/**
 * Test: texture_preview tool.
 */
import { ok, skip, toolOk } from './test-runner.mjs';

export async function testTexturePreview(client) {
  // First get a texture to preview
  const listResp = await client.callTool('texture_list');
  const textures = toolOk('texture_list (for preview)', listResp);
  if (!textures || !Array.isArray(textures) || textures.length === 0) {
    skip('texture_preview', 'no textures in scene');
    return;
  }

  const tex = textures[0];
  ok('found texture for preview', true, `${tex.name || tex.uuid}`);

  // Preview by UUID
  const resp = await client.callTool('texture_preview', { uuid: tex.uuid, maxSize: 256 });

  // texture_preview returns image content — check response structure
  const content = resp.result?.content;
  if (!content || resp.result?.isError) {
    const errText = content?.[0]?.text || 'unknown error';
    // Some textures may not be previewable (compressed, etc.)
    if (errText.includes('Unsupported') || errText.includes('no image') || errText.includes('compressed')) {
      skip('texture_preview', errText.slice(0, 80));
      return;
    }
    ok('texture_preview', false, errText.slice(0, 100));
    return;
  }

  // Should have image content + text content
  const imageContent = content.find(c => c.type === 'image');
  const textContent = content.find(c => c.type === 'text');

  ok('has image content', !!imageContent);
  ok('has image data', imageContent?.data?.length > 100, `${imageContent?.data?.length} bytes`);
  ok('has text info', !!textContent?.text);
  ok('text has dimensions', textContent?.text?.includes('x'), textContent?.text?.slice(0, 80));
}
