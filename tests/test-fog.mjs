/**
 * Test: fog inspection and mutation.
 */
import { ok, toolOk } from './test-runner.mjs';

export async function testFogDetails(client) {
  const resp = await client.callTool('fog_details');
  const data = toolOk('fog_details', resp);
  if (!data) return;

  if (data.type === 'none') {
    ok('no fog in scene', true, 'scene has no fog');
    return;
  }

  ok('has type', data.type === 'Fog' || data.type === 'FogExp2', data.type);
  ok('has color', typeof data.color === 'string' && data.color.startsWith('#'), data.color);

  if (data.type === 'Fog') {
    ok('has near', typeof data.near === 'number', `${data.near}`);
    ok('has far', typeof data.far === 'number', `${data.far}`);
  } else if (data.type === 'FogExp2') {
    ok('has density', typeof data.density === 'number', `${data.density}`);
  }

  // Background color
  if (data.background) {
    ok('has background', typeof data.background === 'string', data.background);
  }
}

export async function testSetFog(client) {
  // Get original state
  const origResp = await client.callTool('fog_details');
  const orig = toolOk('fog_details (before set)', origResp);
  if (!orig || orig.type === 'none') {
    ok('set_fog: has fog', false, 'no fog to modify');
    return;
  }

  // Change color
  const colorResp = await client.callTool('set_fog', { color: '#ff8800' });
  const colorResult = toolOk('set_fog (color)', colorResp);
  if (colorResult) {
    ok('fog color set', colorResult.success === true);
    ok('fog color value', colorResult.color === '#ff8800', colorResult.color);
  }

  // Restore color
  await client.callTool('set_fog', { color: orig.color });

  // Change near/far for Fog type
  if (orig.type === 'Fog') {
    const nfResp = await client.callTool('set_fog', { near: 5, far: 100 });
    const nfResult = toolOk('set_fog (near/far)', nfResp);
    if (nfResult) {
      ok('fog near set', nfResult.near === 5, `${nfResult.near}`);
      ok('fog far set', nfResult.far === 100, `${nfResult.far}`);
    }
    await client.callTool('set_fog', { near: orig.near, far: orig.far });
    ok('fog near/far restored', true);
  }
}
