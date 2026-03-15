/**
 * Test: geometry inspection.
 */
import { ok, toolOk } from './test-runner.mjs';

export async function testGeometryDetails(client) {
  // Find a mesh to inspect
  const treeResp = await client.callTool('scene_tree', { depth: 2, types: ['Mesh'] });
  const tree = toolOk('scene_tree (for geometry)', treeResp);
  if (!tree) return;

  // Find first mesh with a name or uuid
  let meshId = null;
  function findMesh(node) {
    if (node.type === 'Mesh') { meshId = node.uuid; return; }
    if (node.children) for (const c of node.children) { if (!meshId) findMesh(c); }
  }
  findMesh(tree);

  if (!meshId) {
    ok('geometry_details: found mesh', false, 'no Mesh in scene');
    return;
  }

  const resp = await client.callTool('geometry_details', { uuid: meshId });
  const data = toolOk('geometry_details', resp);
  if (!data) return;

  ok('has type', typeof data.type === 'string', data.type);
  ok('has vertexCount', typeof data.vertexCount === 'number' && data.vertexCount > 0, `${data.vertexCount}`);
  ok('has attributes', typeof data.attributes === 'object');
  ok('has position attr', data.attributes?.position !== undefined);
  ok('has boundingBox', data.boundingBox !== undefined || data.boundingSphere !== undefined);

  if (data.attributes?.position) {
    const pos = data.attributes.position;
    ok('position itemSize', pos.itemSize === 3, `itemSize=${pos.itemSize}`);
    ok('position count', pos.count > 0, `count=${pos.count}`);
  }

  if (data.index !== undefined) {
    ok('has index', typeof data.index === 'object');
  }
}
