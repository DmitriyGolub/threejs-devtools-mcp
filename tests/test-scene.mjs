/**
 * Test: scene inspection tools.
 */
import { ok, toolOk } from './test-runner.mjs';

export async function testSceneTree(client) {
  const resp = await client.callTool('scene_tree', { depth: 2, compact: false });
  const data = toolOk('scene_tree', resp);
  if (data) {
    ok('scene has type', data.type === 'Scene');
    ok('scene has children', data.childCount > 0, `${data.childCount} children`);
  }
}

export async function testMaterialList(client) {
  const resp = await client.callTool('material_list');
  const data = toolOk('material_list', resp);
  if (data) {
    ok('has materials', Array.isArray(data) && data.length > 0, `${data.length} materials`);
    const named = data.filter(m => m.name);
    if (named.length > 0) ok('materials have names', true, named.map(m => m.name).join(', '));
  }
}

export async function testRendererInfo(client) {
  const resp = await client.callTool('renderer_info');
  const data = toolOk('renderer_info', resp);
  if (data) {
    ok('has draw calls', data.render?.calls >= 0, `${data.render.calls} calls`);
    ok('has triangles', data.render?.triangles >= 0, `${data.render.triangles} tris`);
    ok('has programs', data.programs >= 0, `${data.programs} programs`);
  }
}

export async function testShaderList(client) {
  const resp = await client.callTool('shader_list');
  const data = toolOk('shader_list', resp);
  if (data) ok('has programs list', data.total >= 0 || data.programs?.length >= 0, `${data.total || data.programs?.length} programs`);
}

export async function testTextureList(client) {
  const resp = await client.callTool('texture_list');
  const data = toolOk('texture_list', resp);
  if (data) ok('texture_list returns array', Array.isArray(data), `${data.length} textures`);
}
