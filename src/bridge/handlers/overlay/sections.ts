/**
 * Materials and Lights section updates.
 */
import type { ThreeContext } from '../../types.js';
import { readColorHex } from '../color-utils.js';
import { esc, colorCSS } from './helpers.js';

export interface SectionCallbacks {
  onMaterialClick: (m: any) => void;
}

export function updateMaterials(ctx: ThreeContext, callbacks: SectionCallbacks): void {
  const el = document.getElementById('__mats');
  if (!el) return;
  const seen = new Map<string, any>();
  ctx.scene?.traverse((o: any) => {
    if (!o.material) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) {
      if (!seen.has(m.uuid)) seen.set(m.uuid, m);
    }
  });

  el.innerHTML = '';
  for (const [, m] of seen) {
    const badge = document.createElement('div');
    badge.className = '__bd';
    badge.style.cursor = 'pointer';

    const col = colorCSS(m.color);
    const rough = m.roughness !== undefined ? m.roughness : 0.5;
    const metal = m.metalness !== undefined ? m.metalness : 0;
    const spread = 30 + rough * 40;
    const highlightOpacity = 0.3 + (1 - rough) * 0.7;
    const highlightColor = metal > 0.5
      ? col
      : `rgba(255,255,255,${highlightOpacity.toFixed(2)})`;
    const sphereGradient = `radial-gradient(circle at 30% 28%, ${highlightColor} 0%, ${col} ${spread}%, rgba(0,0,0,0.8) 100%)`;

    const rows: string[] = [];
    rows.push(`<div class="__mt_k" style="text-align:center;margin-bottom:4px;font-weight:600;color:var(--fg)">${esc(m.type)}</div>`);
    if (m.color) rows.push(`<div class="__mt_row"><span class="__mt_k">Color</span><span class="__mt_v">${readColorHex(m.color)}</span></div>`);
    if (m.roughness !== undefined) rows.push(`<div class="__mt_row"><span class="__mt_k">Rough</span><span class="__mt_v">${m.roughness.toFixed(2)}</span></div>`);
    if (m.metalness !== undefined) rows.push(`<div class="__mt_row"><span class="__mt_k">Metal</span><span class="__mt_v">${m.metalness.toFixed(2)}</span></div>`);
    rows.push(`<div class="__mt_row"><span class="__mt_k">Opacity</span><span class="__mt_v">${m.opacity.toFixed(2)}</span></div>`);
    if (m.map) rows.push(`<div class="__mt_row"><span class="__mt_k">Map</span><span class="__mt_v">${m.map.image ? m.map.image.width + '\u00D7' + m.map.image.height : 'yes'}</span></div>`);
    if (m.normalMap) rows.push(`<div class="__mt_row"><span class="__mt_k">Normal</span><span class="__mt_v">yes</span></div>`);

    badge.innerHTML = `<span class="dot" style="background:${col}"></span>${esc(m.name || m.type)}<div class="__mt"><div class="__mt_sphere" style="background:${sphereGradient}"></div>${rows.join('')}</div>`;
    badge.addEventListener('click', () => callbacks.onMaterialClick(m));
    el.appendChild(badge);
  }

  const c = document.getElementById('__mcnt');
  if (c) c.textContent = String(seen.size);
}

export function updateLights(ctx: ThreeContext): void {
  const el = document.getElementById('__lts');
  if (!el) return;
  const badges: string[] = [];
  let n = 0;
  ctx.scene?.traverse((o: any) => {
    if (!o.isLight) return; n++;
    badges.push(`<div class="__bd"><span class="dot" style="background:${colorCSS(o.color)}"></span>${esc(o.name || o.type)} (${o.intensity?.toFixed(1)})</div>`);
  });
  el.innerHTML = badges.length ? badges.join('') : '<span style="color:var(--fg3)">No lights</span>';
  const c = document.getElementById('__lcnt');
  if (c) c.textContent = String(n);
}
