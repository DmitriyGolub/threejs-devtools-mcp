/**
 * Test: animation inspection.
 */
import { ok, toolOk } from './test-runner.mjs';

export async function testAnimationDetails(client) {
  const resp = await client.callTool('animation_details');
  const data = toolOk('animation_details', resp);
  if (!data) return;

  ok('has mixers', Array.isArray(data.mixers), `${data.mixers?.length || 0} mixers`);

  if (data.mixers.length === 0) {
    ok('no animations', true, 'scene has no AnimationMixers');
    return;
  }

  const mixer = data.mixers[0];
  ok('mixer has time', typeof mixer.time === 'number', `${mixer.time}`);
  ok('mixer has timeScale', typeof mixer.timeScale === 'number', `${mixer.timeScale}`);
  ok('mixer has actions', Array.isArray(mixer.actions), `${mixer.actions?.length} actions`);

  if (mixer.actions.length > 0) {
    const action = mixer.actions[0];
    ok('action has clipName', typeof action.clipName === 'string', action.clipName);
    ok('action has isRunning', typeof action.isRunning === 'boolean', `${action.isRunning}`);
    ok('action has weight', typeof action.weight === 'number', `${action.weight}`);
    ok('action has timeScale', typeof action.timeScale === 'number', `${action.timeScale}`);
  }
}

export async function testSetAnimation(client) {
  const resp = await client.callTool('animation_details');
  const data = toolOk('animation_details (for set)', resp);
  if (!data || data.mixers.length === 0) {
    ok('set_animation: has mixers', false, 'no mixers');
    return;
  }

  // Change timeScale
  const tsResp = await client.callTool('set_animation', {
    mixerIndex: 0,
    timeScale: 0.5,
  });
  const tsResult = toolOk('set_animation (timeScale)', tsResp);
  if (tsResult) {
    ok('timeScale set', tsResult.success === true);
    ok('timeScale value', tsResult.timeScale === 0.5, `${tsResult.timeScale}`);
  }

  // Restore
  await client.callTool('set_animation', { mixerIndex: 0, timeScale: 1.0 });
  ok('timeScale restored', true);
}
