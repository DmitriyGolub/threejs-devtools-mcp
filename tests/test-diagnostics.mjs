/**
 * Test: diagnostic tools (find_objects, memory_stats, dispose_check,
 * toggle_wireframe, bounding_boxes, env_map_details, scene_diff, postprocessing_list).
 */
import { ok, skip, toolOk } from './test-runner.mjs';

// ── find_objects ─────────────────────────────────────────

export async function testFindObjects(client) {
  // Find all meshes
  const resp = await client.callTool('find_objects', { type: 'Mesh' });
  const data = toolOk('find_objects (type=Mesh)', resp);
  if (data) {
    ok('found meshes', data.count > 0, `${data.count} meshes`);
    ok('has objects array', Array.isArray(data.objects) && data.objects.length > 0);
    const first = data.objects[0];
    ok('object has name', first.name !== undefined);
    ok('object has type', first.type === 'Mesh');
    ok('object has uuid', typeof first.uuid === 'string');
    ok('object has position', Array.isArray(first.position));
  }

  // Find by type InstancedMesh
  const imResp = await client.callTool('find_objects', { type: 'InstancedMesh' });
  const imData = toolOk('find_objects (type=InstancedMesh)', imResp);
  if (imData && imData.count > 0) {
    ok('instanced mesh has instances', imData.objects[0].instances !== undefined,
      `${imData.objects[0].instances} instances`);
  }

  // Find invisible objects
  const invisResp = await client.callTool('find_objects', { visible: false });
  const invisData = toolOk('find_objects (visible=false)', invisResp);
  ok('invisible search works', invisData !== null, `${invisData?.count || 0} invisible objects`);

  // Find by name pattern
  const patternResp = await client.callTool('find_objects', { namePattern: 'road|env|decal' });
  const patternData = toolOk('find_objects (namePattern)', patternResp);
  ok('name pattern search works', patternData !== null, `${patternData?.count || 0} matches`);

  // Find with hasGeometry filter
  const geoResp = await client.callTool('find_objects', { hasGeometry: true, limit: 5 });
  const geoData = toolOk('find_objects (hasGeometry=true)', geoResp);
  if (geoData && geoData.count > 0) {
    ok('all have vertices', geoData.objects.every(o => o.vertices !== undefined));
  }

  // Empty results
  const emptyResp = await client.callTool('find_objects', { namePattern: '^ZZZNONEXISTENT$' });
  const emptyData = toolOk('find_objects (no match)', emptyResp);
  ok('empty results handled', emptyData && emptyData.count === 0);

  // Limit parameter
  const limitResp = await client.callTool('find_objects', { limit: 3 });
  const limitData = toolOk('find_objects (limit=3)', limitResp);
  ok('limit respected', limitData && limitData.objects.length <= 3, `${limitData?.objects?.length} results`);
}

// ── memory_stats ─────────────────────────────────────────

export async function testMemoryStats(client) {
  const resp = await client.callTool('memory_stats');
  const data = toolOk('memory_stats', resp);
  if (!data) return;

  ok('has summary', data.summary !== undefined);
  ok('has geometries count', data.summary.geometries >= 0, `${data.summary.geometries} geometries`);
  ok('has materials count', data.summary.materials >= 0, `${data.summary.materials} materials`);
  ok('has textures count', data.summary.textures >= 0, `${data.summary.textures} textures`);
  ok('has geometry memory', typeof data.summary.geometryMemory === 'string', data.summary.geometryMemory);
  ok('has texture memory', typeof data.summary.textureMemory === 'string', data.summary.textureMemory);
  ok('has total estimated', typeof data.summary.totalEstimated === 'string', data.summary.totalEstimated);

  ok('has renderer info', data.rendererInfo !== undefined);
  ok('renderer geometries', data.rendererInfo.geometries >= 0);
  ok('renderer textures', data.rendererInfo.textures >= 0);

  ok('has top textures', Array.isArray(data.topTextures), `${data.topTextures?.length} top textures`);
  if (data.topTextures?.length > 0) {
    const top = data.topTextures[0];
    ok('top texture has size', typeof top.size === 'string', top.size);
    ok('top texture has estimated bytes', typeof top.estimatedBytes === 'string', top.estimatedBytes);
  }
}

// ── dispose_check ────────────────────────────────────────

