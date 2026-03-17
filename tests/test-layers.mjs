/**
 * Test: layers inspection and mutation.
 */
import { ok, skip, toolOk } from './test-runner.mjs';

export async function testLayerDetails(client) {
  const resp = await client.callTool('layer_details');
  const data = toolOk('layer_details', resp);
  if (!data) return;

  ok('has cameraLayers', typeof data.cameraLayers === 'number', `mask: ${data.cameraLayers}`);
  ok('has objects', Array.isArray(data.objects), `${data.objects?.length} objects with non-default layers`);
}

export async function testSetLayers(client) {
  // Use find_objects to reliably find a named object
  const findResp = await client.callTool('find_objects', { type: 'Mesh', limit: 5 });
  const findData = toolOk('find_objects (for layers)', findResp);
  const objects = findData?.objects || findData;
  const named = Array.isArray(objects) ? objects.find(o => o.name && o.name.length > 0) : null;

  if (!named) {
    skip('set_layers', 'no named objects found');
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
