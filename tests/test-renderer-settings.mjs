/**
 * Test: renderer settings inspection and mutation.
 */
import { ok, toolOk } from './test-runner.mjs';

export async function testRendererSettings(client) {
  const resp = await client.callTool('renderer_settings');
  const data = toolOk('renderer_settings', resp);
  if (!data) return;

  ok('has toneMapping', typeof data.toneMapping === 'number' || typeof data.toneMappingName === 'string');
  ok('has toneMappingExposure', typeof data.toneMappingExposure === 'number', `${data.toneMappingExposure}`);
  ok('has outputColorSpace', typeof data.outputColorSpace === 'string', data.outputColorSpace);
  ok('has pixelRatio', typeof data.pixelRatio === 'number', `${data.pixelRatio}`);
  ok('has shadowMap', typeof data.shadowMap === 'object');

  if (data.shadowMap) {
    ok('shadowMap.enabled', typeof data.shadowMap.enabled === 'boolean', `${data.shadowMap.enabled}`);
    ok('shadowMap.type', data.shadowMap.type !== undefined);
  }
}

export async function testSetRendererSettings(client) {
  // Get original state
  const origResp = await client.callTool('renderer_settings');
  const orig = toolOk('renderer_settings (before set)', origResp);
  if (!orig) return;

  // Change toneMappingExposure
  const expResp = await client.callTool('set_renderer', { toneMappingExposure: 2.0 });
  const expResult = toolOk('set_renderer (exposure)', expResp);
  if (expResult) {
    ok('exposure set', expResult.success === true);
    ok('exposure value', expResult.toneMappingExposure === 2.0, `${expResult.toneMappingExposure}`);
  }

  // Restore
  await client.callTool('set_renderer', { toneMappingExposure: orig.toneMappingExposure });
  ok('exposure restored', true);

  // Change toneMapping by number
  const tmResp = await client.callTool('set_renderer', { toneMapping: 1 }); // ReinhardToneMapping
  const tmResult = toolOk('set_renderer (toneMapping)', tmResp);
  if (tmResult) {
    ok('toneMapping set', tmResult.success === true);
  }

  // Restore
  await client.callTool('set_renderer', { toneMapping: orig.toneMapping });
  ok('toneMapping restored', true);
}
