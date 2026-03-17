/**
 * Test: scene_export tool.
 */
import { ok, skip } from './test-runner.mjs';

export async function testSceneExport(client) {
  const resp = await client.callTool('scene_export', { binary: true });
  const content = resp.result?.content;
  const text = content?.[0]?.text || '';
  const isError = resp.result?.isError;

  if (isError && text.includes('GLTFExporter not available')) {
    skip('scene_export', 'GLTFExporter not exposed — add: window.GLTFExporter = GLTFExporter');
    return;
  }

  if (isError) {
    ok('scene_export', false, text.slice(0, 100));
    return;
  }

  ok('exported successfully', text.includes('Exported') || text.includes('.glb'), text.slice(0, 100));
}
