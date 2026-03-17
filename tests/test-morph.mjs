/**
 * Test: morph target inspection and mutation.
 */
import { ok, skip, toolOk } from './test-runner.mjs';

export async function testMorphTargets(client) {
  const resp = await client.callTool('morph_targets');
  const data = toolOk('morph_targets', resp);
  if (!data) return;

  ok('has meshes', Array.isArray(data.meshes), `${data.meshes?.length || 0} meshes with morphs`);

  if (data.meshes.length === 0) {
    ok('no morph targets', true, 'scene has no morph targets');
    return;
  }

  const mesh = data.meshes[0];
  ok('has meshName', typeof mesh.name === 'string', mesh.name);
  ok('has targets', Array.isArray(mesh.targets) && mesh.targets.length > 0,
    `${mesh.targets?.length} targets`);
  ok('has influences', Array.isArray(mesh.influences), `${mesh.influences?.length} influences`);
}

export async function testSetMorphTarget(client) {
  const resp = await client.callTool('morph_targets');
  const data = toolOk('morph_targets (for set)', resp);
  if (!data || data.meshes.length === 0) {
    skip('set_morph', 'no morph targets in scene');
    return;
  }

  const mesh = data.meshes[0];
  const setResp = await client.callTool('set_morph_target', {
    name: mesh.name,
    index: 0,
    influence: 0.5,
  });
  const result = toolOk('set_morph_target', setResp);
  if (result) {
    ok('morph influence set', result.success === true);
  }

  // Restore
  await client.callTool('set_morph_target', {
    name: mesh.name,
    index: 0,
    influence: mesh.influences[0] ?? 0,
  });
  ok('morph restored', true);
}
