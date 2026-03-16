# Tools Reference — threejs-devtools-mcp

47 tools for inspecting, debugging, and modifying Three.js scenes.

## Scene inspection

| Tool | Description |
|------|-------------|
| `scene_tree` | Scene hierarchy — **compact text by default** (~2KB vs ~60KB JSON). Use `compact=false` for full JSON with positions/geometry. |
| `object_details` | Detailed info about a specific object by name, uuid, or path |
| `find_objects` | **Search** objects by type, material, visibility, name pattern, or custom property |
| `camera_details` | Camera properties and projection matrix |
| `fog_details` | Scene fog settings |
| `layer_details` | Object layer membership |
| `skeleton_details` | Skeleton/bone hierarchy for skinned meshes |
| `env_map_details` | Environment maps: scene.environment, scene.background, per-material envMap, IBL settings |

## Materials & textures

| Tool | Description |
|------|-------------|
| `material_list` | List all materials in the scene |
| `material_details` | Full material properties (color, map, uniforms, etc.) |
| `texture_list` | List all textures |
| `texture_details` | Texture info (size, format, wrapping, filtering) |

## Shaders

| Tool | Description |
|------|-------------|
| `shader_list` | List all ShaderMaterial/RawShaderMaterial programs |
| `shader_source` | Get vertex/fragment shader source code |

## Geometry & instances

| Tool | Description |
|------|-------------|
| `geometry_details` | Geometry attributes, vertex count, bounding box |
| `instanced_mesh_details` | InstancedMesh instance data (transforms, colors) |
| `morph_targets` | Morph target names and weights |

## Animation

| Tool | Description |
|------|-------------|
| `animation_details` | Animation clips, mixer state, actions |
| `set_animation` | Play/pause/stop animations, set time/weight |

## Performance & memory

| Tool | Description |
|------|-------------|
| `renderer_info` | WebGL stats: draw calls, triangles, geometries, textures, memory |
| `renderer_settings` | Renderer configuration (tone mapping, shadows, pixel ratio) |
| `performance_snapshot` | FPS, frame time, memory usage snapshot |
| `memory_stats` | **GPU memory analysis**: geometry buffers, texture VRAM, instance data, top textures by size |
| `dispose_check` | **Leak detection**: orphaned geometries/textures not in scene but tracked by renderer |

## Post-processing

| Tool | Description |
|------|-------------|
| `postprocessing_list` | List EffectComposer passes: render passes, shader passes, effects (bloom, SSAO, etc.) |

## Debugging

| Tool | Description |
|------|-------------|
| `highlight_object` | Visually highlight an object with a colored wireframe |
| `toggle_wireframe` | **Wireframe mode** on all materials or a specific object |
| `bounding_boxes` | **Show/hide AABB** for objects — debug frustum culling and bounds |
| `add_helper` | Add a visual helper (box, axes, skeleton, etc.) |
| `remove_helper` | Remove a previously added helper |
| `scene_diff` | **Compare scene state** over time — track added/removed/modified objects |
| `raycast` | Cast a ray and return intersected objects |
| `take_screenshot` | Capture a screenshot (base64 PNG) |
| `run_js` | Execute arbitrary JavaScript in the browser context |

## Modification

| Tool | Description |
|------|-------------|
| `set_object_transform` | Set position, rotation, or scale |
| `set_material_property` | Change material properties (color, opacity, wireframe, etc.) |
| `set_texture` | Swap or modify textures |
| `set_uniform` | Set shader uniform values |
| `set_light` | Adjust light intensity, color, shadow settings |
| `set_fog` | Modify scene fog |
| `set_layers` | Change object layer membership |
| `set_morph_target` | Set morph target weights |
| `set_instanced_mesh` | Modify individual instance transforms |
| `set_renderer` | Change renderer settings |
| `set_camera` | Modify camera properties |
| `set_shadow` | Configure shadow map settings |

## Code generation

| Tool | Description |
|------|-------------|
| `gltf_to_r3f` | Convert a **GLB/GLTF file to a React Three Fiber component** (like gltfjsx). Generates TypeScript with useGLTF, useAnimations, morph targets, skinned meshes. |

## Connection

| Tool | Description |
|------|-------------|
| `bridge_status` | Check if the bridge is connected |
| `set_dev_port` | Change the proxied dev server port |

## Key parameters

### `scene_tree`

| Param | Default | Description |
|-------|---------|-------------|
| `compact` | `true` | Compact text tree. Set `false` for full JSON. |
| `depth` | `3` | Max tree depth |
| `maxChildren` | `15` (compact) / `100` (JSON) | Max children per node |
| `types` | all | Filter by type: `Mesh`, `Light`, `Group`, etc. |

### `find_objects`

| Param | Default | Description |
|-------|---------|-------------|
| `type` | — | Object type: `Mesh`, `InstancedMesh`, `Light`, etc. |
| `material` | — | Material name or type |
| `visible` | — | Filter by visibility |
| `namePattern` | — | Regex pattern to match names |
| `property` | — | Custom property name to check |
| `value` | — | Expected value for the property |
| `hasGeometry` | — | Objects with/without geometry |
| `limit` | `50` | Max results (max: 200) |

### `scene_diff`

| Param | Default | Description |
|-------|---------|-------------|
| `action` | `auto` | `snapshot` = save state, `diff` = compare with saved, `auto` = snapshot if none, diff if exists |

### `gltf_to_r3f`

| Param | Default | Description |
|-------|---------|-------------|
| `filePath` | — | Path to .glb or .gltf file |
| `typescript` | `true` | Generate TypeScript |
| `preload` | `true` | Add `useGLTF.preload()` call |
