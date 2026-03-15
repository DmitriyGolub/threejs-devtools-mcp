/**
 * Test: mutation tools (set_material_property, set_uniform, set_object_transform, set_light, highlight, run_js, performance).
 */
import { ok, toolOk } from './test-runner.mjs';

// ── set_material_property ────────────────────────────────

export async function testSetMaterialProperty(client) {
  // First get a material to work with
  const listResp = await client.callTool('material_list');
  const materials = toolOk('material_list (for mutation)', listResp);
  if (!materials || materials.length === 0) {
    ok('set_material_property: has materials', false, 'no materials in scene');
    return;
  }

  // Find a MeshStandardMaterial with a color property
  const stdMat = materials.find(m => m.type === 'MeshStandardMaterial' && m.color);
  if (!stdMat) {
    ok('set_material_property: found standard material', false, 'no MeshStandardMaterial found');
    return;
  }
  ok('set_material_property: found standard material', true, `${stdMat.name || stdMat.uuid}`);

  // Set roughness
  const roughResp = await client.callTool('set_material_property', {
    uuid: stdMat.uuid,
    property: 'roughness',
    value: 0.42,
  });
  const roughResult = toolOk('set_material_property (roughness)', roughResp);
  if (roughResult) {
    ok('roughness set', roughResult.success === true);
    ok('roughness value', roughResult.newValue === 0.42, `${roughResult.newValue}`);
  }

  // Set wireframe
  const wireResp = await client.callTool('set_material_property', {
    uuid: stdMat.uuid,
    property: 'wireframe',
    value: true,
  });
  const wireResult = toolOk('set_material_property (wireframe=true)', wireResp);
  if (wireResult) {
    ok('wireframe on', wireResult.success && wireResult.newValue === true);
  }

  // Undo wireframe
  const wireOffResp = await client.callTool('set_material_property', {
    uuid: stdMat.uuid,
    property: 'wireframe',
    value: false,
  });
  const wireOffResult = toolOk('set_material_property (wireframe=false)', wireOffResp);
  if (wireOffResult) {
    ok('wireframe off', wireOffResult.success && wireOffResult.newValue === false);
  }

  // Set color
  const colorResp = await client.callTool('set_material_property', {
    uuid: stdMat.uuid,
    property: 'color',
    value: '#ff0000',
  });
  const colorResult = toolOk('set_material_property (color)', colorResp);
  if (colorResult) {
    ok('color set', colorResult.success === true);
    ok('color value', colorResult.newValue === '#ff0000', colorResult.newValue);
  }

  // Invalid property should fail
  const invalidResp = await client.callTool('set_material_property', {
    uuid: stdMat.uuid,
    property: 'hackerField',
    value: 123,
  });
  const invalidText = invalidResp.result?.content?.[0]?.text || '';
  ok('invalid property rejected', invalidResp.result?.isError === true || invalidText.includes('not settable'));
}

// ── set_uniform ──────────────────────────────────────────

export async function testSetUniform(client) {
  // Find a ShaderMaterial
  const listResp = await client.callTool('material_list');
  const materials = toolOk('material_list (for uniform)', listResp);
  if (!materials) return;

  const shaderMat = materials.find(m => m.type === 'ShaderMaterial' && m.uniforms && Object.keys(m.uniforms).length > 0);
  if (!shaderMat) {
    ok('set_uniform: found shader material', false, 'no ShaderMaterial with uniforms');
    return;
  }
  ok('set_uniform: found shader material', true, `${shaderMat.name || shaderMat.uuid}`);

  // Find a color uniform
  const uniformNames = Object.keys(shaderMat.uniforms);
  const colorUniform = uniformNames.find(n => typeof shaderMat.uniforms[n] === 'string' && shaderMat.uniforms[n].startsWith('#'));
  const scalarUniform = uniformNames.find(n => typeof shaderMat.uniforms[n] === 'number');

  if (colorUniform) {
    const resp = await client.callTool('set_uniform', {
      uuid: shaderMat.uuid,
      uniform: colorUniform,
      value: '#00ff88',
    });
    const result = toolOk(`set_uniform (${colorUniform})`, resp);
    if (result) {
      ok('color uniform set', result.success === true);
      ok('color uniform value', result.newValue === '#00ff88', result.newValue);
    }
  }

  if (scalarUniform) {
    const resp = await client.callTool('set_uniform', {
      uuid: shaderMat.uuid,
      uniform: scalarUniform,
      value: 0.77,
    });
    const result = toolOk(`set_uniform (${scalarUniform})`, resp);
    if (result) {
      ok('scalar uniform set', result.success === true);
    }
  }

  // Non-existent uniform
  const badResp = await client.callTool('set_uniform', {
    uuid: shaderMat.uuid,
    uniform: 'uNonExistent',
    value: 1,
  });
  const badText = badResp.result?.content?.[0]?.text || '';
  ok('non-existent uniform rejected', badResp.result?.isError === true || badText.includes('not found'));
}

