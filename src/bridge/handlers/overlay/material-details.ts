/**
 * Material details panel.
 */
import type { ThreeContext } from '../../types.js';
import { readColorHex } from '../color-utils.js';
import { esc, colorCSS, copyToClipboard } from './helpers.js';
import { materialPreview } from './preview.js';

function r(k: string, v: string): string {
  return `<div class="__dr"><span class="__dk">${k}</span><span class="__dv">${v}</span></div>`;
}

function colorRow(label: string, c: any): string {
  return `<div class="__dr"><span class="__dk">${label}</span><span class="__dv"><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${colorCSS(c)};vertical-align:middle;margin-right:4px;border:1px solid rgba(255,255,255,.08)"></span>${readColorHex(c)}</span></div>`;
}

export function showMaterialDetails(m: any, det: HTMLElement | null, ctx?: ThreeContext): void {
  if (!det) return;
  const rows: string[] = [];
  rows.push(r('Type', m.type || '?'));
  rows.push(r('Name', esc(m.name || '(unnamed)')));
  if (m.color) rows.push(colorRow('Color', m.color));
  if (m.emissive) rows.push(colorRow('Emissive', m.emissive));
  if (m.roughness !== undefined) rows.push(r('Roughness', m.roughness.toFixed(2)));
  if (m.metalness !== undefined) rows.push(r('Metalness', m.metalness.toFixed(2)));
  rows.push(r('Opacity', m.opacity.toFixed(2)));
  rows.push(r('Transparent', m.transparent ? '<span style="color:var(--grn)">Yes</span>' : 'No'));
  rows.push(r('Side', m.side === 0 ? 'Front' : m.side === 1 ? 'Back' : m.side === 2 ? 'Double' : String(m.side)));
  rows.push(r('Wireframe', m.wireframe ? 'Yes' : 'No'));
  if (m.depthWrite === false) rows.push(r('DepthWrite', '<span style="color:var(--red)">Off</span>'));
  if (m.alphaTest > 0) rows.push(r('AlphaTest', m.alphaTest.toFixed(2)));
  if (m.flatShading) rows.push(r('Shading', 'Flat'));
  if (m.envMapIntensity !== undefined) rows.push(r('EnvMap', m.envMapIntensity.toFixed(2)));

  const slots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'envMap', 'bumpMap', 'lightMap'];
  for (const slot of slots) {
    if (m[slot]) {
      const t = m[slot];
      const size = t.image ? `${t.image.width}\u00D7${t.image.height}` : '?';
      rows.push(r(slot, `${esc(t.name || '(unnamed)')} ${size}`));
    }
  }

  if (m.uniforms) {
    const uKeys = Object.keys(m.uniforms).slice(0, 10);
    for (const k of uKeys) {
      const val = m.uniforms[k]?.value;
      let display = '?';
      if (val === null || val === undefined) display = 'null';
      else if (typeof val === 'number') display = val.toFixed(3);
      else if (typeof val === 'boolean') display = String(val);
      else if (val.isColor) display = readColorHex(val);
      else if (val.isVector3) display = `${val.x.toFixed(1)}, ${val.y.toFixed(1)}, ${val.z.toFixed(1)}`;
      else if (val.isVector2) display = `${val.x.toFixed(1)}, ${val.y.toFixed(1)}`;
      else display = typeof val;
      rows.push(r(k, display));
    }
  }

  det.innerHTML = `<div class="__det"><div class="__dh"><span class="__ti mesh">MAT</span>${esc(m.name || m.type)}<span class="__dc" id="__dc">\u2715</span></div><div class="__pv_wrap" id="__pv_wrap"><div class="__pv_loading">rendering...</div></div>${rows.join('')}<button class="__cp" id="__cpbtn">Copy for Agent</button></div>`;

  // Render interactive material preview
  if (ctx) {
    setTimeout(() => {
      const wrap = document.getElementById('__pv_wrap');
      if (!wrap) return;
      const cleanup = materialPreview(ctx, wrap, m);
      if (!cleanup) wrap.remove();
    }, 16);
  }

  document.getElementById('__dc')!.onclick = () => { det.innerHTML = ''; };
  document.getElementById('__cpbtn')!.onclick = () => {
    const info: any = { name: m.name, type: m.type, uuid: m.uuid };
    if (m.color) info.color = readColorHex(m.color);
    if (m.roughness !== undefined) info.roughness = m.roughness;
    if (m.metalness !== undefined) info.metalness = m.metalness;
    info.opacity = m.opacity; info.transparent = m.transparent; info.side = m.side;
    const mapSlots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'];
    const maps: any = {};
    for (const s of mapSlots) { if (m[s]) maps[s] = { name: m[s].name, uuid: m[s].uuid }; }
    if (Object.keys(maps).length) info.textureMaps = maps;
    if (m.uniforms) {
      const u: any = {};
      for (const [k, v] of Object.entries(m.uniforms)) {
        const val = (v as any).value;
        if (typeof val === 'number') u[k] = val;
        else if (val?.isColor) u[k] = readColorHex(val);
        else if (val?.isVector3) u[k] = { x: val.x, y: val.y, z: val.z };
      }
      if (Object.keys(u).length) info.uniforms = u;
    }
    copyToClipboard(JSON.stringify(info, null, 2), '__cpbtn');
  };
}
