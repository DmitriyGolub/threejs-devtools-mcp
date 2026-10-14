/**
 * Deterministic frame capture for videos.
 *
 * While capturing, the page runs on virtual time: requestAnimationFrame callbacks
 * are queued instead of scheduled, and performance.now()/Date.now() only advance
 * by exactly 1/fps per frame. Each `frame` step advances the clock, runs the app's
 * own animation loop once and reads the canvas — so the output is smooth at the
 * target fps no matter how slow rendering or transfer is.
 *
 * The server drives the loop: start → frame × N → stop.
 */
import type { Handler } from '../types.js';
import { canvasToDataUrl, type ImageFormat } from './screenshot.js';

interface Session {
  frameMs: number;
  now: number;
  dateOffset: number;
  frame: number;
  queue: Map<number, FrameRequestCallback>;
  nextHandle: number;
  restore: () => void;
}

let session: Session | null = null;

function start(fps: number): Session {
  const realRaf = window.requestAnimationFrame;
  const realCancel = window.cancelAnimationFrame;
  const realPerfNow = performance.now.bind(performance);
  const realDateNow = Date.now;

  const s: Session = {
    frameMs: 1000 / fps,
    now: realPerfNow(),
    dateOffset: realDateNow() - realPerfNow(),
    frame: 0,
    queue: new Map(),
    nextHandle: 1,
    restore: () => {
      window.requestAnimationFrame = realRaf;
      window.cancelAnimationFrame = realCancel;
      performance.now = realPerfNow;
      Date.now = realDateNow;
      // Hand pending callbacks back to the real loop so the app keeps running
      for (const cb of s.queue.values()) realRaf(cb);
      s.queue.clear();
    },
  };

  window.requestAnimationFrame = (cb) => {
    const handle = s.nextHandle++;
    s.queue.set(handle, cb);
    return handle;
  };
  window.cancelAnimationFrame = (handle) => { s.queue.delete(handle); };
  performance.now = () => s.now;
  Date.now = () => Math.round(s.now + s.dateOffset);

  return s;
}

function step(s: Session): void {
  s.now += s.frameMs;
  s.frame++;
  // Callbacks registered during this frame belong to the next one
  const callbacks = [...s.queue.values()];
  s.queue.clear();
  for (const cb of callbacks) {
    try { cb(s.now); } catch (err) { console.warn('[threejs-devtools-mcp] frame callback error:', err); }
  }
}

export const captureFramesHandler: Handler = (ctx, params) => {
  const action = params.action as 'start' | 'frame' | 'stop';

  if (action === 'start') {
    session?.restore();
    session = start((params.fps as number) || 30);
    return { started: true, fps: 1000 / session.frameMs };
  }

  if (action === 'stop') {
    const frames = session?.frame ?? 0;
    session?.restore();
    session = null;
    return { stopped: true, frames };
  }

  if (action === 'frame') {
    if (!session) throw new Error('Capture not started');
    step(session);
    const canvas = ctx.renderer.domElement as HTMLCanvasElement;
    const width = (params.width as number) || canvas.width;
    const height = (params.height as number) || canvas.height;
    return {
      frame: session.frame,
      timeMs: Math.round(session.frame * session.frameMs),
      dataUrl: canvasToDataUrl(canvas, width, height, (params.format as ImageFormat) || 'png'),
    };
  }

  throw new Error(`Unknown action "${action}". Use start, frame or stop.`);
};
