/** Annotated screenshot — scene capture with smart-filtered object labels. */
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

  const V3 = (ctx.scene.position as any).constructor;
  type Label = { name: string; x: number; y: number; type: string; lx: number; ly: number };
  const raw: Label[] = [];

  ctx.scene.traverse((obj: any) => {
    if (!obj.name || obj === ctx.scene || obj.visible === false) return;
    if (obj.isBone || obj.isHelper) return;
    if (obj.type === 'Bone' || obj.name === 'Armature') return;
    // Skip ANY object at world origin (0,0,0) — not meaningful position
    const pos = new V3(); obj.getWorldPosition(pos);
    if (Math.abs(pos.x) < 0.01 && Math.abs(pos.y) < 0.01 && Math.abs(pos.z) < 0.01) return;
    pos.project(cam);
    if (pos.z < -1 || pos.z > 1) return;
    const sx = ((pos.x + 1) / 2) * w, sy = ((1 - pos.y) / 2) * h;
    if (sx < 0 || sx > w || sy < 0 || sy > h) return;
    const t = obj.isLight ? 'L' : obj.isInstancedMesh ? 'IM' : obj.isSkinnedMesh ? 'SK'
      : obj.isMesh ? 'M' : obj.isCamera ? 'C' : obj.isGroup ? 'G' : '';
    raw.push({ name: obj.name, x: sx, y: sy, type: t, lx: 0, ly: 0 });
  });

  // Smart filter: group by base name
  const labels: Label[] = [];
  const groups = new Map<string, Label[]>();
  for (const l of raw) {
    const base = l.name.replace(/_\d+(_\d+)*$/, '');
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base)!.push(l);
  }
  for (const [base, items] of groups) {
    if (items.length <= 2) { labels.push(...items); continue; }
    // Pick member closest to camera (highest screen Y = most visible, bottom of screen)
    items.sort((a, b) => b.y - a.y);
    labels.push({ ...items[0], name: `${base} (\u00D7${items.length})` });
  }

  // Spread clustered labels: if multiple labels within 50px, distribute in a circle
  const spreadR = 180;
  const used = new Set<number>();
  for (let i = 0; i < labels.length; i++) {
    if (used.has(i)) continue;
    const cluster = [i];
    for (let j = i + 1; j < labels.length; j++) {
      if (used.has(j)) continue;
      const dx = labels[j].x - labels[i].x, dy = labels[j].y - labels[i].y;
      if (dx * dx + dy * dy < 50 * 50) cluster.push(j);
    }
    if (cluster.length <= 1) continue;
    const cx = cluster.reduce((s, k) => s + labels[k].x, 0) / cluster.length;
    const cy = cluster.reduce((s, k) => s + labels[k].y, 0) / cluster.length;
    for (let k = 0; k < cluster.length; k++) {
      const angle = (k / cluster.length) * Math.PI * 2 - Math.PI / 2;
      const ri = spreadR * Math.min(1, cluster.length / 6);
      labels[cluster[k]].lx = cx + Math.cos(angle) * ri;
      labels[cluster[k]].ly = cy + Math.sin(angle) * ri;
      used.add(cluster[k]);
    }
  }
  // Labels not in clusters: pill above dot
  for (let i = 0; i < labels.length; i++) {
    if (!used.has(i)) { labels[i].lx = labels[i].x; labels[i].ly = labels[i].y - 20; }
  }

  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const c = off.getContext('2d')!;
  c.drawImage(canvas, 0, 0, w, h);

  const fs = Math.max(11, Math.round(h / 55));
  c.font = `bold ${fs}px system-ui,sans-serif`;
  c.textBaseline = 'middle';
  const pad = 5, ph = fs + pad * 2;

  // Final overlap nudge
  const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (const l of labels) {
    const text = l.type ? `[${l.type}] ${l.name}` : l.name;
    const pw = c.measureText(text).width + pad * 2;
    let rx = Math.max(0, Math.min(l.lx - pw / 2, w - pw));
    let ry = Math.max(0, Math.min(l.ly - ph / 2, h - ph));
    for (let t = 0; t < 10; t++) {
      if (!placed.some(p => rx < p.x + p.w + 2 && rx + pw + 2 > p.x && ry < p.y + p.h + 2 && ry + ph + 2 > p.y)) break;
      ry += ph + 3;
      if (ry + ph > h) { ry = Math.max(0, l.ly - ph / 2 - (t + 1) * (ph + 3)); break; }
    }
    l.lx = rx; l.ly = ry;
    placed.push({ x: rx, y: ry, w: pw, h: ph });
  }

  // Draw
  for (const l of labels) {
    const text = l.type ? `[${l.type}] ${l.name}` : l.name;
    const pw = c.measureText(text).width + pad * 2;
    c.beginPath(); c.moveTo(l.x, l.y); c.lineTo(l.lx + pw / 2, l.ly + ph / 2);
    c.strokeStyle = 'rgba(255,255,255,0.2)'; c.lineWidth = 1; c.stroke();
    c.beginPath(); c.arc(l.x, l.y, 3, 0, Math.PI * 2);
    c.fillStyle = '#22c55e'; c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke();
    c.beginPath();
    if (c.roundRect) c.roundRect(l.lx, l.ly, pw, ph, 4); else c.rect(l.lx, l.ly, pw, ph);
    c.fillStyle = 'rgba(0,0,0,0.82)'; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.1)'; c.lineWidth = 0.5; c.stroke();
    c.fillStyle = '#fff'; c.fillText(text, l.lx + pad, l.ly + ph / 2);
  }

  return { dataUrl: off.toDataURL('image/png'), width: w, height: h, labelCount: labels.length, totalObjects: raw.length };
};
