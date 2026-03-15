#!/usr/bin/env node
/**
 * Inspect the Three.js scene via MCP — outputs detailed scene info.
 * Requires: dev server running + browser open on localhost:9222.
 */
import path from 'node:path';
import { createTestClient } from './mcp-client.mjs';

const client = createTestClient(path.resolve(import.meta.dirname, '..'));

async function tool(name, args = {}) {
  const resp = await client.callTool(name, args);
  const text = resp.result?.content?.[0]?.text || '';
  if (resp.result?.isError) throw new Error(text);
  return JSON.parse(text);
}

try {
  await client.initialize();
  await new Promise(r => setTimeout(r, 4000));

  // Scene tree
  const tree = await tool('scene_tree', { depth: 2 });
  console.log('\n── Scene Tree ──');
  console.log(`Root: ${tree.type}, ${tree.childCount} children`);
  for (const c of (tree.children || [])) {
    console.log(`  ${c.name || '(unnamed)'} [${c.type}] pos=${JSON.stringify(c.position)}`);
  }

  // Renderer
  const info = await tool('renderer_info');
  console.log('\n── Renderer ──');
  console.log(`Canvas: ${info.canvas.width}x${info.canvas.height}, pixelRatio: ${info.pixelRatio}`);
  console.log(`Draw calls: ${info.render.calls}, Triangles: ${info.render.triangles}`);
  console.log(`Color space: ${info.outputColorSpace}, Tone mapping: ${info.toneMapping}`);
  console.log(`Shadow map: ${info.shadowMap.enabled ? 'enabled' : 'disabled'}`);

  // Materials
  const mats = await tool('material_list');
  console.log(`\n── Materials (${mats.length}) ──`);
  for (const m of mats) {
    const extra = [];
    if (m.color) extra.push(`color=${m.color}`);
    if (m.uniforms) extra.push(`uniforms=${Object.keys(m.uniforms).join(',')}`);
    if (m.maps?.length) extra.push(`maps=${m.maps.join(',')}`);
    console.log(`  ${m.name || '(unnamed)'} [${m.type}] ${extra.join(' ')}`);
  }

  // Find player (Armature or character)
  console.log('\n── Player ──');
  try {
    const player = await tool('object_details', { name: 'Armature' });
    console.log(`Name: ${player.name}, Type: ${player.type}`);
    console.log(`Position: ${JSON.stringify(player.position)}`);
    console.log(`World position: ${JSON.stringify(player.worldPosition)}`);
  } catch {
    // Try other names
    for (const name of ['Character', 'Player', 'character']) {
      try {
        const p = await tool('object_details', { name });
        console.log(`Name: ${p.name}, Position: ${JSON.stringify(p.position)}, World: ${JSON.stringify(p.worldPosition)}`);
        break;
      } catch { continue; }
    }
  }

  // Screenshot
  const shot = await client.callTool('take_screenshot');
  const img = shot.result?.content?.find(c => c.type === 'image');
  if (img) console.log(`\n── Screenshot: ${img.data.length} bytes base64 ──`);

  console.log('\n── Done ──');
} catch (err) {
  console.error('Error:', err.message);
} finally {
  client.kill();
  process.exit(0);
}
