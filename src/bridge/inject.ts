/**
 * Three.js DevTools Bridge — entry point.
 * Bundled as a single IIFE with zero dependencies.
 */

import type { BridgeRequest, BridgeResponse, ThreeContext, Handler } from './types.js';
import { discoverThreeJS, setupCapture } from './discovery.js';
import { sceneTreeHandler, objectDetailsHandler } from './handlers/scene.js';
import { materialListHandler, materialDetailsHandler } from './handlers/material.js';
import { shaderSourceHandler, shaderListHandler } from './handlers/shader.js';
import { textureListHandler, textureDetailsHandler } from './handlers/texture.js';
import { rendererInfoHandler } from './handlers/renderer.js';
import { screenshotHandler } from './handlers/screenshot.js';
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
};

function startBridge(): void {
  if ((window as any).__THREEJS_DEVTOOLS_BRIDGE__) {
    console.warn('[threejs-devtools] Bridge already injected');
    return;
  }
  (window as any).__THREEJS_DEVTOOLS_BRIDGE__ = true;

  const port = (window as any).__THREEJS_DEVTOOLS_PORT__ || 9222;
  let ws: WebSocket | null = null;
  let ctx: ThreeContext | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect(): void {
    try { ws = new WebSocket(`ws://localhost:${port}`); }
    catch { scheduleReconnect(); return; }

    ws.onopen = () => {
      console.log('[threejs-devtools] Connected to MCP server');
      ctx = discoverThreeJS();
      if (ctx) console.log('[threejs-devtools] Three.js scene found');
      else console.warn('[threejs-devtools] Three.js scene not found yet, will retry on each request');
    };

    ws.onmessage = (event) => {
      let request: BridgeRequest;
      try { request = JSON.parse(event.data as string); } catch { return; }

      ctx = discoverThreeJS();
      if (!ctx) {
        send({ id: request.id, error: { code: -1, message: 'Three.js scene not found in page' } });
        return;
      }

      const handler = handlers[request.method];
      if (!handler) {
        send({ id: request.id, error: { code: -2, message: `Unknown method: ${request.method}` } });
        return;
      }

      try {
        send({ id: request.id, result: handler(ctx, request.params || {}) });
      } catch (err) {
        send({ id: request.id, error: { code: -3, message: (err as Error).message } });
      }
    };

    ws.onclose = () => {
      console.log('[threejs-devtools] Disconnected from MCP server');
      scheduleReconnect();
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
  setupCapture();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startBridge);
  } else {
    startBridge();
  }
}
