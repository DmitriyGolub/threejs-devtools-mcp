/**
 * Test: new v0.4.2 tools (batched_mesh_details, clipping_details,
 * set_clipping, draw_call_breakdown, set_postprocessing).
 */
import { ok, skip, toolOk } from './test-runner.mjs';

// ── batched_mesh_details ────────────────────────────────

export async function testBatchedMeshDetails(client) {
  // List all BatchedMeshes (may find none — that's OK)
  const resp = await client.callTool('batched_mesh_details');
  const data = toolOk('batched_mesh_details (list)', resp);
  if (!data) return;

  ok('has found field', data.found !== undefined);

  if (data.found) {
    ok('has meshes array', Array.isArray(data.meshes) && data.meshes.length > 0);
    ok('has count', data.count > 0, `${data.count} BatchedMeshes`);
    const mesh = data.meshes[0];
    ok('mesh has uuid', typeof mesh.uuid === 'string');
    ok('mesh has geometry', mesh.geometry !== undefined);
    ok('mesh has material', mesh.material !== undefined);
  } else {
    ok('no BatchedMesh message', typeof data.message === 'string', 'no BatchedMesh in scene');
  }

  // Non-existent name should error
  const badResp = await client.callTool('batched_mesh_details', { name: 'ZZZNONEXISTENT' });
  const badText = badResp.result?.content?.[0]?.text || '';
  ok('batched_mesh: bad name errors', badResp.result?.isError === true || badText.includes('not found'));
}

// ── clipping_details ────────────────────────────────────

export async function testClippingDetails(client) {
  const resp = await client.callTool('clipping_details');
  const data = toolOk('clipping_details', resp);
  if (!data) return;

  ok('has renderer section', data.renderer !== undefined);
  ok('has localClippingEnabled', data.renderer.localClippingEnabled !== undefined);
  ok('has globalPlanes', Array.isArray(data.renderer.globalPlanes));

  // materialClipping can be null or array
  ok('materialClipping field', data.materialClipping === null || Array.isArray(data.materialClipping));
  // clippingGroups can be null or array
  ok('clippingGroups field', data.clippingGroups === null || Array.isArray(data.clippingGroups));
}

// ── set_clipping ────────────────────────────────────────

export async function testSetClipping(client) {
  // Enable local clipping on renderer
  const enableResp = await client.callTool('set_clipping', {
    target: 'renderer',
    localClippingEnabled: true,
  });
  const enableData = toolOk('set_clipping (enable local)', enableResp);
  if (enableData) {
    ok('set_clipping success', enableData.success === true);
    ok('local clipping enabled', enableData.localClippingEnabled === true);
  }

  // Disable it back
  const disableResp = await client.callTool('set_clipping', {
    target: 'renderer',
    localClippingEnabled: false,
  });
  const disableData = toolOk('set_clipping (disable local)', disableResp);
  if (disableData) {
    ok('local clipping disabled', disableData.localClippingEnabled === false);
  }

  // Bad target
  const badResp = await client.callTool('set_clipping', { target: 'material' });
  const badText = badResp.result?.content?.[0]?.text || '';
  ok('set_clipping: material without name errors', badResp.result?.isError === true || badText.includes('Provide'));
}

// ── draw_call_breakdown ─────────────────────────────────

export async function testDrawCallBreakdown(client) {
  const resp = await client.callTool('draw_call_breakdown');
  const data = toolOk('draw_call_breakdown', resp);
  if (!data) return;

  ok('has summary', data.summary !== undefined);
  ok('has totalObjects', data.summary.totalObjects >= 0, `${data.summary.totalObjects} objects`);
  ok('has totalDrawCalls', data.summary.totalDrawCalls >= 0, `${data.summary.totalDrawCalls} draw calls`);
  ok('has totalTriangles', data.summary.totalTriangles >= 0, `${data.summary.totalTriangles} triangles`);
  ok('has hiddenObjects', data.summary.hiddenObjects >= 0);
  ok('has rendererReported', data.summary.rendererReported !== undefined);
  ok('renderer drawCalls', data.summary.rendererReported.drawCalls >= 0);
  ok('renderer triangles', data.summary.rendererReported.triangles >= 0);

  ok('has topObjects', Array.isArray(data.topObjects));
  if (data.topObjects.length > 0) {
    const top = data.topObjects[0];
    ok('top object has name', top.name !== undefined);
    ok('top object has type', typeof top.type === 'string');
    ok('top object has drawCalls', top.drawCalls >= 0);
    ok('top object has triangles', top.triangles >= 0);
    ok('top object has costPercent', top.costPercent >= 0);
    ok('top object has material', typeof top.material === 'string');
    ok('top object has visible', typeof top.visible === 'boolean');
  }

  ok('has multiMaterialObjects', Array.isArray(data.multiMaterialObjects));

  // Verify sorted by triangles descending
  if (data.topObjects.length > 1) {
    const sorted = data.topObjects.every((o, i) =>
      i === 0 || data.topObjects[i - 1].triangles >= o.triangles
    );
    ok('sorted by triangle count', sorted);
  }
}

// ── set_postprocessing ──────────────────────────────────

export async function testSetPostprocessing(client) {
  // First check if postprocessing exists
  const listResp = await client.callTool('postprocessing_list');
  const listData = toolOk('postprocessing_list (for set_postprocessing)', listResp);

  if (!listData || !listData.found) {
    skip('set_postprocessing', 'No EffectComposer in scene');
    return;
  }

  // List passes via set_postprocessing (no pass specified)
  const listPassesResp = await client.callTool('set_postprocessing');
  const listPassesData = toolOk('set_postprocessing (list)', listPassesResp);
  if (listPassesData) {
    ok('has passes', Array.isArray(listPassesData.passes));
  }

  // Try to disable and re-enable first non-RenderPass
  const composer = listData.composers[0];
  const nonRenderPass = composer.passes.find(p => p.type !== 'RenderPass' && p.enabled);
  if (nonRenderPass) {
    // Disable
    const disableResp = await client.callTool('set_postprocessing', {
      passIndex: nonRenderPass.index,
      enabled: false,
    });
    const disableData = toolOk(`set_postprocessing (disable pass ${nonRenderPass.index})`, disableResp);
    if (disableData) {
      ok('pass disabled', disableData.success === true);
      ok('pass enabled=false', disableData.pass?.enabled === false);
    }

    // Re-enable
    const enableResp = await client.callTool('set_postprocessing', {
      passIndex: nonRenderPass.index,
      enabled: true,
    });
    const enableData = toolOk(`set_postprocessing (enable pass ${nonRenderPass.index})`, enableResp);
    if (enableData) {
      ok('pass re-enabled', enableData.pass?.enabled === true);
    }
  } else {
    skip('set_postprocessing (toggle pass)', 'No non-RenderPass to toggle');
  }

  // Invalid pass index
  const badResp = await client.callTool('set_postprocessing', { passIndex: 999 });
  const badText = badResp.result?.content?.[0]?.text || '';
  ok('set_postprocessing: bad index errors', badResp.result?.isError === true || badText.includes('out of range'));
}
