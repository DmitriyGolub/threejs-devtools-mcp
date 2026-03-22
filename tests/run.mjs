#!/usr/bin/env node
/**
 * E2E test suite for threejs-devtools-mcp.
 *
 * Requires: a Three.js app running in a browser with the bridge connected.
 * The test spawns its own MCP server and waits for the bridge to connect.
 *
 * Usage:
 *   1. Start your dev server: npm run dev
 *   2. Open http://localhost:9222 in browser (or have bridge.js loaded)
 *   3. Run: node tests/run.mjs
 */
import path from 'node:path';
import { createTestClient } from './mcp-client.mjs';
import { summary } from './test-runner.mjs';
import { testInitialize } from './test-initialize.mjs';
import { testBridgeStatus } from './test-bridge.mjs';
import { testSceneTree, testMaterialList, testRendererInfo, testShaderList, testTextureList } from './test-scene.mjs';
import { testScreenshot } from './test-screenshot.mjs';
import { testSetDevPort } from './test-config.mjs';
import {
  testSetMaterialProperty, testSetUniform, testSetObjectTransform,
  testSetLight, testHighlightObject, testRunJs, testPerformanceSnapshot,
  testColorSpace, testInstancedMeshDetails, testSetInstancedMesh,
} from './test-mutations.mjs';
import { testCameraDetails, testSetCamera } from './test-camera.mjs';
import { testFogDetails, testSetFog } from './test-fog.mjs';
import { testRendererSettings, testSetRendererSettings } from './test-renderer-settings.mjs';
import { testAnimationDetails, testSetAnimation } from './test-animation.mjs';
import { testSetTexture } from './test-texture-mutate.mjs';
import { testSkeletonDetails } from './test-skeleton.mjs';
import { testGeometryDetails } from './test-geometry.mjs';
import { testAddHelper } from './test-helpers.mjs';
import { testRaycast } from './test-raycast.mjs';
import { testLayerDetails, testSetLayers } from './test-layers.mjs';
import { testMorphTargets, testSetMorphTarget } from './test-morph.mjs';
import {
  testFindObjects, testMemoryStats, testDisposeCheck,
  testToggleWireframe, testBoundingBoxes, testEnvMapDetails,
  testSceneDiff, testPostprocessingList, testGltfToR3f,
} from './test-diagnostics.mjs';
import { testConsoleCapture } from './test-console.mjs';
import { testTexturePreview } from './test-texture-preview.mjs';
import { testPerfMonitor } from './test-perf-monitor.mjs';
import { testClickInspect } from './test-click-inspect.mjs';
import { testSceneExport } from './test-scene-export.mjs';
import { testToggleOverlay, testOverlaySelected } from './test-overlay.mjs';

const serverDir = path.resolve(import.meta.dirname, '..');
const client = createTestClient(serverDir);

