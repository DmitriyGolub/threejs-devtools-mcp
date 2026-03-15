# Tools Reference — threejs-devtools-mcp

39 tools for inspecting and modifying Three.js scenes.

## Scene inspection

| Tool | Description |
|------|-------------|
| `scene_tree` | Scene hierarchy — **compact text by default** (~2KB vs ~60KB JSON). Use `compact=false` for full JSON with positions/geometry. |
| `object_details` | Detailed info about a specific object by name, uuid, or path |
| `camera_details` | Camera properties and projection matrix |
| `fog_details` | Scene fog settings |
| `layer_details` | Object layer membership |
| `skeleton_details` | Skeleton/bone hierarchy for skinned meshes |

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

## Performance

| Tool | Description |
|------|-------------|
| `renderer_info` | WebGL stats: draw calls, triangles, geometries, textures, memory |
| `renderer_settings` | Renderer configuration (tone mapping, shadows, pixel ratio) |
| `performance_snapshot` | FPS, frame time, memory usage snapshot |

## Debugging

| Tool | Description |
|------|-------------|
| `highlight_object` | Visually highlight an object with a colored wireframe |
| `add_helper` | Add a visual helper (box, axes, skeleton, etc.) |
| `remove_helper` | Remove a previously added helper |
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
