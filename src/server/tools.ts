import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { BridgeServer } from '../bridge/server.js';
import { bridgeTool } from './tool-helper.js';

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

  bridgeTool(server, bridge, 'set_material_property',
    'Set a material property (color, roughness, wireframe, etc.) by name or UUID',
    { name: z.string().optional().describe('Material name'),
      uuid: z.string().optional().describe('Material UUID'),
      property: z.string().describe('Property name: color, emissive, roughness, metalness, opacity, transparent, wireframe, visible, side, depthWrite, depthTest, alphaTest, flatShading, fog'),
      value: z.any().describe('New value (hex string for colors, number for scalars, boolean for flags)') });

  bridgeTool(server, bridge, 'set_uniform',
    'Set a shader uniform value on a ShaderMaterial',
    { name: z.string().optional().describe('Material name'),
      uuid: z.string().optional().describe('Material UUID'),
      uniform: z.string().describe('Uniform name (e.g. uHorizonColor, uOpacity)'),
      value: z.any().describe('New value: hex string for Color, {x,y,z} for Vector3, number for float') });

  bridgeTool(server, bridge, 'set_object_transform',
    'Set position, rotation, scale, or visibility of a scene object',
    { name: z.string().optional().describe('Object name'),
      uuid: z.string().optional().describe('Object UUID'),
      position: z.array(z.number()).length(3).optional().describe('[x, y, z]'),
      rotation: z.array(z.number()).length(3).optional().describe('[x, y, z] in radians'),
      scale: z.array(z.number()).length(3).optional().describe('[x, y, z]'),
      visible: z.boolean().optional().describe('Show/hide object') });

  bridgeTool(server, bridge, 'set_light',
    'Modify light properties: color, intensity, position, shadows',
    { name: z.string().optional().describe('Light name'),
      uuid: z.string().optional().describe('Light UUID'),
      color: z.string().optional().describe('Light color (#RRGGBB)'),
      intensity: z.number().optional().describe('Light intensity'),
      position: z.array(z.number()).length(3).optional().describe('[x, y, z]'),
      castShadow: z.boolean().optional().describe('Enable/disable shadows'),
      groundColor: z.string().optional().describe('Ground color for HemisphereLight (#RRGGBB)') });

  bridgeTool(server, bridge, 'highlight_object',
    'Highlight an object for debugging (wireframe or visibility toggle)',
    { name: z.string().optional().describe('Object name'),
      uuid: z.string().optional().describe('Object UUID'),
      mode: z.enum(['wireframe', 'visibility']).optional().describe('Highlight mode (default: wireframe)'),
      enabled: z.boolean().optional().describe('Enable/disable highlight (default: true)') });

  bridgeTool(server, bridge, 'run_js',
    'Execute arbitrary JavaScript with access to scene, renderer, camera. Returns the result.',
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
    'Modify InstancedMesh properties: count (visible instances), visibility, frustumCulled',
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
    'Modify camera: position, rotation, FOV, near/far, zoom',
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
    'Modify scene fog: color, near/far (Fog) or density (FogExp2), background color',
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
    'Modify renderer: toneMapping (0=None,1=Linear,2=Reinhard,3=Cineon,4=ACESFilmic,6=AgX,7=Neutral), exposure, colorSpace, shadows',
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
    'Control animation: mixer timeScale, action play/stop/pause/weight',
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
    'Set morph target influence on a mesh',
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
    'Set layers on an object or camera: enable/disable specific layer or set mask directly',
    { name: z.string().optional().describe('Object name'),
      uuid: z.string().optional().describe('Object UUID'),
      target: z.string().optional().describe('"camera" to target the camera'),
      layer: z.number().optional().describe('Layer number (0-31) to enable/disable'),
      enabled: z.boolean().optional().describe('Enable or disable the layer'),
      mask: z.number().optional().describe('Set layer mask directly (bitmask)') });

  // ── Debug Helpers ──────────────────────────────────────

  bridgeTool(server, bridge, 'add_helper',
    'Add a visual debug helper (box, axes, skeleton) to a scene object',
    { target: z.string().optional().describe('Target object name'),
      targetUuid: z.string().optional().describe('Target object UUID'),
      type: z.enum(['box', 'axes', 'skeleton']).optional().describe('Helper type (default: box)'),
      size: z.number().optional().describe('Size for AxesHelper (default: 1)'),
      color: z.number().optional().describe('Color as hex number for BoxHelper (default: 0x00ff00)') });

  bridgeTool(server, bridge, 'remove_helper',
    'Remove a previously added debug helper',
    { helperId: z.string().describe('Helper ID returned by add_helper') });

  // ── Texture Mutation ───────────────────────────────────

  bridgeTool(server, bridge, 'set_texture',
    'Modify texture properties: wrap, filter, anisotropy, repeat, offset, colorSpace',
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

  // Screenshot returns image content, needs special handling
  server.registerTool('take_screenshot', {
    description: 'Capture a screenshot of the current Three.js scene',
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
      return {
        content: [
          { type: 'image' as const, data: base64, mimeType: 'image/png' as const },
          { type: 'text' as const, text: `Screenshot: ${result.width}x${result.height}` },
        ],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  });

  // Connection & config tools
  server.registerTool('bridge_status', {
    description: 'Check bridge connection and proxy status',
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
