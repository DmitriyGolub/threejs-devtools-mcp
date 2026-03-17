/**
 * Test: perf_monitor tool.
 */
import { ok, toolOk } from './test-runner.mjs';

export async function testPerfMonitor(client) {
  // Record for 1 second (keep tests fast)
  const resp = await client.callTool('perf_monitor', { duration: 1, includeFrameTimes: true });
  const data = toolOk('perf_monitor (1s)', resp);
  if (!data) return;

  ok('has totalFrames', data.totalFrames > 0, `${data.totalFrames} frames`);
  ok('has avgFps', data.avgFps > 0, `${data.avgFps} FPS`);
  ok('has minFps', typeof data.minFps === 'number', `min: ${data.minFps}`);
  ok('has maxFps', typeof data.maxFps === 'number', `max: ${data.maxFps}`);
  ok('has avgFrameTime', data.avgFrameTime > 0, `${data.avgFrameTime}ms`);
  ok('has maxFrameTime', data.maxFrameTime > 0, `${data.maxFrameTime}ms`);
  ok('has p50', typeof data.p50 === 'number', `p50: ${data.p50}ms`);
  ok('has p95', typeof data.p95 === 'number', `p95: ${data.p95}ms`);
  ok('has p99', typeof data.p99 === 'number', `p99: ${data.p99}ms`);
  ok('has spikes count', typeof data.spikes === 'number', `${data.spikes} spikes`);
  ok('has janks count', typeof data.janks === 'number', `${data.janks} janks`);
  ok('has frameTimes array', Array.isArray(data.frameTimes) && data.frameTimes.length > 0,
    `${data.frameTimes?.length} samples`);
  ok('fps is reasonable', data.avgFps > 1 && data.avgFps < 500, `${data.avgFps} FPS`);
}