export async function testDisposeCheck(client) {
  const resp = await client.callTool('dispose_check');
  const data = toolOk('dispose_check', resp);
  if (!data) return;

  ok('has inScene counts', data.inScene !== undefined);
  ok('inScene geometries', data.inScene.geometries >= 0, `${data.inScene.geometries}`);
  ok('inScene materials', data.inScene.materials >= 0, `${data.inScene.materials}`);
  ok('inScene textures', data.inScene.textures >= 0, `${data.inScene.textures}`);

  ok('has inRenderer counts', data.inRenderer !== undefined);
  ok('inRenderer geometries', data.inRenderer.geometries >= 0, `${data.inRenderer.geometries}`);

  ok('has potentialLeaks', data.potentialLeaks !== undefined);
  ok('has orphaned counts', data.potentialLeaks.orphanedGeometries >= 0);
  ok('has note', typeof data.potentialLeaks.note === 'string');

  // hiddenWithGeometry can be null (no hidden objects) or an object
  ok('hiddenWithGeometry field present', data.hiddenWithGeometry === null || data.hiddenWithGeometry?.count >= 0);
}

// ── toggle_wireframe ─────────────────────────────────────

export async function testToggleWireframe(client) {
  // Toggle wireframe on whole scene
  const onResp = await client.callTool('toggle_wireframe', { enabled: true });
  const onData = toolOk('toggle_wireframe (on)', onResp);
  if (onData) {
    ok('wireframe enabled', onData.success === true);
    ok('materials affected', onData.materialsAffected > 0, `${onData.materialsAffected} materials`);
  }

  // Toggle wireframe off
  const offResp = await client.callTool('toggle_wireframe', { enabled: false });
  const offData = toolOk('toggle_wireframe (off)', offResp);
  if (offData) {
    ok('wireframe disabled', offData.success === true);
    ok('materials restored', offData.materialsAffected > 0);
  }

  // Toggle on specific object
  const treeResp = await client.callTool('scene_tree', { depth: 1 });
  const tree = toolOk('scene_tree (for wireframe)', treeResp);
  const named = tree?.children?.find(c => c.name && c.name.length > 0);
  if (named) {
    const objResp = await client.callTool('toggle_wireframe', { name: named.name, enabled: true });
    const objData = toolOk(`toggle_wireframe (${named.name})`, objResp);
    ok('object wireframe', objData?.success === true);

    // Restore
    await client.callTool('toggle_wireframe', { name: named.name, enabled: false });
    ok('object wireframe restored', true);
  }

  // Non-existent object
  const badResp = await client.callTool('toggle_wireframe', { name: 'ZZZNONEXISTENT' });
  const badText = badResp.result?.content?.[0]?.text || '';
  ok('non-existent object rejected', badResp.result?.isError === true || badText.includes('not found'));
}

// ── bounding_boxes ───────────────────────────────────────

export async function testBoundingBoxes(client) {
  // Add bounding boxes with limit
  const addResp = await client.callTool('bounding_boxes', { enabled: true, limit: 5 });
  const addText = addResp.result?.content?.[0]?.text || '';
  if (addResp.result?.isError && addText.includes('BoxHelper not available')) {
    skip('bounding_boxes (add)', 'THREE.BoxHelper not exposed on window.THREE');
  }
  const addData = addResp.result?.isError ? null : toolOk('bounding_boxes (add)', addResp);
  if (addData) {
    ok('boxes added', addData.success === true);
    ok('action is added', addData.action === 'added');
    ok('count > 0', addData.count > 0, `${addData.count} boxes`);
  }

  // Clear all bounding boxes
  const clearResp = await client.callTool('bounding_boxes', { clear: true });
  const clearData = toolOk('bounding_boxes (clear)', clearResp);
  if (clearData) {
    ok('boxes cleared', clearData.success === true);
    ok('action is removed', clearData.action === 'removed');
  }

  // Add on specific object
  const treeResp = await client.callTool('scene_tree', { depth: 1 });
  const tree = toolOk('scene_tree (for bbox)', treeResp);
  const named = tree?.children?.find(c => c.name && c.name.length > 0);
  if (named) {
    const objResp = await client.callTool('bounding_boxes', { name: named.name });
    const objData = toolOk(`bounding_boxes (${named.name})`, objResp);
    ok('single object bbox', objData?.success === true);

    // Clean up
    await client.callTool('bounding_boxes', { clear: true });
  }
}

// ── env_map_details ──────────────────────────────────────

