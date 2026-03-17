/**
 * Test: add/remove debug helpers.
 */
import { ok, skip, toolOk } from './test-runner.mjs';

function isThreeNotAvailable(resp) {
  const text = resp.result?.content?.[0]?.text || '';
  return resp.result?.isError && text.includes('not available');
}

export async function testAddHelper(client) {
  // Use find_objects to reliably find a named object
  const findResp = await client.callTool('find_objects', { type: 'Mesh', limit: 5 });
  const findData = toolOk('find_objects (for helpers)', findResp);
  const objects = findData?.objects || findData;
  const named = Array.isArray(objects) ? objects.find(o => o.name && o.name.length > 0) : null;

  if (!named) {
    skip('add_helper', 'no named objects found');
    return;
  }

  // Add BoxHelper
  const addResp = await client.callTool('add_helper', {
    target: named.name,
    type: 'box',
  });
  if (isThreeNotAvailable(addResp)) {
    skip('add_helper (box)', 'window.THREE not exposed — add: import * as THREE from "three"; window.THREE = THREE;');
    // Also skip axes since same issue
    skip('add_helper (axes)', 'window.THREE not exposed');
    return;
  }
  const addResult = toolOk('add_helper (box)', addResp);
  if (addResult) {
    ok('helper added', addResult.success === true);
    ok('helper has id', typeof addResult.helperId === 'string', addResult.helperId);

    // Remove helper
    const removeResp = await client.callTool('remove_helper', {
      helperId: addResult.helperId,
    });
    const removeResult = toolOk('remove_helper', removeResp);
    if (removeResult) {
      ok('helper removed', removeResult.success === true);
    }
  }

  // Add AxesHelper
  const axesResp = await client.callTool('add_helper', {
    target: named.name,
    type: 'axes',
    size: 2,
  });
  if (isThreeNotAvailable(axesResp)) {
    skip('add_helper (axes)', 'window.THREE not exposed');
    return;
  }
  const axesResult = toolOk('add_helper (axes)', axesResp);
  if (axesResult) {
    ok('axes helper added', axesResult.success === true);
    // Clean up
    await client.callTool('remove_helper', { helperId: axesResult.helperId });
    ok('axes helper removed', true);
  }
}
