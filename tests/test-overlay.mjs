/**
 * Test: toggle_overlay and overlay_selected tools.
 */
import { ok, toolOk } from './test-runner.mjs';

export async function testToggleOverlay(client) {
  // Enable overlay
  const onResp = await client.callTool('toggle_overlay', { enabled: true });
  const onData = toolOk('toggle_overlay (enable)', onResp);
  if (onData) {
    ok('overlay visible after enable', onData.visible === true);
  }

  // Disable overlay
  const offResp = await client.callTool('toggle_overlay', { enabled: false });
  const offData = toolOk('toggle_overlay (disable)', offResp);
  if (offData) {
    ok('overlay hidden after disable', offData.visible === false);
  }

  // Toggle without params (was off, should turn on)
  const toggleResp = await client.callTool('toggle_overlay', {});
  const toggleData = toolOk('toggle_overlay (toggle)', toggleResp);
  if (toggleData) {
    ok('overlay toggled on', toggleData.visible === true);
  }

  // Clean up — disable overlay
  await client.callTool('toggle_overlay', { enabled: false });
}

export async function testOverlaySelected(client) {
  // Call overlay_selected without any object selected — should return error
  const resp = await client.callTool('overlay_selected', {});
  const text = resp.result?.content?.[0]?.text || '';
  const isError = resp.result?.isError;

  ok('overlay_selected no selection returns error', isError === true,
    text.substring(0, 150));
}
