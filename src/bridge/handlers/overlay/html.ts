/**
 * Create overlay DOM elements and attach header events.
 */
import type { ThreeContext } from '../../types.js';
import { CSS } from './css.js';
import { _selectedUuid, destroyOverlay } from './helpers.js';

export function createOverlayDOM(ctx: ThreeContext): { root: HTMLElement; selectedObj: any } {
  destroyOverlay();

  const style = document.createElement('style');
  style.id = '__tdt_s';
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = '__tdt';
  document.body.appendChild(root);

  let selectedObj: any = null;

  // Restore selection
  if (_selectedUuid) {
    ctx.scene?.traverse((o: any) => {
      if (o.uuid === _selectedUuid) selectedObj = o;
    });
  }

  root.innerHTML = `
    <div class="__hdr">
      <div class="__htitle"><div class="__hdot"></div>THREE.JS DEVTOOLS</div>
      <div class="__hbtns">
        <button class="__hb" id="__tdt_min" title="Minimize">\u2500</button>
        <button class="__hb" id="__tdt_x" title="Close">\u2715</button>
      </div>
    </div>
    <div class="__body">
      <div class="__s">
        <div class="__sh open" data-s="perf">
          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>PERFORMANCE</div>
        <div class="__sb open">
          <div class="__g">
            <div class="__st g"><div class="__sl">FPS</div><div class="__sv" id="__fps">\u2013</div></div>
            <div class="__st b"><div class="__sl">Draws</div><div class="__sv" id="__draws">\u2013</div></div>
            <div class="__st y"><div class="__sl">Tris</div><div class="__sv" id="__tris">\u2013</div></div>
            <div class="__st p"><div class="__sl">Objects</div><div class="__sv" id="__objs">\u2013</div></div>
            <div class="__st c"><div class="__sl">Geom</div><div class="__sv" id="__geos">\u2013</div></div>
            <div class="__st o"><div class="__sl">Tex</div><div class="__sv" id="__texs">\u2013</div></div>
          </div>
        </div>
      </div>
      <div class="__s">
        <div class="__sh open" data-s="tree">
          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>SCENE GRAPH<span class="c" id="__tcnt">0</span></div>
        <div class="__sb open">
          <div class="__tree" id="__tree"></div>
          <div id="__det"></div>
        </div>
      </div>
      <div class="__s">
        <div class="__sh" data-s="mats">
          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>MATERIALS<span class="c" id="__mcnt">0</span></div>
        <div class="__sb"><div class="__bl" id="__mats"></div></div>
      </div>
      <div class="__s">
        <div class="__sh" data-s="lts">
          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>LIGHTS<span class="c" id="__lcnt">0</span></div>
        <div class="__sb"><div class="__bl" id="__lts"></div></div>
      </div>
    </div>
  `;

  // Events
  document.getElementById('__tdt_x')!.onclick = () => destroyOverlay();
  document.getElementById('__tdt_min')!.onclick = () => root.classList.toggle('mini');
  root.addEventListener('click', (e) => {
    if (root.classList.contains('mini') && !(e.target as HTMLElement).closest('.__hb'))
      root.classList.remove('mini');
  });

  root.querySelectorAll('.__sh').forEach(h => {
    h.addEventListener('click', () => {
      h.classList.toggle('open');
      (h.nextElementSibling as HTMLElement)?.classList.toggle('open');
    });
  });

  // Drag
  const hdr = root.querySelector('.__hdr') as HTMLElement;
  let drag = false, dx = 0, dy = 0;
  hdr.onmousedown = (e) => {
    if ((e.target as HTMLElement).closest('.__hb')) return;
    drag = true; dx = e.clientX - root.offsetLeft; dy = e.clientY - root.offsetTop; e.preventDefault();
  };
  document.addEventListener('mousemove', (e) => { if (!drag) return; root.style.left = (e.clientX - dx) + 'px'; root.style.top = (e.clientY - dy) + 'px'; root.style.right = 'auto'; });
  document.addEventListener('mouseup', () => { drag = false; });

  return { root, selectedObj };
}
