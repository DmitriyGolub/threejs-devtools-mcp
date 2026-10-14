/**
 * Tests: tool modes, prompts, change journal (preview → pending_changes → revert),
 * web_audit, capture_frames, renderer backend.
 */
import fs from 'node:fs';
import { ok, toolOk } from './test-runner.mjs';

const text = (resp) => resp.result?.content?.map(c => c.text || '').join('\n') || '';

export async function testToolModes(client) {
  client.send({ jsonrpc: '2.0', id: 9001, method: 'tools/list', params: {} });
  const tools = (await client.waitFor(9001)).result?.tools || [];
  const unlabeled = tools.filter(t => !/^\[(INSPECT|LIVE PREVIEW|DEBUG VISUAL|FOR CODE|CONNECTION)\]/.test(t.description));
  ok('every tool has a mode label', unlabeled.length === 0, unlabeled.map(t => t.name).join(', ') || `${tools.length} tools`);

  const setTools = tools.filter(t => t.name.startsWith('set_') && !['set_dev_port', 'set_dev_url'].includes(t.name));
  ok('set_* tools are LIVE PREVIEW', setTools.every(t => t.description.startsWith('[LIVE PREVIEW]')));
  ok('no "ASK the user" leftovers', !tools.some(t => /ASK the user/i.test(t.description)));
  ok('preview tools are not read-only', setTools.every(t => t.annotations?.readOnlyHint === false));
  ok('pending_changes is FOR CODE', tools.find(t => t.name === 'pending_changes')?.description.startsWith('[FOR CODE]'));
}

export async function testPrompts(client) {
  client.send({ jsonrpc: '2.0', id: 9002, method: 'prompts/list', params: {} });
  const prompts = (await client.waitFor(9002)).result?.prompts || [];
  const names = prompts.map(p => p.name);
  for (const n of ['inspect-scene', 'try-look', 'apply-to-code', 'web-perf-audit', 'prepare-video', 'playwright-setup']) {
    ok(`prompt ${n}`, names.includes(n));
  }
  client.send({ jsonrpc: '2.0', id: 9003, method: 'prompts/get', params: { name: 'try-look', arguments: { idea: 'red car' } } });
  const msg = (await client.waitFor(9003)).result?.messages?.[0]?.content?.text || '';
  ok('prompt renders args', msg.includes('red car') && msg.includes('preview only'));
}

export async function testChangeJournal(client) {
  await client.callTool('pending_changes', { clear: true });

  const mats = toolOk('material_list (journal)', await client.callTool('material_list'));
  const mat = Array.isArray(mats) && mats.find(m => m.color && /Standard|Physical/.test(m.type));
  if (!mat) { ok('journal: has a standard material', false); return; }
  const original = mat.color;

  const setResp = await client.callTool('set_material_property', { uuid: mat.uuid, property: 'color', value: '#ff0000' });
  ok('preview note says not saved', /not saved/i.test(text(setResp)) && /pending_changes/.test(text(setResp)));

  // A second edit of the same property merges into one entry
  await client.callTool('set_material_property', { uuid: mat.uuid, property: 'color', value: '#00ff00' });
  await client.callTool('set_material_property', { uuid: mat.uuid, property: 'roughness', value: 0.123 });

  const pending = text(await client.callTool('pending_changes', { style: 'both' }));
  ok('pending_changes counts merged edits', pending.includes('2 pending change(s)'), pending.split('\n')[0]);
  ok('pending_changes before → after', pending.includes(`"${original}" → "#00ff00"`));
  ok('vanilla snippet', pending.includes(`material.color.set('#00ff00')`));
  ok('r3f snippet', /<mesh\w*Material color="#00ff00" \/>/.test(pending));

  const reverted = text(await client.callTool('revert_changes', {}));
  ok('revert_changes', reverted.startsWith('Reverted 2'), reverted.split('\n')[0]);

  const after = toolOk('material_details after revert', await client.callTool('material_details', { uuid: mat.uuid }));
  ok('color restored', after?.color === original, `${after?.color} (was ${original})`);
  ok('roughness restored', after?.roughness === mat.roughness || after?.roughness !== 0.123, `${after?.roughness}`);

  const empty = text(await client.callTool('pending_changes', {}));
  ok('journal empty after revert', empty.startsWith('No pending changes'));

  // Transform + light, then clear without reverting
  const objs = toolOk('find_objects (journal)', await client.callTool('find_objects', { type: 'Mesh', limit: 5 }));
  const named = (objs?.objects || objs || []).find?.(o => o.name);
  if (named) {
    await client.callTool('set_object_transform', { name: named.name, position: [0, 2, 0] });
    const p = text(await client.callTool('pending_changes', { style: 'vanilla', clear: true }));
    ok('transform snippet', p.includes('obj.position.set(0, 2, 0)') && p.includes(`getObjectByName('${named.name}')`));
    ok('clear', p.endsWith('Cleared.'));
  }
}

export async function testRendererBackend(client) {
  const info = toolOk('renderer_info (backend)', await client.callTool('renderer_info'));
  ok('renderer_info backend', info?.backend === 'webgl' || info?.backend === 'webgpu', info?.backend);
}

export async function testWebAudit(client) {
  const audit = toolOk('web_audit', await client.callTool('web_audit'));
  ok('web_audit findings array', Array.isArray(audit?.findings), `${audit?.findings?.length} findings`);
  ok('web_audit every finding has a fix', audit?.findings?.every(f => f.fix && f.issue && f.severity));
}

export async function testCaptureFrames(client) {
  const resp = await client.callTool('capture_frames', { fps: 10, duration: 0.5, format: 'jpeg' });
  const out = text(resp);
  ok('capture_frames ok', !resp.result?.isError, out.split('\n')[0]);
  const dir = out.match(/→ (.+)$/m)?.[1];
  const files = dir && fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  ok('capture_frames wrote 5 frames', files.length === 5, `${files.length} files`);
  ok('capture_frames ffmpeg command', out.includes('ffmpeg -framerate 10'));

  // The app's own loop must run again afterwards
  const before = toolOk('renderer_info (after capture)', await client.callTool('renderer_info'));
  await new Promise(r => setTimeout(r, 500));
  const later = toolOk('renderer_info (after capture 2)', await client.callTool('renderer_info'));
  ok('render loop resumed', later?.render?.frame > before?.render?.frame, `${before?.render?.frame} → ${later?.render?.frame}`);
}
