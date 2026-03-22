/**
 * Overlay shared state and helper functions.
 */
export const _expandedPaths = new Set<string>();
export let _selectedUuid: string | null = null;
export let _treeScroll = 0;

export function setSelectedUuid(uuid: string | null): void { _selectedUuid = uuid; }
export function setTreeScroll(v: number): void { _treeScroll = v; }

export function destroyOverlay(): void {
  const el = document.getElementById('__tdt');
  if (el) el.remove();
  const st = document.getElementById('__tdt_s');
  if (st) st.remove();
  const w = window as any;
  if (w.__tdt_raf) { cancelAnimationFrame(w.__tdt_raf); w.__tdt_raf = null; }
  if (w.__tdt_highlighted) {
    try { restoreHighlight(w.__tdt_highlighted); } catch { /* */ }
    w.__tdt_highlighted = null;
  }
}

export function highlightObject(obj: any): void {
  const w = window as any;
  if (w.__tdt_highlighted) restoreHighlight(w.__tdt_highlighted);
  const data: any = { obj, originals: [] };
  if (obj.isMesh || obj.isLine || obj.isPoints || obj.isInstancedMesh) {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (m) {
        data.originals.push({ mat: m, wireframe: m.wireframe, emissive: m.emissive?.clone?.() });
        m.wireframe = true;
        if (m.emissive) m.emissive.setRGB(0.05, 0.25, 0.1);
      }
    }
  }
  w.__tdt_highlighted = data;
}

export function restoreHighlight(data: any): void {
  if (!data) return;
  for (const o of data.originals) {
    if (o.mat) {
      o.mat.wireframe = o.wireframe;
      if (o.emissive && o.mat.emissive) o.mat.emissive.copy(o.emissive);
    }
  }
}

export function getTypeInfo(obj: any): { tag: string; cls: string } {
  if (obj.isInstancedMesh) return { tag: 'IM', cls: 'inst' };
  if (obj.isSkinnedMesh) return { tag: 'SK', cls: 'mesh' };
  if (obj.isMesh) return { tag: 'M', cls: 'mesh' };
  if (obj.isLineSegments || obj.isLine) return { tag: 'LN', cls: 'mesh' };
  if (obj.isPoints) return { tag: 'PT', cls: 'pts' };
  if (obj.isPerspectiveCamera || obj.isOrthographicCamera || obj.isCamera) return { tag: 'C', cls: 'cam' };
  if (obj.isLight) return { tag: 'L', cls: 'light' };
  if (obj.isBone) return { tag: 'B', cls: 'bone' };
  if (obj.isScene) return { tag: 'S', cls: 'grp' };
  if (obj.isGroup) return { tag: 'G', cls: 'grp' };
  return { tag: 'O', cls: 'grp' };
}

export function fmt(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function colorCSS(c: any): string {
  if (!c) return '#888';
  const r = Math.round(Math.min(1, Math.pow(c.r, 0.4545)) * 255);
  const g = Math.round(Math.min(1, Math.pow(c.g, 0.4545)) * 255);
  const b = Math.round(Math.min(1, Math.pow(c.b, 0.4545)) * 255);
  return `rgb(${r},${g},${b})`;
}

export function objPath(obj: any): string {
  const parts: string[] = [];
  let cur = obj;
  while (cur) { parts.unshift(cur.uuid?.slice(0, 8) || '?'); cur = cur.parent; }
  return parts.join('/');
}
/** Copy text to clipboard and flash a button label. */
export function copyToClipboard(text: string, btnId: string, label = 'Copy for Agent'): void {
  const flash = () => {
    const btn = document.getElementById(btnId);
    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = label; }, 1500); }
  };
  navigator.clipboard.writeText(text).then(flash).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    flash();
  });
}
