/**
 * Test: texture mutation.
 */
import { ok, toolOk } from './test-runner.mjs';

export async function testSetTexture(client) {
  // Get textures
  const listResp = await client.callTool('texture_list');
  const textures = toolOk('texture_list (for mutation)', listResp);
  if (!textures || textures.length === 0) {
    ok('set_texture: has textures', false, 'no textures in scene');
    return;
  }

  const tex = textures[0];
  ok('found texture', true, `${tex.name || tex.uuid}`);

  // Change wrap mode
  const wrapResp = await client.callTool('set_texture', {
    uuid: tex.uuid,
    wrapS: 1000, // RepeatWrapping
    wrapT: 1000,
  });
  const wrapResult = toolOk('set_texture (wrap)', wrapResp);
  if (wrapResult) {
    ok('wrap set', wrapResult.success === true);
    ok('wrapS', wrapResult.wrapS === 1000, `${wrapResult.wrapS}`);
  }

  // Restore wrap
  await client.callTool('set_texture', {
    uuid: tex.uuid,
    wrapS: tex.wrapS,
    wrapT: tex.wrapT,
  });
  ok('wrap restored', true);

  // Change filter
  const filterResp = await client.callTool('set_texture', {
    uuid: tex.uuid,
    minFilter: 1006, // LinearFilter
  });
  const filterResult = toolOk('set_texture (filter)', filterResp);
  if (filterResult) {
    ok('filter set', filterResult.success === true);
  }

  // Restore
  await client.callTool('set_texture', {
    uuid: tex.uuid,
    minFilter: tex.minFilter,
  });
  ok('filter restored', true);
}
