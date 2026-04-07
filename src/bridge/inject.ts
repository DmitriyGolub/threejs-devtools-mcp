/**
 * Three.js DevTools Bridge — entry point.
 * Bundled as a single IIFE with zero dependencies.
 */

import type { BridgeRequest, BridgeResponse, ThreeContext, Handler } from './types.js';
import { discoverThreeJS, setupCapture } from './discovery/index.js';
import { sceneTreeHandler, objectDetailsHandler } from './handlers/scene.js';
import { materialListHandler, materialDetailsHandler } from './handlers/material.js';
import { shaderSourceHandler, shaderListHandler } from './handlers/shader.js';
import { textureListHandler, textureDetailsHandler } from './handlers/texture.js';
import { rendererInfoHandler } from './handlers/renderer.js';
import { screenshotHandler } from './handlers/screenshot.js';
import { annotatedScreenshotHandler } from './handlers/annotated-screenshot.js';
import {
  setMaterialPropertyHandler,
  setUniformHandler,
  setObjectTransformHandler,
  setLightHandler,
  highlightObjectHandler,
  runJsHandler,
  performanceSnapshotHandler,
  instancedMeshDetailsHandler,
  setInstancedMeshHandler,
} from './handlers/mutate.js';
import { cameraDetailsHandler, setCameraHandler } from './handlers/camera.js';
import {
  fogDetailsHandler, setFogHandler,
  rendererSettingsHandler, setRendererHandler,
  layerDetailsHandler, setLayersHandler,
} from './handlers/scene-env.js';
import {
  animationDetailsHandler, setAnimationHandler,
  skeletonDetailsHandler,
  geometryDetailsHandler,
  morphTargetsHandler, setMorphTargetHandler,
  raycastHandler,
  addHelperHandler, removeHelperHandler,
  setTextureHandler,
} from './handlers/inspect.js';
import { shadowDetailsHandler, setShadowHandler } from './handlers/shadow.js';
import { sceneBackgroundHandler } from './handlers/environment.js';
import {
  findObjectsHandler,
  memoryStatsHandler,
  disposeCheckHandler,
  toggleWireframeHandler,
  boundingBoxesHandler,
  envMapDetailsHandler,
  sceneDiffHandler,
  postprocessingListHandler,
} from './handlers/diagnostics.js';
import { consoleCaptureHandler, setupConsoleCapture } from './handlers/console-capture.js';
import { texturePreviewHandler } from './handlers/texture-preview.js';
import { perfMonitorHandler } from './handlers/perf-monitor.js';
import { clickInspectHandler } from './handlers/click-inspect.js';
import { sceneExportHandler } from './handlers/scene-export.js';
import { toggleOverlayHandler, overlaySelectedHandler, autoShowOverlay } from './handlers/overlay/index.js';
import { batchedMeshDetailsHandler } from './handlers/batched-mesh.js';
import { clippingDetailsHandler, setClippingHandler } from './handlers/clipping.js';
import { drawCallBreakdownHandler } from './handlers/draw-calls.js';
import { setPostprocessingHandler } from './handlers/postprocessing-mutate.js';

const handlers: Record<string, Handler> = {
  scene_tree: sceneTreeHandler,
  object_details: objectDetailsHandler,
  material_list: materialListHandler,
  material_details: materialDetailsHandler,
  shader_source: shaderSourceHandler,
  shader_list: shaderListHandler,
  texture_list: textureListHandler,
  texture_details: textureDetailsHandler,
  renderer_info: rendererInfoHandler,
  take_screenshot: screenshotHandler,
  annotated_screenshot: annotatedScreenshotHandler,
  set_material_property: setMaterialPropertyHandler,
  set_uniform: setUniformHandler,
  set_object_transform: setObjectTransformHandler,
  set_light: setLightHandler,
  highlight_object: highlightObjectHandler,
  run_js: runJsHandler,
  performance_snapshot: performanceSnapshotHandler,
  instanced_mesh_details: instancedMeshDetailsHandler,
  set_instanced_mesh: setInstancedMeshHandler,
  camera_details: cameraDetailsHandler,
  set_camera: setCameraHandler,
  fog_details: fogDetailsHandler,
  set_fog: setFogHandler,
  renderer_settings: rendererSettingsHandler,
  set_renderer: setRendererHandler,
  layer_details: layerDetailsHandler,
  set_layers: setLayersHandler,
  animation_details: animationDetailsHandler,
  set_animation: setAnimationHandler,
  skeleton_details: skeletonDetailsHandler,
  geometry_details: geometryDetailsHandler,
  morph_targets: morphTargetsHandler,
  set_morph_target: setMorphTargetHandler,
  raycast: raycastHandler,
  add_helper: addHelperHandler,
  remove_helper: removeHelperHandler,
  set_texture: setTextureHandler,
  shadow_details: shadowDetailsHandler,
  set_shadow: setShadowHandler,
  scene_background: sceneBackgroundHandler,
  find_objects: findObjectsHandler,
  memory_stats: memoryStatsHandler,
  dispose_check: disposeCheckHandler,
  toggle_wireframe: toggleWireframeHandler,
  bounding_boxes: boundingBoxesHandler,
  env_map_details: envMapDetailsHandler,
  scene_diff: sceneDiffHandler,
  postprocessing_list: postprocessingListHandler,
  console_capture: consoleCaptureHandler,
  texture_preview: texturePreviewHandler,
  perf_monitor: perfMonitorHandler,
  click_inspect: clickInspectHandler,
  scene_export: sceneExportHandler,
  toggle_overlay: toggleOverlayHandler,
  overlay_selected: overlaySelectedHandler,
  batched_mesh_details: batchedMeshDetailsHandler,
  clipping_details: clippingDetailsHandler,
  set_clipping: setClippingHandler,
  draw_call_breakdown: drawCallBreakdownHandler,
  set_postprocessing: setPostprocessingHandler,
};

