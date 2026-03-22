/** Annotated screenshot — scene capture with text labels on ALL named objects. */
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

  // Collect ALL named objects with screen positions (full scene traverse)
  const V3 = (ctx.scene.position as any).constructor;
  type Label = { name: string; x: number; y: number; type: string; lx: number; ly: number };
  const labels: Label[] = [];

  ctx.scene.traverse((obj: any) => {
    if (!obj.name || obj === ctx.scene || obj.visible === false) return;
    const pos = new V3();
    obj.getWorldPosition(pos);
    pos.project(cam);
    if (pos.z < -1 || pos.z > 1) return;
    const sx = ((pos.x + 1) / 2) * w;
    const sy = ((1 - pos.y) / 2) * h;
    if (sx >= 0 && sx <= w && sy >= 0 && sy <= h) {
      const t = obj.isLight ? 'L' : obj.isInstancedMesh ? 'IM' : obj.isMesh ? 'M' : obj.isCamera ? 'C' : obj.isGroup ? 'G' : '';
      labels.push({ name: obj.name, x: sx, y: sy, type: t, lx: 0, ly: 0 });
    }
  });

  // Sort by Y then X for anti-overlap
  labels.sort((a, b) => a.y - b.y || a.x - b.x);

  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const c = off.getContext('2d')!;
  c.drawImage(canvas, 0, 0, w, h);

  const fs = Math.max(10, Math.round(h / 60));
  c.font = `bold ${fs}px system-ui,sans-serif`;
  c.textBaseline = 'bottom';
  const pad = 4, gap = 2;
  const ph = fs + pad * 2;

  // Calculate pill rects with anti-overlap
  const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (const l of labels) {
    const text = l.type ? `[${l.type}] ${l.name}` : l.name;
    const pw = c.measureText(text).width + pad * 2;
    let rx = Math.max(0, Math.min(l.x - pw / 2, w - pw));
    let ry = Math.max(0, l.y - 10 - ph);
    // Push down if overlapping with any placed label
    for (let tries = 0; tries < 8; tries++) {
      const hit = placed.some(p => rx < p.x + p.w && rx + pw > p.x && ry < p.y + p.h && ry + ph > p.y);
      if (!hit) break;
      ry += ph + gap;
      if (ry + ph > h) { ry = Math.max(0, l.y - 10 - ph - (tries + 1) * (ph + gap)); break; }
    }
    l.lx = rx; l.ly = ry;
    placed.push({ x: rx, y: ry, w: pw, h: ph });
  }

  // Draw
  for (const l of labels) {
    const text = l.type ? `[${l.type}] ${l.name}` : l.name;
    const pw = c.measureText(text).width + pad * 2;

    // Line
    c.beginPath();
    c.moveTo(l.x, l.y);
    c.lineTo(l.lx + pw / 2, l.ly + ph);
    c.strokeStyle = 'rgba(0,0,0,0.4)';
    c.lineWidth = 1;
    c.stroke();

    // Dot
    c.beginPath();
    c.arc(l.x, l.y, 2.5, 0, Math.PI * 2);
    c.fillStyle = '#22c55e';
    c.fill();

    // Pill
    c.beginPath();
    if (c.roundRect) c.roundRect(l.lx, l.ly, pw, ph, 3);
    else c.rect(l.lx, l.ly, pw, ph);
    c.fillStyle = 'rgba(0,0,0,0.8)';
    c.fill();

    // Text
    c.fillStyle = '#fff';
    c.fillText(text, l.lx + pad, l.ly + ph - pad);
  }

  return { dataUrl: off.toDataURL('image/png'), width: w, height: h, labelCount: labels.length };
};
