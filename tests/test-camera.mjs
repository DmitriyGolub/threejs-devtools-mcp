/**
 * Test: camera inspection and mutation.
 */
import { ok, toolOk } from './test-runner.mjs';

export async function testCameraDetails(client) {
  const resp = await client.callTool('camera_details');
  const data = toolOk('camera_details', resp);
  if (!data) return;

  ok('has type', typeof data.type === 'string', data.type);
  ok('has position', Array.isArray(data.position) && data.position.length === 3,
    JSON.stringify(data.position));
  ok('has rotation', Array.isArray(data.rotation) && data.rotation.length === 3);

  // PerspectiveCamera specifics
  if (data.type === 'PerspectiveCamera') {
    ok('has fov', typeof data.fov === 'number', `${data.fov}`);
    ok('has near', typeof data.near === 'number', `${data.near}`);
    ok('has far', typeof data.far === 'number', `${data.far}`);
    ok('has aspect', typeof data.aspect === 'number', `${data.aspect}`);
  }
}

export async function testSetCamera(client) {
  // Get original camera state
  const origResp = await client.callTool('camera_details');
  const orig = toolOk('camera_details (before set)', origResp);
  if (!orig) return;

  // Change FOV
  if (orig.type === 'PerspectiveCamera') {
    const resp = await client.callTool('set_camera', { fov: 90 });
    const result = toolOk('set_camera (fov=90)', resp);
    if (result) {
      ok('fov set', result.success === true);
      ok('fov value', result.fov === 90, `${result.fov}`);
    }

    // Restore FOV
    await client.callTool('set_camera', { fov: orig.fov });
    ok('fov restored', true);
  }

  // Change near/far
  const nearFarResp = await client.callTool('set_camera', { near: 0.5, far: 500 });
  const nfResult = toolOk('set_camera (near/far)', nearFarResp);
  if (nfResult) {
    ok('near set', nfResult.near === 0.5, `${nfResult.near}`);
    ok('far set', nfResult.far === 500, `${nfResult.far}`);
  }

  // Restore
  await client.callTool('set_camera', { near: orig.near, far: orig.far });

  // Change position
  const posResp = await client.callTool('set_camera', { position: [5, 10, 15] });
  const posResult = toolOk('set_camera (position)', posResp);
  if (posResult) {
    ok('position set', JSON.stringify(posResult.position) === '[5,10,15]',
      JSON.stringify(posResult.position));
  }

  // Restore position
  await client.callTool('set_camera', { position: orig.position });
  ok('position restored', true);
}