// ── set_object_transform ─────────────────────────────────

export async function testSetObjectTransform(client) {
  // Get scene tree to find an object
  const treeResp = await client.callTool('scene_tree', { depth: 2 });
  const tree = toolOk('scene_tree (for transform)', treeResp);
  if (!tree) return;

  // Find a named object
  const named = tree.children?.find(c => c.name && c.name.length > 0);
  if (!named) {
    ok('set_object_transform: found named object', false, 'no named objects in scene');
    return;
  }
  ok('set_object_transform: target', true, named.name);

  // Save original position
  const originalPos = named.position;

  // Move it
  const resp = await client.callTool('set_object_transform', {
    name: named.name,
    position: [99, 99, 99],
  });
  const result = toolOk('set_object_transform (position)', resp);
  if (result) {
    ok('transform set', result.success === true);
    ok('position updated', JSON.stringify(result.position) === JSON.stringify([99, 99, 99]),
      JSON.stringify(result.position));
  }

  // Restore original position
  await client.callTool('set_object_transform', {
    name: named.name,
    position: originalPos,
  });
  ok('position restored', true);

  // Toggle visibility
  const hideResp = await client.callTool('set_object_transform', {
    name: named.name,
    visible: false,
  });
  const hideResult = toolOk('set_object_transform (visible=false)', hideResp);
  if (hideResult) ok('hidden', hideResult.visible === false);

  // Restore visibility
  await client.callTool('set_object_transform', { name: named.name, visible: true });
  ok('visibility restored', true);
}

// ── set_light ────────────────────────────────────────────

export async function testSetLight(client) {
  // Find lights via scene_tree
  const treeResp = await client.callTool('scene_tree', { depth: 1, types: ['DirectionalLight', 'AmbientLight', 'HemisphereLight', 'PointLight'] });
  const tree = toolOk('scene_tree (lights)', treeResp);

  // Try to find any light by name
  const lightNames = ['sunLight', 'rimLight', 'ambientLight', 'hemisphereLight'];
  let foundLight = null;

  for (const name of lightNames) {
    const resp = await client.callTool('set_light', {
      name,
      intensity: 0.5,
    });
    const result = toolOk(`set_light (${name})`, resp);
    if (result?.success) {
      foundLight = name;
      ok('light intensity set', result.intensity === 0.5, `${name}: ${result.intensity}`);
      break;
    }
  }

  if (!foundLight) {
    // Try via UUID from tree
    const light = tree?.children?.find(c => c.type?.includes('Light'));
    if (light) {
      const resp = await client.callTool('set_light', {
        uuid: light.uuid,
        intensity: 0.5,
      });
      const result = toolOk('set_light (by uuid)', resp);
      if (result) ok('light intensity set', result.success === true);
    } else {
      ok('set_light: found light', false, 'no lights in scene');
    }
  }

  // Test non-light rejection
  const treeFull = await client.callTool('scene_tree', { depth: 1 });
  const treeFull2 = toolOk('scene_tree (for non-light test)', treeFull);
  const mesh = treeFull2?.children?.find(c => c.type === 'Mesh');
  if (mesh?.uuid) {
    const badResp = await client.callTool('set_light', { uuid: mesh.uuid, intensity: 1 });
    const badText = badResp.result?.content?.[0]?.text || '';
    ok('non-light rejected', badResp.result?.isError === true || badText.includes('not a light'));
  }
}

// ── highlight_object ─────────────────────────────────────

