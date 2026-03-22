/**
 * Overlay handler — lightweight scene inspector panel.
 * Orchestrates DOM creation, tree, details, sections, and loop.
 */
import type { Handler, ThreeContext } from '../../types.js';
import { discoverThreeJS } from '../../discovery/index.js';
import { destroyOverlay, highlightObject, setSelectedUuid, _selectedUuid } from './helpers.js';
import { createOverlayDOM } from './html.js';
import { buildTree } from './tree.js';
import { showDetails, updateDetailsLive } from './details.js';
import { showMaterialDetails } from './material-details.js';
import { updateMaterials, updateLights } from './sections.js';
import { startLoop } from './loop.js';
import { collectObjectInfo } from './collect.js';

/** Get fresh ctx — camera/renderer may have appeared after auto-show */
function freshCtx(stale: ThreeContext): ThreeContext {
  return discoverThreeJS() || stale;
}

function buildOverlay(ctx: ThreeContext): void {
  const { root, selectedObj: initialSelected } = createOverlayDOM(ctx);
  let selectedObj = initialSelected;

  const treeContainer = document.getElementById('__tree');
  const det = document.getElementById('__det');

  function selectObject(obj: any): void {
    treeContainer?.querySelectorAll('.__tr.sel').forEach(n => n.classList.remove('sel'));
    setSelectedUuid(obj.uuid);
    selectedObj = obj;
    (window as any).__tdt_selected = obj;
    highlightObject(obj);
    showDetails(obj, det, freshCtx(ctx));
  }

  function doBuildTree(): void {
    buildTree(ctx, treeContainer, { onSelect: selectObject });
    if (selectedObj && _selectedUuid) highlightObject(selectedObj);
  }

  function doUpdateMaterials(): void {
    updateMaterials(ctx, {
      onMaterialClick: (m) => showMaterialDetails(m, det, freshCtx(ctx)),
    });
  }

  if (selectedObj) {
    highlightObject(selectedObj);
    showDetails(selectedObj, det, freshCtx(ctx));
  }

  startLoop(ctx, {
    buildTree: doBuildTree,
    updateMaterials: doUpdateMaterials,
    updateLights: () => updateLights(ctx),
    updateDetailsLive: () => updateDetailsLive(selectedObj),
  });
}

export const toggleOverlayHandler: Handler = (ctx, params) => {
  const enabled = params.enabled as boolean | undefined;
  const isVisible = !!document.getElementById('__tdt');
  const shouldShow = enabled !== undefined ? enabled : !isVisible;

  if (shouldShow) {
    try {
      buildOverlay(ctx);
      const exists = !!document.getElementById('__tdt');
      return { visible: exists, message: exists ? 'Overlay shown' : 'Overlay element not found after build' };
    } catch (e: any) {
      return { visible: false, error: e.message, stack: e.stack?.split('\n').slice(0, 5) };
    }
  } else {
    destroyOverlay();
    return { visible: false, message: 'Overlay hidden' };
  }
};

export const overlaySelectedHandler: Handler = (_ctx) => {
  const w = window as any;
  const obj = w.__tdt_selected;
  if (!obj) {
    return { error: 'No object selected in overlay. Open the overlay (toggle_overlay) and click an object in the scene tree first.' };
  }
  return collectObjectInfo(obj);
};

export function autoShowOverlay(ctx: ThreeContext): void {
  if (document.getElementById('__tdt')) return;
  try {
    buildOverlay(ctx);
  } catch (e) {
    console.warn('[threejs-devtools-mcp] Auto-overlay failed:', e);
  }
}
