import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import type { BridgeServer } from '../bridge/server.js';
import { bridgeTool } from './tool-helper.js';
import { gltfToR3f } from './gltf-to-r3f.js';

function screenshotsDir(): string {
  const dir = path.join(process.cwd(), 'screenshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function registerTools(server: McpServer, bridge: BridgeServer): void {
  bridgeTool(server, bridge, 'scene_tree',
    'List all objects in the Three.js scene tree. Returns compact text tree by default (saves tokens). Set compact=false for full JSON.',
    { depth: z.number().optional().describe('Max tree depth (default: 3)'),
      types: z.array(z.string()).optional().describe('Filter by type: Mesh, Light, Group, etc.'),
      maxChildren: z.number().optional().describe('Max children per node (default: 15 compact, 100 JSON)'),
      compact: z.boolean().optional().describe('Compact text tree (default: true). Set false for full JSON with positions/geometry.') });

  bridgeTool(server, bridge, 'object_details',
    'Get detailed info about a specific object by name, uuid, or path',
    { name: z.string().optional().describe('Object name (first match)'),
      uuid: z.string().optional().describe('Object UUID'),
      path: z.string().optional().describe('Dot path: "Scene.MyGroup.MyMesh"') });

  bridgeTool(server, bridge, 'material_list',
    'List all materials in the scene with type, color, transparency', {});

  bridgeTool(server, bridge, 'material_details',
    'Get full properties of a material: color, maps, uniforms, defines',
    { name: z.string().optional().describe('Material name'),
      uuid: z.string().optional().describe('Material UUID') });

  bridgeTool(server, bridge, 'shader_source',
    'Get compiled vertex/fragment shader source and uniforms for a material',
    { materialName: z.string().optional().describe('Material name'),
      materialUuid: z.string().optional().describe('Material UUID') });

  bridgeTool(server, bridge, 'shader_list',
    'List all compiled shader programs with their material associations', {});

  bridgeTool(server, bridge, 'texture_list',
    'List all textures: size, format, wrap, filter settings', {});

  bridgeTool(server, bridge, 'texture_details',
    'Get detailed info about a specific texture',
    { name: z.string().optional().describe('Texture name'),
      uuid: z.string().optional().describe('Texture UUID') });

  bridgeTool(server, bridge, 'renderer_info',
    'Get renderer stats: draw calls, triangles, memory, capabilities', {});

  // ── Mutation tools ──────────────────────────────────────
  // All set_* tools apply changes at runtime only (lost on page reload).
  // BEFORE calling any set_* tool, the AI agent MUST ask the user:
  //   "Runtime preview only, or should I also update the source code?"
  // Then act accordingly.

  bridgeTool(server, bridge, 'set_material_property',
    'Set a material property (color, roughness, wireframe, etc.). IMPORTANT: This is a runtime-only preview (lost on reload). Before calling, ASK the user whether they want a runtime preview or a persistent code change.',
    { name: z.string().optional().describe('Material name'),
      uuid: z.string().optional().describe('Material UUID'),
      property: z.string().describe('Property name: color, emissive, roughness, metalness, opacity, transparent, wireframe, visible, side, depthWrite, depthTest, alphaTest, flatShading, fog'),
      value: z.any().describe('New value (hex string for colors, number for scalars, boolean for flags)') });

  bridgeTool(server, bridge, 'set_uniform',
    'Set a shader uniform value on a ShaderMaterial — runtime-only preview (lost on reload). ASK the user first: runtime preview or persistent code change?',
    { name: z.string().optional().describe('Material name'),
      uuid: z.string().optional().describe('Material UUID'),
      uniform: z.string().describe('Uniform name (e.g. uHorizonColor, uOpacity)'),
      value: z.any().describe('New value: hex string for Color, {x,y,z} for Vector3, number for float') });

  bridgeTool(server, bridge, 'set_object_transform',
    'Set position, rotation, scale, or visibility of a scene object — runtime-only preview (lost on reload). ASK the user first: runtime preview or persistent code change?',
    { name: z.string().optional().describe('Object name'),
      uuid: z.string().optional().describe('Object UUID'),
      position: z.array(z.number()).length(3).optional().describe('[x, y, z]'),
      rotation: z.array(z.number()).length(3).optional().describe('[x, y, z] in radians'),
      scale: z.array(z.number()).length(3).optional().describe('[x, y, z]'),
      visible: z.boolean().optional().describe('Show/hide object') });

  bridgeTool(server, bridge, 'set_light',
    'Modify light properties: color, intensity, position, shadows — runtime-only preview (lost on reload). ASK the user first: runtime preview or persistent code change?',
    { name: z.string().optional().describe('Light name'),
      uuid: z.string().optional().describe('Light UUID'),
      color: z.string().optional().describe('Light color (#RRGGBB)'),
      intensity: z.number().optional().describe('Light intensity'),
      position: z.array(z.number()).length(3).optional().describe('[x, y, z]'),
      castShadow: z.boolean().optional().describe('Enable/disable shadows'),
      groundColor: z.string().optional().describe('Ground color for HemisphereLight (#RRGGBB)') });

  bridgeTool(server, bridge, 'highlight_object',
    'Highlight an object for debugging (wireframe or visibility toggle). Runtime only — for visual inspection, not persisted.',
    { name: z.string().optional().describe('Object name'),
      uuid: z.string().optional().describe('Object UUID'),
      mode: z.enum(['wireframe', 'visibility']).optional().describe('Highlight mode (default: wireframe)'),
      enabled: z.boolean().optional().describe('Enable/disable highlight (default: true)') });

  bridgeTool(server, bridge, 'run_js',
    'Execute arbitrary JavaScript with access to scene, renderer, camera. Returns the result. Runtime only (lost on reload). If the code mutates scene state, ASK the user first: runtime preview or persistent code change?',
    { code: z.string().describe('JavaScript code. Available vars: scene, renderer, camera, gl. Use return for results.') });

  bridgeTool(server, bridge, 'performance_snapshot',
    'Get detailed performance analysis: draw calls, triangles, instanced meshes, object counts by type',
    {});

  bridgeTool(server, bridge, 'instanced_mesh_details',
    'Inspect an InstancedMesh: count, max instances, geometry, sample transforms, custom attributes, instance colors',
    { name: z.string().optional().describe('InstancedMesh name'),
      uuid: z.string().optional().describe('InstancedMesh UUID'),
      sampleCount: z.number().optional().describe('Number of instances to sample (default: 5, max: 20)'),
      startIndex: z.number().optional().describe('First instance index to sample (default: 0)') });

  bridgeTool(server, bridge, 'set_instanced_mesh',
    'Modify InstancedMesh properties: count, visibility, frustumCulled — runtime-only preview (lost on reload). ASK the user first: runtime preview or persistent code change?',
    { name: z.string().optional().describe('InstancedMesh name'),
      uuid: z.string().optional().describe('InstancedMesh UUID'),
      count: z.number().optional().describe('Number of visible instances'),
      visible: z.boolean().optional().describe('Show/hide entire mesh'),
      frustumCulled: z.boolean().optional().describe('Enable/disable frustum culling') });

  // ── Camera ─────────────────────────────────────────────

  bridgeTool(server, bridge, 'camera_details',
    'Get active camera properties: type, position, FOV, near/far, aspect',
    {});

  bridgeTool(server, bridge, 'set_camera',
    'Modify camera: position, rotation, FOV, near/far, zoom — runtime-only preview (lost on reload). ASK the user first: runtime preview or persistent code change?',
    { position: z.array(z.number()).length(3).optional().describe('[x, y, z]'),
      rotation: z.array(z.number()).length(3).optional().describe('[x, y, z] in radians'),
      fov: z.number().optional().describe('Field of view (PerspectiveCamera)'),
      near: z.number().optional().describe('Near clipping plane'),
      far: z.number().optional().describe('Far clipping plane'),
      zoom: z.number().optional().describe('Zoom factor'),
      aspect: z.number().optional().describe('Aspect ratio (PerspectiveCamera)'),
      left: z.number().optional().describe('Left plane (OrthographicCamera)'),
      right: z.number().optional().describe('Right plane (OrthographicCamera)'),
      top: z.number().optional().describe('Top plane (OrthographicCamera)'),
      bottom: z.number().optional().describe('Bottom plane (OrthographicCamera)') });

  // ── Fog ────────────────────────────────────────────────

  bridgeTool(server, bridge, 'fog_details',
    'Get scene fog settings: type (Fog/FogExp2), color, near/far or density',
    {});

  bridgeTool(server, bridge, 'set_fog',
    'Modify scene fog: color, near/far (Fog) or density (FogExp2), background color — runtime-only preview (lost on reload). ASK the user first: runtime preview or persistent code change?',
    { color: z.string().optional().describe('Fog color (#RRGGBB)'),
      near: z.number().optional().describe('Fog near distance (Fog type)'),
      far: z.number().optional().describe('Fog far distance (Fog type)'),
      density: z.number().optional().describe('Fog density (FogExp2 type)'),
      background: z.string().optional().describe('Scene background color (#RRGGBB)') });

  // ── Renderer Settings ─────────────────────────────────

  bridgeTool(server, bridge, 'renderer_settings',
    'Get renderer configuration: toneMapping, exposure, colorSpace, shadowMap, pixelRatio',
    {});

  bridgeTool(server, bridge, 'set_renderer',
    'Modify renderer: toneMapping, exposure, colorSpace, shadows — runtime-only preview (lost on reload). ASK the user first: runtime preview or persistent code change?',
    { toneMapping: z.number().optional().describe('Tone mapping algorithm (0-7)'),
      toneMappingExposure: z.number().optional().describe('Exposure level'),
      outputColorSpace: z.string().optional().describe('Output color space (srgb, srgb-linear)'),
      pixelRatio: z.number().optional().describe('Device pixel ratio'),
      sortObjects: z.boolean().optional().describe('Sort objects before rendering'),
      localClippingEnabled: z.boolean().optional().describe('Enable local clipping planes'),
      shadowMapEnabled: z.boolean().optional().describe('Enable shadow mapping'),
      shadowMapType: z.number().optional().describe('Shadow map type (0=Basic, 1=PCF, 2=PCFSoft, 3=VSM)') });

  // ── Animation ──────────────────────────────────────────

  bridgeTool(server, bridge, 'animation_details',
    'List all AnimationMixers, their actions, clips, weights, and playback state',
    {});

  bridgeTool(server, bridge, 'set_animation',
    'Control animation: mixer timeScale, action play/stop/pause/weight. Runtime only — for testing.',
    { mixerIndex: z.number().optional().describe('Mixer index (default: 0)'),
      timeScale: z.number().optional().describe('Mixer global time scale'),
      time: z.number().optional().describe('Mixer current time'),
      clipName: z.string().optional().describe('Target action by clip name'),
      actionWeight: z.number().optional().describe('Action weight (0-1)'),
      actionTimeScale: z.number().optional().describe('Action time scale'),
      actionPaused: z.boolean().optional().describe('Pause/unpause action'),
      play: z.boolean().optional().describe('Play the action'),
      stop: z.boolean().optional().describe('Stop the action') });

  // ── Skeleton ───────────────────────────────────────────

  bridgeTool(server, bridge, 'skeleton_details',
    'List all skeletons/bones from SkinnedMesh objects in the scene',
    {});

  // ── Geometry ───────────────────────────────────────────

  bridgeTool(server, bridge, 'geometry_details',
    'Inspect geometry: vertices, attributes, indices, bounding box, morph attributes',
    { name: z.string().optional().describe('Object name (owning mesh)'),
      uuid: z.string().optional().describe('Object UUID (owning mesh)') });

  // ── Morph Targets ──────────────────────────────────────

  bridgeTool(server, bridge, 'morph_targets',
    'List all meshes with morph targets, their target names and current influence values',
    {});

  bridgeTool(server, bridge, 'set_morph_target',
    'Set morph target influence on a mesh — runtime-only preview (lost on reload). ASK the user first: runtime preview or persistent code change?',
    { name: z.string().optional().describe('Mesh name'),
      uuid: z.string().optional().describe('Mesh UUID'),
      index: z.number().optional().describe('Morph target index'),
      targetName: z.string().optional().describe('Morph target name (from dictionary)'),
      influence: z.number().describe('Influence value (0-1)') });

  // ── Raycasting ─────────────────────────────────────────

  bridgeTool(server, bridge, 'raycast',
    'Cast a ray from camera through screen coordinates and return hit objects',
    { x: z.number().describe('Normalized device X coordinate (-1 to 1, 0 = center)'),
      y: z.number().describe('Normalized device Y coordinate (-1 to 1, 0 = center)'),
      maxHits: z.number().optional().describe('Maximum hits to return (default: 10)') });

  // ── Layers ─────────────────────────────────────────────

  bridgeTool(server, bridge, 'layer_details',
    'Show camera layer mask and objects with non-default layer assignments',
    {});

  bridgeTool(server, bridge, 'set_layers',
    'Set layers on an object or camera — runtime-only preview (lost on reload). ASK the user first: runtime preview or persistent code change?',
    { name: z.string().optional().describe('Object name'),
      uuid: z.string().optional().describe('Object UUID'),
      target: z.string().optional().describe('"camera" to target the camera'),
      layer: z.number().optional().describe('Layer number (0-31) to enable/disable'),
      enabled: z.boolean().optional().describe('Enable or disable the layer'),
      mask: z.number().optional().describe('Set layer mask directly (bitmask)') });

  // ── Debug Helpers ──────────────────────────────────────

  bridgeTool(server, bridge, 'add_helper',
    'Add a visual debug helper to a scene object. Types: box, axes, skeleton, arrow, grid, polar_grid, camera, directional_light, spot_light, point_light, hemisphere_light, plane',
    { target: z.string().optional().describe('Target object name'),
      targetUuid: z.string().optional().describe('Target object UUID'),
      type: z.enum(['box', 'axes', 'skeleton', 'arrow', 'grid', 'polar_grid', 'camera', 'directional_light', 'spot_light', 'point_light', 'hemisphere_light', 'plane']).optional().describe('Helper type (default: box)'),
      size: z.number().optional().describe('Size for AxesHelper/GridHelper/LightHelpers (default: 1)'),
      color: z.number().optional().describe('Color as hex number (default: 0x00ff00)'),
      direction: z.array(z.number()).length(3).optional().describe('[x, y, z] direction for ArrowHelper/PlaneHelper'),
      origin: z.array(z.number()).length(3).optional().describe('[x, y, z] origin for ArrowHelper'),
      length: z.number().optional().describe('Arrow length (ArrowHelper, default: 1)'),
      divisions: z.number().optional().describe('Grid divisions (GridHelper, default: 10)') });

  bridgeTool(server, bridge, 'remove_helper',
    'Remove a previously added debug helper',
    { helperId: z.string().describe('Helper ID returned by add_helper') });

  // ── Texture Mutation ───────────────────────────────────

  bridgeTool(server, bridge, 'set_texture',
    'Modify texture properties: wrap, filter, anisotropy, repeat, offset, colorSpace — runtime-only preview (lost on reload). ASK the user first: runtime preview or persistent code change?',
    { uuid: z.string().optional().describe('Texture UUID'),
      name: z.string().optional().describe('Texture name'),
      wrapS: z.number().optional().describe('Wrap S mode (1000=Repeat, 1001=ClampToEdge, 1002=Mirrored)'),
      wrapT: z.number().optional().describe('Wrap T mode'),
      minFilter: z.number().optional().describe('Min filter (1003=Nearest, 1006=Linear, 1008=LinearMipmapLinear)'),
      magFilter: z.number().optional().describe('Mag filter (1003=Nearest, 1006=Linear)'),
      anisotropy: z.number().optional().describe('Anisotropic filtering level (1-16)'),
      flipY: z.boolean().optional().describe('Flip texture vertically'),
      colorSpace: z.string().optional().describe('Color space (srgb, srgb-linear)'),
      repeat: z.array(z.number()).length(2).optional().describe('[x, y] repeat'),
      offset: z.array(z.number()).length(2).optional().describe('[x, y] offset'),
      rotation: z.number().optional().describe('Rotation in radians') });

  // ── Shadows ──────────────────────────────────────────────

  bridgeTool(server, bridge, 'shadow_details',
    'Inspect shadow maps: global settings, per-light shadow config (bias, mapSize, camera frustum), cast/receive objects',
    {});

  bridgeTool(server, bridge, 'set_shadow',
    'Modify shadow settings — runtime-only preview (lost on reload). ASK the user first: runtime preview or persistent code change?',
    { name: z.string().optional().describe('Object/light name'),
      uuid: z.string().optional().describe('Object/light UUID'),
      castShadow: z.boolean().optional().describe('Enable/disable shadow casting'),
      receiveShadow: z.boolean().optional().describe('Enable/disable shadow receiving'),
      bias: z.number().optional().describe('Shadow bias (light only, e.g. -0.0001)'),
      normalBias: z.number().optional().describe('Shadow normal bias (light only)'),
      radius: z.number().optional().describe('Shadow blur radius (light only)'),
      blurSamples: z.number().optional().describe('Shadow blur samples (light only)'),
      mapSize: z.array(z.number()).length(2).optional().describe('[width, height] shadow map resolution'),
      cameraNear: z.number().optional().describe('Shadow camera near plane'),
      cameraFar: z.number().optional().describe('Shadow camera far plane'),
      cameraLeft: z.number().optional().describe('Shadow camera left (DirectionalLight)'),
      cameraRight: z.number().optional().describe('Shadow camera right (DirectionalLight)'),
      cameraTop: z.number().optional().describe('Shadow camera top (DirectionalLight)'),
      cameraBottom: z.number().optional().describe('Shadow camera bottom (DirectionalLight)') });

  // ── Scene Background & Environment ─────────────────────

  bridgeTool(server, bridge, 'scene_background',
    'Inspect scene background, environment map (IBL), color management, backgroundBlurriness/Intensity',
    {});

  // ── Diagnostics ─────────────────────────────────────────

  bridgeTool(server, bridge, 'find_objects',
    'Search scene objects by type, material, visibility, name pattern, or custom property. Returns matching objects with details.',
    { type: z.string().optional().describe('Object type: Mesh, Group, InstancedMesh, Light, etc.'),
      material: z.string().optional().describe('Material name or type to filter by'),
      visible: z.boolean().optional().describe('Filter by visibility'),
      namePattern: z.string().optional().describe('Regex pattern to match object names'),
      property: z.string().optional().describe('Custom property name to check on the object'),
      value: z.any().optional().describe('Expected value for the custom property'),
      hasGeometry: z.boolean().optional().describe('Filter objects with/without geometry'),
      minChildren: z.number().optional().describe('Minimum number of children'),
      limit: z.number().optional().describe('Max results (default: 50, max: 200)') });

  bridgeTool(server, bridge, 'memory_stats',
    'Detailed GPU memory analysis: geometry buffers, texture VRAM, instance data, top textures by size',
    {});

  bridgeTool(server, bridge, 'dispose_check',
    'Find potential memory leaks: orphaned geometries/textures not in scene but tracked by renderer, hidden objects with geometry',
    {});

  bridgeTool(server, bridge, 'toggle_wireframe',
    'Toggle wireframe on all materials or a specific object. Runtime only — for visual debugging.',
    { name: z.string().optional().describe('Object name (omit for whole scene)'),
      uuid: z.string().optional().describe('Object UUID'),
      enabled: z.boolean().optional().describe('true=wireframe on, false=restore original, omit=toggle') });

  bridgeTool(server, bridge, 'bounding_boxes',
    'Show/hide axis-aligned bounding boxes for scene objects. Runtime only — for debugging frustum culling and object bounds.',
    { name: z.string().optional().describe('Target object name (omit for all meshes)'),
      uuid: z.string().optional().describe('Target object UUID'),
      enabled: z.boolean().optional().describe('true=show (default), false=remove all'),
      clear: z.boolean().optional().describe('Remove all bounding boxes'),
      color: z.number().optional().describe('Box color as hex (default: 0x00ff00)'),
      recursive: z.boolean().optional().describe('Include children of target'),
      onlyVisible: z.boolean().optional().describe('Only visible objects (default: true)'),
      limit: z.number().optional().describe('Max boxes to add (default: 50)') });

  bridgeTool(server, bridge, 'env_map_details',
    'Inspect environment maps: scene.environment, scene.background, per-material envMap, IBL settings',
    {});

  bridgeTool(server, bridge, 'scene_diff',
    'Compare scene state over time. First call saves a snapshot, second call shows what changed (added/removed/modified objects, transforms, materials, lights).',
    { action: z.enum(['snapshot', 'diff', 'auto']).optional().describe('snapshot=save state, diff=compare with saved, auto=snapshot if none saved, diff if exists (default: auto)') });

  bridgeTool(server, bridge, 'postprocessing_list',
    'List post-processing passes from EffectComposer: render passes, shader passes, effects (bloom, SSAO, etc.)',
    {});

  // ── Console Capture ──────────────────────────────────────

  bridgeTool(server, bridge, 'console_capture',
    'Capture browser console output (log/warn/error). Returns last N messages. Call to check for runtime errors and warnings.',
    { clear: z.boolean().optional().describe('Clear the capture buffer'),
      level: z.enum(['log', 'warn', 'error']).optional().describe('Filter by level'),
      limit: z.number().optional().describe('Max messages to return (default: 50)') });

  // ── Texture Preview ─────────────────────────────────────

  server.registerTool('texture_preview', {
    description: 'Preview a specific texture as a PNG image. Use texture_list first to find names/UUIDs.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      name: z.string().optional().describe('Texture name'),
      uuid: z.string().optional().describe('Texture UUID'),
      maxSize: z.number().optional().describe('Max dimension in px (default: 512)'),
    },
  }, async (params) => {
    try {
      const result = await bridge.request('texture_preview', (params ?? {}) as Record<string, unknown>, 15000) as {
        dataUrl: string; width: number; height: number; originalWidth: number; originalHeight: number;
        textureName: string; textureUuid: string;
      };
      const base64 = result.dataUrl.replace(/^data:image\/png;base64,/, '');

      let savedPath = '';
      try {
        const dir = screenshotsDir();
        const safeName = (result.textureName || result.textureUuid.slice(0, 8)).replace(/[^a-zA-Z0-9_-]/g, '_');
        savedPath = path.join(dir, `texture-${safeName}.png`);
        fs.writeFileSync(savedPath, Buffer.from(base64, 'base64'));
      } catch { /* ignore save errors */ }

      return {
        content: [
          { type: 'image' as const, data: base64, mimeType: 'image/png' as const },
          { type: 'text' as const, text: `Texture: ${result.textureName || result.textureUuid} (${result.originalWidth}x${result.originalHeight})${savedPath ? `\nSaved to: ${savedPath}` : ''}` },
        ],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  });

  // ── Performance Monitor ─────────────────────────────────

  bridgeTool(server, bridge, 'perf_monitor',
    'Record FPS and frame times for N seconds. Returns avg/min/max FPS, percentiles, spike and jank counts.',
    { duration: z.number().optional().describe('Recording duration in seconds (default: 3, max: 30)'),
      includeFrameTimes: z.boolean().optional().describe('Include raw frame times array (default: false, saves tokens)') },
    35000);

  // ── Click Inspect ───────────────────────────────────────

  bridgeTool(server, bridge, 'click_inspect',
    'Enable click-to-inspect mode. Cursor changes to crosshair — tell the user to click on an object in the 3D scene. Returns clicked object details.',
    { timeout: z.number().optional().describe('Max wait in seconds (default: 15, max: 60)') },
    65000);

  // ── Scene Export ────────────────────────────────────────

  server.registerTool('scene_export', {
    description: 'Export scene or specific object as GLB. Requires GLTFExporter in your app (see error message for setup). Saves to screenshots/ folder.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      name: z.string().optional().describe('Object name (omit for entire scene)'),
      uuid: z.string().optional().describe('Object UUID'),
      binary: z.boolean().optional().describe('GLB binary (default: true) or glTF JSON'),
    },
  }, async (params) => {
    try {
      const result = await bridge.request('scene_export', (params ?? {}) as Record<string, unknown>, 30000) as {
        format: string; base64?: string; json?: any; sizeBytes?: number; target: string;
      };

      if (result.base64) {
        const dir = screenshotsDir();
        const safeName = (result.target || 'scene').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filePath = path.join(dir, `${safeName}.glb`);
        fs.writeFileSync(filePath, Buffer.from(result.base64, 'base64'));
        return {
          content: [{ type: 'text' as const, text: `Exported ${result.format} (${(result.sizeBytes! / 1024).toFixed(1)} KB) → ${filePath}` }],
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.json, null, 2).slice(0, 5000) }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  });

  // ── GLTF to R3F ──────────────────────────────────────────

  server.registerTool('gltf_to_r3f', {
    description: 'Convert a GLTF/GLB file to a ready-to-use React Three Fiber component (like gltfjsx)',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      filePath: z.string().describe('Absolute or relative path to the .glb or .gltf file'),
      typescript: z.boolean().optional().describe('Generate TypeScript (default: true)'),
      preload: z.boolean().optional().describe('Add useGLTF.preload() call (default: true)'),
    },
  }, async (params) => {
    try {
      const { component, info } = await gltfToR3f({
        filePath: params.filePath as string,
        typescript: params.typescript as boolean | undefined,
        preload: params.preload as boolean | undefined,
      });
      return {
        content: [
          { type: 'text' as const, text: `// ${info.componentName}.tsx\n// Nodes: ${info.nodes}, Meshes: ${info.meshes}, Materials: ${info.materials}, Animations: ${info.animations}\n// Material names: ${info.materialNames.join(', ') || 'none'}\n// Animation names: ${info.animationNames.join(', ') || 'none'}\n\n${component}` },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  });

  // Screenshot returns image content, needs special handling
  server.registerTool('take_screenshot', {
    description: 'Capture a screenshot of the current Three.js scene',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      width: z.number().optional().describe('Width in pixels'),
      height: z.number().optional().describe('Height in pixels'),
    },
  }, async (params) => {
    try {
      const result = await bridge.request('take_screenshot', (params ?? {}) as Record<string, unknown>, 15000) as {
        dataUrl: string; width: number; height: number;
      };
      const base64 = result.dataUrl.replace(/^data:image\/png;base64,/, '');

      // Save to screenshots/ folder
      let savedPath = '';
      try {
        const dir = screenshotsDir();
        const filename = `screenshot-${Date.now()}.png`;
        savedPath = path.join(dir, filename);
        fs.writeFileSync(savedPath, Buffer.from(base64, 'base64'));
      } catch { /* ignore save errors */ }

      return {
        content: [
          { type: 'image' as const, data: base64, mimeType: 'image/png' as const },
          { type: 'text' as const, text: `Screenshot: ${result.width}x${result.height}${savedPath ? `\nSaved to: ${savedPath}` : ''}` },
        ],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  });

  // Connection & config tools
  server.registerTool('bridge_status', {
    description: 'Check bridge connection and proxy status',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => {
    const lines = [
      `Bridge: ${bridge.connected ? 'connected' : 'NOT connected'}`,
      `Proxy: http://localhost:${bridge.proxyPort} → http://localhost:${bridge.devPort}`,
      '', bridge.connected
        ? 'Three.js app is accessible.'
        : `Not connected. Open http://localhost:${bridge.proxyPort} in your browser.`,
    ];
    if (!bridge.connected) lines.push('If the dev server runs on a different port, use set_dev_port.');
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  });

  server.registerTool('set_dev_port', {
    description: 'Change the dev server port the proxy forwards to',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      port: z.number().describe('The dev server port (e.g. 3000, 5173, 8080)'),
    },
  }, async (params) => {
    const oldPort = bridge.devPort;
    bridge.setDevPort(params.port as number);
    return {
      content: [{ type: 'text' as const,
        text: `Dev port changed: ${oldPort} → ${params.port}\nProxy: http://localhost:${bridge.proxyPort} → http://localhost:${params.port}\nRefresh the browser.` }],
    };
  });
}