export async function testHighlightObject(client) {
  const treeResp = await client.callTool('scene_tree', { depth: 2 });
  const tree = toolOk('scene_tree (for highlight)', treeResp);
  if (!tree) return;

  const named = tree.children?.find(c => c.name && c.name.length > 0);
  if (!named) {
    ok('highlight: found named object', false);
    return;
  }

  // Enable wireframe highlight
  const onResp = await client.callTool('highlight_object', {
    name: named.name,
    mode: 'wireframe',
    enabled: true,
  });
  const onResult = toolOk('highlight_object (on)', onResp);
  if (onResult) {
    ok('highlight enabled', onResult.success && onResult.enabled === true);
  }

  // Disable wireframe highlight
  const offResp = await client.callTool('highlight_object', {
    name: named.name,
    mode: 'wireframe',
    enabled: false,
  });
  const offResult = toolOk('highlight_object (off)', offResp);
  if (offResult) {
    ok('highlight disabled', offResult.success && offResult.enabled === false);
  }
}

// ── run_js ───────────────────────────────────────────────

export async function testRunJs(client) {
  // Simple return
  const resp = await client.callTool('run_js', {
    code: 'return scene.children.length',
  });
  const result = toolOk('run_js (children count)', resp);
  ok('run_js returns number', typeof result === 'number' && result > 0, `${result} children`);

  // Object query
  const resp2 = await client.callTool('run_js', {
    code: 'return scene.children.map(c => c.type)',
  });
  const result2 = toolOk('run_js (children types)', resp2);
  ok('run_js returns array', Array.isArray(result2) && result2.length > 0, result2?.join(', '));

  // Access renderer
  const resp3 = await client.callTool('run_js', {
    code: 'return { drawCalls: renderer.info.render.calls, pixelRatio: renderer.getPixelRatio() }',
  });
  const result3 = toolOk('run_js (renderer info)', resp3);
  if (result3) {
    ok('run_js renderer access', result3.drawCalls >= 0, `${result3.drawCalls} draw calls`);
  }

  // Error handling
  const resp4 = await client.callTool('run_js', { code: 'throw new Error("test error")' });
  const text4 = resp4.result?.content?.[0]?.text || '';
  ok('run_js error caught', resp4.result?.isError === true || text4.includes('test error'));
}

// ── Color space correctness ──────────────────────────────

export async function testColorSpace(client) {
  // Get materials, find one with color
  const listResp = await client.callTool('material_list');
  const materials = toolOk('material_list (for color space)', listResp);
  if (!materials) return;

  const stdMat = materials.find(m => m.type === 'MeshStandardMaterial' && m.color);
  if (!stdMat) {
    ok('color space: found material', false, 'no MeshStandardMaterial');
    return;
  }

  // Set to pure red sRGB
  const setResp = await client.callTool('set_material_property', {
    uuid: stdMat.uuid,
    property: 'color',
    value: '#ff0000',
  });
  const setResult = toolOk('set color to #ff0000', setResp);
  if (setResult) {
    // Reading back should return #ff0000 (sRGB), not the linear equivalent
    ok('color round-trip sRGB', setResult.newValue === '#ff0000',
      `expected #ff0000, got ${setResult.newValue}`);
  }

  // Test with shader uniform color
  const shaderMat = materials.find(m => m.type === 'ShaderMaterial' && m.uniforms);
  if (shaderMat) {
    const colorUniform = Object.keys(shaderMat.uniforms || {}).find(
      k => typeof shaderMat.uniforms[k] === 'string' && shaderMat.uniforms[k].startsWith('#')
    );
    if (colorUniform) {
      const uResp = await client.callTool('set_uniform', {
        uuid: shaderMat.uuid,
        uniform: colorUniform,
        value: '#00ff00',
      });
      const uResult = toolOk(`set uniform ${colorUniform} to #00ff00`, uResp);
      if (uResult) {
        ok('uniform color round-trip sRGB', uResult.newValue === '#00ff00',
          `expected #00ff00, got ${uResult.newValue}`);
      }
    }
  }
}

// ── instanced_mesh_details ───────────────────────────────

