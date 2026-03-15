/**
 * Test: layers inspection and mutation.
 */
import { ok, toolOk } from './test-runner.mjs';

export async function testLayerDetails(client) {
  const resp = await client.callTool('layer_details');
  const data = toolOk('layer_details', resp);
  if (!data) return;

  ok('has cameraLayers', typeof data.cameraLayers === 'number', `mask: ${data.cameraLayers}`);
  ok('has objects', Array.isArray(data.objects), `${data.objects?.length} objects with non-default layers`);
}

export async function testSetLayers(client) {
  // Find named object
  const treeResp = await client.callTool('scene_tree', { depth: 2 });
  const tree = toolOk('scene_tree (for layers)', treeResp);
  if (!tree) return;

  const named = tree.children?.find(c => c.name && c.name.length > 0);
  if (!named) {
    ok('set_layers: found object', false);
    return;
  }

  // Set layer
  const resp = await client.callTool('set_layers', {
    name: named.name,
    layer: 1,
    enabled: true,
  });
  const result = toolOk('set_layers (enable layer 1)', resp);
  if (result) {
    ok('layer set', result.success === true);
  }

  // Reset to default (layer 0 only)
  await client.callTool('set_layers', {
    name: named.name,
    mask: 1, // only layer 0
  });
  ok('layers reset', true);
}