try {
  console.log('\n── Initialize ──');
  await testInitialize(client);

  console.log('\n── Waiting for bridge (3s) ──');
  await new Promise(r => setTimeout(r, 3000));

  console.log('\n── Connection ──');
  const connected = await testBridgeStatus(client);

  if (!connected) {
    console.error('\nBridge not connected. Open http://localhost:9222 in a browser.');
    process.exit(1);
  }

  // ── Read-only inspection ──
  console.log('\n── Scene ──');
  await testSceneTree(client);

  console.log('\n── Materials ──');
  await testMaterialList(client);

  console.log('\n── Renderer ──');
  await testRendererInfo(client);

  console.log('\n── Shaders ──');
  await testShaderList(client);

  console.log('\n── Textures ──');
  await testTextureList(client);

  console.log('\n── Screenshot ──');
  await testScreenshot(client);

  // ── Mutations (Batch 1) ──
  console.log('\n── Material Property ──');
  await testSetMaterialProperty(client);

  console.log('\n── Uniform ──');
  await testSetUniform(client);

  console.log('\n── Object Transform ──');
  await testSetObjectTransform(client);

  console.log('\n── Light ──');
  await testSetLight(client);

  console.log('\n── Highlight ──');
  await testHighlightObject(client);

  console.log('\n── run_js ──');
  await testRunJs(client);

  console.log('\n── Performance Snapshot ──');
  await testPerformanceSnapshot(client);

  console.log('\n── Color Space ──');
  await testColorSpace(client);

  console.log('\n── InstancedMesh Details ──');
  await testInstancedMeshDetails(client);

  console.log('\n── InstancedMesh Set ──');
  await testSetInstancedMesh(client);

  // ── Camera ──
  console.log('\n── Camera Details ──');
  await testCameraDetails(client);

  console.log('\n── Set Camera ──');
  await testSetCamera(client);

  // ── Fog ──
  console.log('\n── Fog Details ──');
  await testFogDetails(client);

  console.log('\n── Set Fog ──');
  await testSetFog(client);

  // ── Renderer Settings ──
  console.log('\n── Renderer Settings ──');
  await testRendererSettings(client);

  console.log('\n── Set Renderer ──');
  await testSetRendererSettings(client);

  // ── Animation ──
  console.log('\n── Animation Details ──');
  await testAnimationDetails(client);

  console.log('\n── Set Animation ──');
  await testSetAnimation(client);

  // ── Skeleton ──
  console.log('\n── Skeleton Details ──');
  await testSkeletonDetails(client);

  // ── Geometry ──
  console.log('\n── Geometry Details ──');
  await testGeometryDetails(client);

  // ── Texture Mutation ──
  console.log('\n── Set Texture ──');
  await testSetTexture(client);

  // ── Morph Targets ──
  console.log('\n── Morph Targets ──');
  await testMorphTargets(client);

  console.log('\n── Set Morph Target ──');
  await testSetMorphTarget(client);

  // ── Raycast ──
  console.log('\n── Raycast ──');
  await testRaycast(client);

  // ── Layers ──
  console.log('\n── Layer Details ──');
  await testLayerDetails(client);

  console.log('\n── Set Layers ──');
  await testSetLayers(client);

  // ── Helpers ──
  console.log('\n── Add/Remove Helper ──');
  await testAddHelper(client);

  // ── Diagnostics (new in v0.2.0) ──
  console.log('\n── Find Objects ──');
  await testFindObjects(client);

  console.log('\n── Memory Stats ──');
  await testMemoryStats(client);

  console.log('\n── Dispose Check ──');
  await testDisposeCheck(client);

  console.log('\n── Toggle Wireframe ──');
  await testToggleWireframe(client);

  console.log('\n── Bounding Boxes ──');
  await testBoundingBoxes(client);

  console.log('\n── Env Map Details ──');
  await testEnvMapDetails(client);

  console.log('\n── Scene Diff ──');
  await testSceneDiff(client);

  console.log('\n── Post-processing ──');
  await testPostprocessingList(client);

  console.log('\n── GLTF to R3F ──');
  await testGltfToR3f(client);

  // ── New tools (v0.3.0) ──
  console.log('\n── Console Capture ──');
  await testConsoleCapture(client);

  console.log('\n── Texture Preview ──');
  await testTexturePreview(client);

  console.log('\n── Perf Monitor ──');
  await testPerfMonitor(client);

  console.log('\n── Click Inspect ──');
  await testClickInspect(client);

  console.log('\n── Scene Export ──');
  await testSceneExport(client);

  // ── Overlay ──
  console.log('\n── Toggle Overlay ──');
  await testToggleOverlay(client);

  console.log('\n── Overlay Selected ──');
  await testOverlaySelected(client);

  // ── Config (last, may change port) ──
  console.log('\n── Config ──');
  await testSetDevPort(client);

  const allPassed = summary();
  process.exit(allPassed ? 0 : 1);
} catch (err) {
  console.error('\nTest crashed:', err.message);
  process.exit(1);
} finally {
  client.kill();
}