function startBridge(): void {
  if ((window as any).__THREEJS_DEVTOOLS_BRIDGE__) {
    console.warn('[threejs-devtools-mcp] Bridge already injected');
    return;
  }
  (window as any).__THREEJS_DEVTOOLS_BRIDGE__ = true;

  const port = (window as any).__THREEJS_DEVTOOLS_PORT__ || 9222;
  let ws: WebSocket | null = null;
  let ctx: ThreeContext | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let replaced = false; // Set when server tells us another tab took over
  let reconnectAttempts = 0;

  function connect(): void {
    if (replaced) return; // Don't reconnect if replaced by another tab
    try { ws = new WebSocket(`ws://localhost:${port}`); }
    catch { scheduleReconnect(); return; }

    ws.onopen = () => {
      reconnectAttempts = 0;
      console.log('[threejs-devtools-mcp] Connected to MCP server');
      ctx = discoverThreeJS();
      if (ctx) console.log('[threejs-devtools-mcp] Three.js scene found');
      else console.warn('[threejs-devtools-mcp] Three.js scene not found yet, will retry on each request');
    };

    ws.onmessage = (event) => {
      let request: BridgeRequest;
      try { request = JSON.parse(event.data as string); } catch { return; }

      // Server tells us this tab was replaced by a new connection
      if (request.id === '__replaced') {
        replaced = true;
        console.log('[threejs-devtools-mcp] Replaced by another tab — stopping reconnect');
        return;
      }

      ctx = discoverThreeJS();
      if (!ctx) {
        send({ id: request.id, error: { code: -1, message: 'Three.js scene not found in page' } });
        return;
      }
      if (ctx.scene.children?.length === 0 && request.method !== 'run_js') {
        console.warn(`[threejs-devtools-mcp] Scene has 0 children for "${request.method}" — scene may be stale or not yet loaded`);
      }

      const handler = handlers[request.method];
      if (!handler) {
        send({ id: request.id, error: { code: -2, message: `Unknown method: ${request.method}` } });
        return;
      }

      try {
        const result = handler(ctx, request.params || {});
        if (result && typeof (result as any).then === 'function') {
          (result as Promise<unknown>).then(
            (res) => send({ id: request.id, result: res }),
            (err) => send({ id: request.id, error: { code: -3, message: (err as Error).message } }),
          );
        } else {
          send({ id: request.id, result });
        }
      } catch (err) {
        send({ id: request.id, error: { code: -3, message: (err as Error).message } });
      }
    };

    ws.onclose = (event) => {
      if (replaced || event.code === 4000) {
        console.log('[threejs-devtools-mcp] Replaced by another tab — not reconnecting');
        return;
      }
      reconnectAttempts++;
      if (reconnectAttempts <= 3) {
        if (reconnectAttempts === 1) console.log('[threejs-devtools-mcp] Disconnected — reconnecting...');
        scheduleReconnect();
      } else {
        console.log('[threejs-devtools-mcp] Server unreachable after 3 attempts — stopped. Reload page to retry.');
      }
    };

    ws.onerror = () => {};
  }

  function send(response: BridgeResponse): void {
    ws?.send(JSON.stringify(response));
  }

  function scheduleReconnect(): void {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, 3000);
  }

  connect();
}

// Auto-start: setupCapture immediately (before Three.js loads),
// startBridge after DOM is ready (no artificial setTimeout)
if (typeof window !== 'undefined') {
  // Set callback BEFORE setupCapture so it's ready when scene is discovered
  // Disable auto-overlay: set window.__THREEJS_DEVTOOLS_NO_OVERLAY__ = true
  (window as any).__tdt_onSceneReady = (ctx: ThreeContext) => {
    if (!(window as any).__THREEJS_DEVTOOLS_NO_OVERLAY__) {
      setTimeout(() => { autoShowOverlay(ctx); }, 300);
    }
  };

  setupCapture();
  setupConsoleCapture();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startBridge);
  } else {
    startBridge();
  }
}
