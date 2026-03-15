/**
 * Test: add/remove debug helpers.
 */
import { ok, toolOk } from './test-runner.mjs';

export async function testAddHelper(client) {
  // Find a named object
  const treeResp = await client.callTool('scene_tree', { depth: 2 });
  const tree = toolOk('scene_tree (for helpers)', treeResp);
  if (!tree) return;

  const named = tree.children?.find(c => c.name && c.name.length > 0);
  if (!named) {
    ok('add_helper: found object', false, 'no named objects');
    return;
  }

  // Add BoxHelper
  const addResp = await client.callTool('add_helper', {
    target: named.name,
    type: 'box',
  });
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
  const axesResult = toolOk('add_helper (axes)', axesResp);
  if (axesResult) {
    ok('axes helper added', axesResult.success === true);
    // Clean up
    await client.callTool('remove_helper', { helperId: axesResult.helperId });
    ok('axes helper removed', true);
  }
}
