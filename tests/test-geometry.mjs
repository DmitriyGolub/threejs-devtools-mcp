/**
 * Test: geometry inspection.
 */
import { ok, skip, toolOk } from './test-runner.mjs';

export async function testGeometryDetails(client) {
  // Use find_objects to reliably find a mesh
  const findResp = await client.callTool('find_objects', { type: 'Mesh', limit: 1 });
  const findData = toolOk('find_objects (for geometry)', findResp);
  const objects = findData?.objects || findData;
  const mesh = Array.isArray(objects) && objects.length > 0 ? objects[0] : null;

  if (!mesh) {
    skip('geometry_details', 'no Mesh found in scene');
    return;
  }

  const resp = await client.callTool('geometry_details', { uuid: mesh.uuid });
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
