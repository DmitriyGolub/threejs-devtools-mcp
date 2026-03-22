/**
 * Object details panel.
 */
import type { ThreeContext } from '../../types.js';
import { readColorHex } from '../color-utils.js';
import { getTypeInfo, fmt, esc, colorCSS, restoreHighlight, setSelectedUuid, copyToClipboard } from './helpers.js';
import { collectObjectInfo } from './collect.js';
import { objectPreview } from './preview.js';

function r(k: string, v: string, liveId?: string): string {
  const idAttr = liveId ? ` id="${liveId}"` : '';
  return `<div class="__dr"><span class="__dk">${k}</span><span class="__dv"${idAttr}>${v}</span></div>`;
}
function v3(v: any): string { return `${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)}`; }
function deg(rot: any): string { return `${(rot.x*180/Math.PI).toFixed(0)}\u00B0 ${(rot.y*180/Math.PI).toFixed(0)}\u00B0 ${(rot.z*180/Math.PI).toFixed(0)}\u00B0`; }

export function showDetails(obj: any, det: HTMLElement | null, ctx?: ThreeContext): void {
  if (!det) return;
  const info = getTypeInfo(obj);
  const name = obj.name || '(unnamed)';
  const rows: string[] = [];

  rows.push(r('Type', obj.type || '?'));
  if (obj.position) rows.push(r('Position', v3(obj.position), '__lv_pos'));
  if (obj.rotation) rows.push(r('Rotation', deg(obj.rotation), '__lv_rot'));
  if (obj.scale && (obj.scale.x !== 1 || obj.scale.y !== 1 || obj.scale.z !== 1))
    rows.push(r('Scale', v3(obj.scale), '__lv_scl'));

  if (obj.geometry) {
    const verts = obj.geometry.attributes?.position?.count || 0;
    rows.push(r('Vertices', fmt(verts)));
    if (obj.geometry.index) rows.push(r('Faces', fmt(obj.geometry.index.count / 3)));
  }

  if (obj.material) {
    const m = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    if (m) {
      rows.push(r('Material', esc(m.name || m.type)));
      if (m.color) {
        rows.push(`<div class="__dr"><span class="__dk">Color</span><span class="__dv"><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${colorCSS(m.color)};vertical-align:middle;margin-right:4px;border:1px solid rgba(255,255,255,.08)"></span>${readColorHex(m.color)}</span></div>`);
      }
    }
  }

  if (obj.isLight) {
    rows.push(r('Intensity', obj.intensity?.toFixed(2), '__lv_int'));
    if (obj.castShadow) rows.push(r('Shadows', '<span style="color:var(--grn)">On</span>'));
  }
  if (obj.isInstancedMesh) rows.push(r('Instances', obj.count + ' / ' + (obj.instanceMatrix?.count || '?')));
  rows.push(r('Visible', obj.visible
    ? '<span style="color:var(--grn)">Yes</span>'
    : '<span style="color:var(--red)">No</span>', '__lv_vis'));
  const kc = (obj.children || []).length;
  if (kc > 0) rows.push(r('Children', String(kc)));

  const pvPlaceholder = (obj.isMesh || obj.isGroup || obj.isScene) ? '<div class="__pv_wrap" id="__pv_wrap"><div class="__pv_loading">rendering...</div></div>' : '';
  det.innerHTML = `<div class="__det"><div class="__dh"><span class="__ti ${info.cls}">${info.tag}</span>${esc(name)}<span class="__dc" id="__dc">\u2715</span></div>${pvPlaceholder}${rows.join('')}<button class="__cp" id="__cpbtn" title="Copy object info to clipboard for AI agent">Copy for Agent</button></div>`;

  // Render interactive preview
  if (ctx && (obj.isMesh || obj.isGroup || obj.isScene)) {
    const wrap = det.querySelector('.__pv_wrap') as HTMLElement | null;
    if (wrap) {
      const cleanup = objectPreview(ctx, wrap, obj);
      if (!cleanup) wrap.remove();
    }
  }

  document.getElementById('__dc')!.onclick = () => {
    det.innerHTML = '';
    setSelectedUuid(null);
    (window as any).__tdt_selected = null;
    const w = window as any;
    if (w.__tdt_highlighted) { restoreHighlight(w.__tdt_highlighted); w.__tdt_highlighted = null; }
  };

  document.getElementById('__cpbtn')!.onclick = () => {
    copyToClipboard(collectObjectInfo(obj), '__cpbtn');
  };
}

export function updateDetailsLive(selectedObj: any): void {
  if (!selectedObj) return;
  const obj = selectedObj;
  const p = document.getElementById('__lv_pos');
  if (p && obj.position) p.textContent = v3(obj.position);
  const ro = document.getElementById('__lv_rot');
  if (ro && obj.rotation) ro.textContent = deg(obj.rotation);
  const s = document.getElementById('__lv_scl');
  if (s && obj.scale) s.textContent = v3(obj.scale);
  const int = document.getElementById('__lv_int');
  if (int && obj.intensity !== undefined) int.textContent = obj.intensity.toFixed(2);
  const vis = document.getElementById('__lv_vis');
  if (vis) {
    vis.innerHTML = obj.visible
      ? '<span style="color:var(--grn)">Yes</span>'
      : '<span style="color:var(--red)">No</span>';
  }
}
