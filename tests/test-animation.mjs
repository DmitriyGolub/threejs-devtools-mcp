/**
 * Test: animation inspection.
 */
import { ok, skip, toolOk } from './test-runner.mjs';

export async function testAnimationDetails(client) {
  const resp = await client.callTool('animation_details');
  const data = toolOk('animation_details', resp);
  if (!data) return;

  ok('has mixers', Array.isArray(data.mixers), `${data.mixers?.length || 0} mixers`);

  if (data.availableClips?.length > 0) {
    ok('has available clips', true, `${data.availableClips.length} objects with clips`);
    const first = data.availableClips[0];
    ok('clip has objectName', typeof first.objectName === 'string', first.objectName);
    ok('clip has clips', Array.isArray(first.clips) && first.clips.length > 0, `${first.clips.length} clips`);
    if (first.clips[0]) {
      ok('clip has name', typeof first.clips[0].name === 'string', first.clips[0].name);
      ok('clip has duration', typeof first.clips[0].duration === 'number', `${first.clips[0].duration}s`);
    }
  }

  if (data.mixers.length === 0) {
    if (data.availableClips?.length > 0) {
      ok('no active mixers but clips available', true, data.hint || 'clips found');
    } else {
      ok('no animations', true, 'scene has no AnimationMixers or clips');
    }
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
    skip('set_animation', 'no AnimationMixers in scene');
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
