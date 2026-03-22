/** Annotated screenshot — scene capture with text labels on named objects. */
import type { Handler } from '../types.js';

export const annotatedScreenshotHandler: Handler = (ctx, params) => {
  const r = ctx.renderer;
  const canvas = r.domElement as HTMLCanvasElement;
  const w = (params.width as number) || canvas.width;
  const h = (params.height as number) || canvas.height;

  let cam = ctx.camera;
  if (!cam) ctx.scene.traverse((o: any) => { if (!cam && o.isCamera) cam = o; });
  if (!cam) return { error: 'No camera found' };

  r.render(ctx.scene, cam);

  // Collect named objects with screen positions
  const V3 = (ctx.scene.position as any).constructor;
  const labels: Array<{ name: string; x: number; y: number; type: string }> = [];

  ctx.scene.traverse((obj: any) => {
    if (!obj.name || obj === ctx.scene || obj.visible === false) return;
    const pos = new V3();
    obj.getWorldPosition(pos);
    pos.project(cam);
    if (pos.z < -1 || pos.z > 1) return; // behind camera
    const sx = ((pos.x + 1) / 2) * w;
    const sy = ((1 - pos.y) / 2) * h;
    if (sx >= 0 && sx <= w && sy >= 0 && sy <= h) {
      const t = obj.isLight ? 'L' : obj.isMesh ? 'M' : obj.isCamera ? 'C' : obj.isGroup ? 'G' : '';
      labels.push({ name: obj.name, x: sx, y: sy, type: t });
    }
  });

  // Cap at 60 labels (closest to camera first)
  if (labels.length > 60) labels.splice(60);

  // Composite canvas
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const c = off.getContext('2d')!;
  c.drawImage(canvas, 0, 0, w, h);

  const fs = Math.max(11, Math.round(h / 55));
  c.font = `bold ${fs}px system-ui,sans-serif`;
  c.textBaseline = 'bottom';

  for (const l of labels) {
    const text = l.type ? `[${l.type}] ${l.name}` : l.name;
    const tw = c.measureText(text).width;
    const px = 5, py = 3;
    const pw = tw + px * 2, ph = fs + py * 2;
    const rx = Math.max(0, Math.min(l.x - pw / 2, w - pw));
    const ry = Math.max(0, l.y - 10 - ph);

    // Line from dot to pill
    c.beginPath();
    c.moveTo(l.x, l.y);
    c.lineTo(rx + pw / 2, ry + ph);
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.lineWidth = 1.5;
    c.stroke();

    // Dot
    c.beginPath();
    c.arc(l.x, l.y, 3, 0, Math.PI * 2);
    c.fillStyle = '#22c55e';
    c.fill();

    // Pill background
    c.beginPath();
    if (c.roundRect) c.roundRect(rx, ry, pw, ph, 4);
    else c.rect(rx, ry, pw, ph);
    c.fillStyle = 'rgba(0,0,0,0.8)';
    c.fill();

    // Text
    c.fillStyle = '#fff';
    c.fillText(text, rx + px, ry + ph - py);
  }

  return {
    dataUrl: off.toDataURL('image/png'),
    width: w, height: h,
    labelCount: labels.length,
  };
};