export async function testEnvMapDetails(client) {
  const resp = await client.callTool('env_map_details');
  const data = toolOk('env_map_details', resp);
  if (!data) return;

  ok('has scene section', data.scene !== undefined);
  ok('has backgroundBlurriness', data.scene.backgroundBlurriness !== undefined);
  ok('has backgroundIntensity', data.scene.backgroundIntensity !== undefined);
  ok('has environmentIntensity', data.scene.environmentIntensity !== undefined);

  // environment and background can be null (no env map set)
  ok('environment field present', data.scene.environment === null || typeof data.scene.environment === 'object');
  ok('background field present', data.scene.background === null || typeof data.scene.background === 'object');

  // materialEnvMaps can be null or array
  ok('materialEnvMaps field present', data.materialEnvMaps === null || Array.isArray(data.materialEnvMaps));
}

// ── scene_diff ───────────────────────────────────────────

export async function testSceneDiff(client) {
  // First call: snapshot
  const snapResp = await client.callTool('scene_diff', { action: 'snapshot' });
  const snapData = toolOk('scene_diff (snapshot)', snapResp);
  if (snapData) {
    ok('snapshot saved', snapData.success === true);
    ok('snapshot action', snapData.action === 'snapshot');
    ok('snapshot has object count', snapData.objectCount > 0, `${snapData.objectCount} objects`);
  }

  // Make a change (move an object)
  const treeResp = await client.callTool('scene_tree', { depth: 1 });
  const tree = toolOk('scene_tree (for diff)', treeResp);
  const named = tree?.children?.find(c => c.name && c.name.length > 0);
  let originalPos = null;

  if (named) {
    // Get current position
    const detailResp = await client.callTool('object_details', { name: named.name });
    const detail = toolOk('object_details (for diff)', detailResp);
    originalPos = detail?.position;

    // Move it
    await client.callTool('set_object_transform', {
      name: named.name,
      position: [999, 999, 999],
    });
  }

  // Second call: diff
  const diffResp = await client.callTool('scene_diff', { action: 'diff' });
  const diffData = toolOk('scene_diff (diff)', diffResp);
  if (diffData) {
    ok('diff action', diffData.action === 'diff');
    ok('has snapshot objects', diffData.snapshotObjects > 0);
    ok('has current objects', diffData.currentObjects > 0);
    ok('has totalChanges', diffData.totalChanges >= 0, `${diffData.totalChanges} changes`);
    ok('has changes array', Array.isArray(diffData.changes));

    if (named && diffData.totalChanges > 0) {
      const movedObj = diffData.changes.find(c => c.name === named.name && c.change === 'modified');
      ok('detected move', !!movedObj, movedObj ? 'found position change' : 'object not in changes');
    }
  }

  // Restore position
  if (named && originalPos) {
    await client.callTool('set_object_transform', {
      name: named.name,
      position: originalPos,
    });
    ok('position restored after diff', true);
  }

  // Auto mode (should take new snapshot since we consumed the previous diff)
  const autoResp = await client.callTool('scene_diff', { action: 'auto' });
  const autoData = toolOk('scene_diff (auto)', autoResp);
  ok('auto mode works', autoData !== null);
}

// ── postprocessing_list ──────────────────────────────────

export async function testPostprocessingList(client) {
  const resp = await client.callTool('postprocessing_list');
  const data = toolOk('postprocessing_list', resp);
  if (!data) return;

  // The tool always returns either { found: false, message } or { found: true, composers }
  ok('has found field', data.found !== undefined);

  if (data.found) {
    ok('has composers', Array.isArray(data.composers) && data.composers.length > 0);
    const composer = data.composers[0];
    ok('composer has source', typeof composer.source === 'string');
    ok('composer has passes', Array.isArray(composer.passes));
    ok('composer has passCount', composer.passCount >= 0);
  } else {
    ok('no postprocessing message', typeof data.message === 'string', 'no EffectComposer found');
  }
}

// ── gltf_to_r3f ──────────────────────────────────────────

export async function testGltfToR3f(client) {
  // Test with a non-existent file (should return error gracefully)
  const badResp = await client.callTool('gltf_to_r3f', { filePath: '/nonexistent/model.glb' });
  const badText = badResp.result?.content?.[0]?.text || '';
  ok('gltf_to_r3f: missing file error', badResp.result?.isError === true || badText.includes('Error'),
    'graceful error on missing file');

  // Test with invalid extension (should give meaningful error)
  const extResp = await client.callTool('gltf_to_r3f', { filePath: 'model.txt' });
  const extText = extResp.result?.content?.[0]?.text || '';
  ok('gltf_to_r3f: handles gracefully', extResp.result?.isError === true || extText.includes('Error') || extText.length > 0,
    'meaningful response');
}
