/**
 * Scene graph tree builder.
 */
import type { ThreeContext } from '../../types.js';
import { _expandedPaths, _selectedUuid, _treeScroll, setTreeScroll, getTypeInfo } from './helpers.js';

export interface TreeCallbacks { onSelect: (obj: any) => void; }

export function buildTree(ctx: ThreeContext, container: HTMLElement | null, callbacks: TreeCallbacks): void {
  if (!container || !ctx.scene) return;
  setTreeScroll(container.scrollTop);
  let count = 0;
  const frag = document.createDocumentFragment();

  function createNode(obj: any, depth: number, parentPath: string, parentEl: HTMLElement | DocumentFragment): void {
    if (depth > 10) return;
    count++;
    const path = parentPath + '/' + (obj.uuid?.slice(0, 8) || '?');
    const info = getTypeInfo(obj);
    const kids = (obj.children || []).filter((c: any) => c.name !== '__tdt_highlight_box');
    const hasKids = kids.length > 0;
    const isExpanded = _expandedPaths.has(path) || (depth < 1);
    const wrap = document.createElement('div');

    const row = document.createElement('div');
    row.className = '__tr' + (obj.uuid === _selectedUuid ? ' sel' : '');
    row.style.paddingLeft = (8 + depth * 14) + 'px';

    const arrow = document.createElement('span');
    arrow.className = '__ta' + (hasKids ? (isExpanded ? ' open' : '') : ' no');
    arrow.textContent = '\u203A';
    row.appendChild(arrow);

    if (obj.isInstancedMesh) {
      const b1 = document.createElement('span'); b1.className = '__ti inst'; b1.textContent = 'I';
      const b2 = document.createElement('span'); b2.className = '__ti mesh'; b2.textContent = 'M';
      row.appendChild(b1); row.appendChild(b2);
    } else {
      const badge = document.createElement('span');
      badge.className = '__ti ' + info.cls; badge.textContent = info.tag;
      row.appendChild(badge);
    }

    const nameEl = document.createElement('span');
    nameEl.className = '__tn';
    nameEl.textContent = obj.name || '(unnamed)';
    row.appendChild(nameEl);

    if (obj.visible === false) {
      const hid = document.createElement('span');
      hid.className = '__th'; hid.textContent = 'HIDDEN';
      row.appendChild(hid);
    }
    if (obj.isInstancedMesh && obj.count > 0) {
      const ext = document.createElement('span');
      ext.className = '__tx'; ext.textContent = '\u00D7' + obj.count;
      row.appendChild(ext);
    } else if (obj.isLight && obj.intensity !== undefined) {
      const ext = document.createElement('span');
      ext.className = '__tx'; ext.textContent = obj.intensity.toFixed(1);
      row.appendChild(ext);
    }
    wrap.appendChild(row);

    const kidsEl = document.createElement('div');
    kidsEl.className = '__tk' + (isExpanded ? ' open' : '');
    wrap.appendChild(kidsEl);

    function populateChildren(): void {
      if (kidsEl.children.length > 0) return;
      const limit = 50;
      for (let i = 0; i < Math.min(kids.length, limit); i++) createNode(kids[i], depth + 1, path, kidsEl);
      if (kids.length > limit) {
        const more = document.createElement('div');
        more.className = '__tr';
        more.style.paddingLeft = (8 + (depth + 1) * 14) + 'px';
        const moreText = document.createElement('span');
        moreText.className = '__tn'; moreText.style.color = 'var(--fg3)';
        moreText.textContent = `+${kids.length - limit} more\u2026`;
        more.appendChild(moreText); kidsEl.appendChild(more);
      }
    }

    if (hasKids && isExpanded) populateChildren();
    if (hasKids) {
      arrow.addEventListener('click', (e) => {
        e.stopPropagation();
        const nowOpen = arrow.classList.toggle('open');
        kidsEl.classList.toggle('open');
        if (nowOpen) { _expandedPaths.add(path); populateChildren(); }
        else { _expandedPaths.delete(path); }
      });
    }
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      container?.querySelectorAll('.__tr.sel').forEach(n => n.classList.remove('sel'));
      row.classList.add('sel');
      callbacks.onSelect(obj);
    });
    parentEl.appendChild(wrap);
  }

  createNode(ctx.scene, 0, '', frag);
  container.innerHTML = '';
  container.appendChild(frag);
  container.scrollTop = _treeScroll;
  const cnt = document.getElementById('__tcnt');
  if (cnt) cnt.textContent = String(count);
}