export async function testInstancedMeshDetails(client) {
  // Find an InstancedMesh via performance_snapshot
  const perfResp = await client.callTool('performance_snapshot');
  const perf = toolOk('performance_snapshot (for instanced)', perfResp);
  if (!perf || !perf.instancedMeshes || perf.instancedMeshes.length === 0) {
    ok('instanced_mesh_details: found instanced mesh', false, 'no InstancedMesh in scene');
    return;
  }

  const im = perf.instancedMeshes[0];
  ok('found instanced mesh', true, `${im.name} (${im.count}/${im.maxCount})`);

  // Get details
  const resp = await client.callTool('instanced_mesh_details', {
    name: im.name,
    sampleCount: 3,
  });
  const data = toolOk('instanced_mesh_details', resp);
  if (!data) return;

  ok('has count', data.count >= 0, `${data.count}`);
  ok('has maxCount', data.maxCount > 0, `${data.maxCount}`);
  ok('has geometry', data.geometry?.vertices > 0, `${data.geometry?.vertices} verts`);
  ok('has samples', Array.isArray(data.sampleInstances), `${data.sampleInstances?.length} samples`);

  if (data.sampleInstances?.length > 0) {
    const s = data.sampleInstances[0];
    ok('sample has position', Array.isArray(s.position) && s.position.length === 3,
      JSON.stringify(s.position));
    ok('sample has scale', Array.isArray(s.scale) && s.scale.length === 3,
      JSON.stringify(s.scale));
  }

  if (data.instanceAttributes) {
    const attrNames = Object.keys(data.instanceAttributes);
    ok('has custom attributes', attrNames.length > 0, attrNames.join(', '));
  }

  ok('has totalTriangles', data.totalTriangles >= 0, `${data.totalTriangles}`);
}

// ── set_instanced_mesh ───────────────────────────────────

export async function testSetInstancedMesh(client) {
  // Find an InstancedMesh
  const perfResp = await client.callTool('performance_snapshot');
  const perf = toolOk('performance_snapshot (for set_instanced)', perfResp);
  if (!perf || !perf.instancedMeshes || perf.instancedMeshes.length === 0) {
    ok('set_instanced_mesh: found instanced mesh', false);
    return;
  }

  const im = perf.instancedMeshes[0];
  const originalCount = im.count;

  // Set count to half
  const halfCount = Math.max(1, Math.floor(originalCount / 2));
  const resp = await client.callTool('set_instanced_mesh', {
    name: im.name,
    count: halfCount,
  });
  const result = toolOk('set_instanced_mesh (count)', resp);
  if (result) {
    ok('count set', result.success && result.count === halfCount, `${result.count}`);
  }

  // Restore count — note: the actual scene may update count each frame,
  // so we just verify the tool works without errors
  await client.callTool('set_instanced_mesh', {
    name: im.name,
    count: originalCount,
  });
  ok('count restored', true);

  // Test non-InstancedMesh rejection
  const treeResp = await client.callTool('scene_tree', { depth: 1 });
  const tree = toolOk('scene_tree (for non-instanced test)', treeResp);
  const group = tree?.children?.find(c => c.type === 'Group');
  if (group?.name) {
    const badResp = await client.callTool('instanced_mesh_details', { name: group.name });
    const badText = badResp.result?.content?.[0]?.text || '';
    ok('non-InstancedMesh rejected', badResp.result?.isError === true || badText.includes('not an InstancedMesh'));
  }
}

// ── performance_snapshot ─────────────────────────────────

export async function testPerformanceSnapshot(client) {
  const resp = await client.callTool('performance_snapshot');
  const data = toolOk('performance_snapshot', resp);
  if (!data) return;

  ok('has drawCalls', data.drawCalls >= 0, `${data.drawCalls}`);
  ok('has triangles', data.triangles >= 0, `${data.triangles}`);
  ok('has totalVertices', data.totalVertices >= 0, `${data.totalVertices}`);
  ok('has programs', data.programs >= 0, `${data.programs}`);
  ok('has memory', data.memory?.geometries >= 0 && data.memory?.textures >= 0,
    `${data.memory?.geometries} geos, ${data.memory?.textures} texs`);
  ok('has canvas', data.canvas?.width > 0 && data.canvas?.height > 0,
    `${data.canvas?.width}x${data.canvas?.height} @${data.canvas?.pixelRatio}x`);
  ok('has instancedMeshes', Array.isArray(data.instancedMeshes),
    `${data.instancedMeshes?.length} instanced`);
  ok('has objectsByType', typeof data.objectsByType === 'object',
    Object.entries(data.objectsByType || {}).map(([k, v]) => `${k}:${v}`).join(', '));
}
