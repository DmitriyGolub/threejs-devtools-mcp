/**
 * rAF tick loop — stats, tree rebuild, live details.
 */
import type { ThreeContext } from '../../types.js';
import { fmt } from './helpers.js';

export interface LoopCallbacks {
  buildTree: () => void;
  updateMaterials: () => void;
  updateLights: () => void;
  updateDetailsLive: () => void;
}

export function startLoop(ctx: ThreeContext, callbacks: LoopCallbacks): void {
  const hist: number[] = [];
  let lt = performance.now(), fc = 0;
  let lastObjCount = -1;

  function countObjects(): number {
    let n = 0;
    ctx.scene?.traverse(() => { n++; });
    return n;
  }

  function tick(): void {
    if (!document.getElementById('__tdt')) return;
    fc++;
    const now = performance.now();
    const dt = now - lt;

    if (dt >= 500) {
      const fps = Math.round(fc / (dt / 1000));
      fc = 0; lt = now;

      const fe = document.getElementById('__fps');
      if (fe) {
        fe.textContent = String(fps);
        const card = fe.closest('.__st') as HTMLElement;
        if (card) card.className = '__st ' + (fps >= 55 ? 'g' : fps >= 30 ? 'y' : 'r');
      }

      hist.push(fps); if (hist.length > 50) hist.shift();
      const sp = document.getElementById('__spark');
      if (sp) {
        sp.innerHTML = '';
        const mx = Math.max(...hist, 60);
        for (const f of hist) {
          const c = document.createElement('div');
          c.className = '__sc';
          c.style.height = Math.min(100, (f / mx) * 100) + '%';
          c.style.background = f >= 55 ? 'var(--grn)' : f >= 30 ? 'var(--ylw)' : 'var(--red)';
          sp.appendChild(c);
        }
      }

      const info = ctx.renderer?.info;
      if (info) {
        const d = document.getElementById('__draws'); if (d) d.textContent = fmt(info.render?.calls ?? 0);
        const t = document.getElementById('__tris'); if (t) t.textContent = fmt(info.render?.triangles ?? 0);
        const g = document.getElementById('__geos'); if (g) g.textContent = fmt(info.memory?.geometries ?? 0);
        const x = document.getElementById('__texs'); if (x) x.textContent = fmt(info.memory?.textures ?? 0);
      }
      const oc = countObjects();
      const o = document.getElementById('__objs'); if (o) o.textContent = fmt(oc);

      callbacks.updateDetailsLive();

      if (oc !== lastObjCount) {
        lastObjCount = oc;
        callbacks.buildTree();
        callbacks.updateMaterials();
        callbacks.updateLights();
      }
    }

    (window as any).__tdt_raf = requestAnimationFrame(tick);
  }

  lastObjCount = countObjects();
  callbacks.buildTree();
  callbacks.updateMaterials();
  callbacks.updateLights();

  (window as any).__tdt_raf = requestAnimationFrame(tick);
}
