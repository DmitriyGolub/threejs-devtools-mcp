import type { Handler } from '../types.js';

export const perfMonitorHandler: Handler = (_ctx, params) => {
  const duration = Math.min(Math.max((params.duration as number) || 3, 0.5), 30);
  const includeFrameTimes = params.includeFrameTimes === true;  // off by default — saves tokens

  return new Promise((resolve) => {
    const frameTimes: number[] = [];
    let lastTime = 0;
    const endTime = performance.now() + duration * 1000;

    function measure(now: number) {
      if (lastTime > 0) frameTimes.push(now - lastTime);
      lastTime = now;
      if (now < endTime) requestAnimationFrame(measure);
      else resolve(computeStats(frameTimes, duration, includeFrameTimes));
    }

    requestAnimationFrame(measure);
  });
};

function computeStats(frameTimes: number[], duration: number, includeRaw: boolean) {
  if (frameTimes.length === 0) return { error: 'No frames recorded' };

  const total = frameTimes.length;
  const sum = frameTimes.reduce((a, b) => a + b, 0);
  const avg = sum / total;
  const min = Math.min(...frameTimes);
  const max = Math.max(...frameTimes);
  const spikes = frameTimes.filter(t => t > 33.3).length;
  const janks = frameTimes.filter(t => t > 50).length;

  // Percentiles
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(total * 0.5)];
  const p95 = sorted[Math.floor(total * 0.95)];
  const p99 = sorted[Math.floor(total * 0.99)];

  return {
    totalFrames: total,
    duration: +(sum / 1000).toFixed(2),
    avgFps: +(1000 / avg).toFixed(1),
    minFps: +(1000 / max).toFixed(1),
    maxFps: +(1000 / min).toFixed(1),
    avgFrameTime: +avg.toFixed(2),
    minFrameTime: +min.toFixed(2),
    maxFrameTime: +max.toFixed(2),
    p50: +p50.toFixed(2),
    p95: +p95.toFixed(2),
    p99: +p99.toFixed(2),
    spikes: spikes,
    janks: janks,
    ...(includeRaw ? { frameTimes: frameTimes.map(t => +t.toFixed(2)) } : {}),
  };
}
