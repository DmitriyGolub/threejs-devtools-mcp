# Tools Reference — threejs-devtools-mcp

69 tools. Every tool belongs to exactly **one mode**, and the AI client sees that mode as a label at the start of the tool's description:

| Mode | Label | What it does | Saved? |
|---|---|---|---|
| Inspect | `[INSPECT]` | Reads the scene. Changes nothing. | — |
| Live preview | `[LIVE PREVIEW]` | Changes the scene **in the browser only**. Recorded in `pending_changes`. | No, lost on reload |
| Debug visual | `[DEBUG VISUAL]` | Temporary helpers: wireframe, boxes, overlay. | No, never needed in code |
| For code | `[FOR CODE]` | Output meant to be written into your source files. | Yes, once the agent writes it |
| Connection | `[CONNECTION]` | Configures the devtools server itself. | — |

> **Look now vs. change the code.** Live-preview tools never touch your files. To keep a preview, the agent calls `pending_changes`, which returns each change as before → after with ready-to-paste code for vanilla Three.js and React Three Fiber. The agent then edits your source. `revert_changes` undoes previews in the browser.

## Inspect — read-only

### Scene

| Tool | Description |
|------|-------------|
| `scene_tree` | Scene hierarchy. **Compact text by default** (~2KB vs ~60KB JSON); `compact=false` for full JSON |
| `object_details` | One object by name, uuid, or dot path |
| `find_objects` | Search by type, material, visibility, name regex, custom property |
| `raycast` | Hit objects under a screen coordinate |
| `click_inspect` | Crosshair cursor; the user clicks an object, you get its details |
| `scene_diff` | Snapshot, then diff: added/removed/modified objects |
| `layer_details` | Camera layer mask and objects on non-default layers |
| `overlay_selected` | Everything about the object selected in the in-browser overlay |

### Materials, shaders, textures

| Tool | Description |
|------|-------------|
| `material_list` | All materials |
| `material_details` | Colors, PBR + **MeshPhysical** params (clearcoat, transmission, sheen, iridescence…), maps, uniforms, **NodeMaterial/TSL slots** |
| `shader_list` | Compiled programs (WebGL) |
| `shader_source` | GLSL source + uniforms. NodeMaterial/TSL: explains where to edit instead |
| `texture_list` / `texture_details` | Size, format, wrap, filter |
| `texture_preview` | The texture as an image |

### Lighting & environment

| Tool | Description |
|------|-------------|
| `shadow_details` | Shadow maps, bias, shadow camera, casters/receivers |
| `scene_background` / `env_map_details` | Background, environment (IBL), per-material envMap |
| `fog_details` | Fog / FogExp2 |

### Camera, renderer, post-processing

| Tool | Description |
|------|-------------|
| `camera_details` | Active camera |
| `renderer_info` | Draw calls, triangles, memory, **backend (`webgl` / `webgpu`)** |
| `renderer_settings` | Tone mapping, exposure, color space, shadow map, pixel ratio |
| `clipping_details` | Global, per-material, and ClippingGroup planes |
| `postprocessing_list` | EffectComposer passes and effects |

### Geometry & animation

| Tool | Description |
|------|-------------|
| `geometry_details` | Attributes, index, bounds, morph attributes |
| `instanced_mesh_details` / `batched_mesh_details` | Instancing data |
| `morph_targets` / `skeleton_details` | Morphs and bones |
| `animation_details` | Mixers, actions, clips, weights |

### Performance & websites

| Tool | Description |
|------|-------------|
| `web_audit` | **Website health check**: pixel ratio, canvas resize, idle/off-screen rendering, antialias cost, oversized/uncompressed textures, shadow cost, color space, draw calls. Every finding includes a fix |
| `perf_monitor` | Record FPS for N seconds: avg/min/max, p50/p95/p99, jank |
| `performance_snapshot` | Draw calls, triangles, objects by type |
| `draw_call_breakdown` | Most expensive objects first |
| `memory_stats` | GPU memory by geometry/texture |
| `dispose_check` | Leak detection |
| `console_capture` | Browser console log/warn/error |

### Screenshots, video, export

| Tool | Description |
|------|-------------|
| `take_screenshot` | PNG of the scene |
| `annotated_screenshot` | Screenshot with object labels |
| `capture_frames` | **Frame sequence for videos.** Time is virtualised, so frames are exactly 1/fps apart and smooth however slowly they render. Returns `ffmpeg` commands for MP4 and WebM |
| `scene_export` | GLB/glTF export |

## Live preview — browser only, not saved

All of these are recorded in the change journal. `pending_changes` turns them into code, and `revert_changes` undoes them.

| Tool | Changes |
|------|---------|
| `set_object_transform` | position, rotation, scale, visible |
| `set_material_property` | color, emissive, roughness, metalness, opacity, physical params… (by material **or** mesh name) |
| `set_uniform` | ShaderMaterial uniforms |
| `set_texture` | wrap, filter, anisotropy, repeat, offset, rotation, colorSpace |
| `set_light` | color, intensity, position, castShadow |
| `set_shadow` | cast/receive, bias, mapSize, shadow camera |
| `set_fog` | fog color/near/far/density, background color |
| `set_camera` | position, rotation, fov, near/far, zoom |
| `set_renderer` | toneMapping, exposure, color space, pixel ratio, shadows |
| `set_clipping` | renderer or material clipping planes |
| `set_postprocessing` | pass enabled, uniforms, effect params |
| `set_instanced_mesh` | count, visible, frustumCulled |
| `set_morph_target` | morph influence |
| `set_animation` | timeScale, play/stop/pause, weight |
| `set_layers` | object/camera layers |
| `revert_changes` | Undo previews (all, or by id) |

## Debug visual — temporary, never in code

| Tool | Description |
|------|-------------|
| `toggle_overlay` | In-browser inspector panel |
| `highlight_object` | Point an object out (wireframe/visibility) |
| `toggle_wireframe` | Wireframe on everything or one object |
| `bounding_boxes` | Show bounds |
| `add_helper` / `remove_helper` | Axes, grid, light/camera/skeleton helpers… |
| `run_js` | Run JS in the page. *Not* recorded in the change journal; prefer `set_*` for anything you may keep |

## For code

| Tool | Description |
|------|-------------|
| `pending_changes` | All preview changes as before → after + code (`style`: `vanilla`, `r3f`, `both`); `clear=true` after writing them to the source |
| `gltf_to_r3f` | GLB/glTF → React Three Fiber component (like gltfjsx) |

Example output of `pending_changes`:

````md
## Material "CarPaint" (MeshPhysicalMaterial) — used by Scene.Car.Body
```js
const material = scene.getObjectByName('Body').material;
material.color.set('#ff0000');
```
```jsx
<meshPhysicalMaterial color="#ff0000" />
```
- #1 color: "#3366ff" → "#ff0000"
````

## Connection

| Tool | Description |
|------|-------------|
| `bridge_status` | Connection state, proxy target, and how to attach Playwright to the same browser |
| `set_dev_port` | Point the proxy at another local port |
| `set_dev_url` | Inspect a remote app by URL (previews only: no source code) |

## Skills (MCP prompts)

Ready-made workflows. Clients show them as slash commands, e.g. `/threejs-devtools-mcp:web-perf-audit` in Claude Code.

| Prompt | What it does |
|---|---|
| `inspect-scene` | Overview plus the top 3 problems. Looks only |
| `try-look` | Try an idea live; nothing is written to code |
| `apply-to-code` | Write the previewed changes into your source |
| `web-perf-audit` | Website performance audit with prioritised fixes |
| `prepare-video` | Check the scene for video artefacts and record frames |
| `debug-invisible` | Checklist for "why can't I see X" |
| `playwright-setup` | Connect Playwright (MCP or tests) to the scene |

## Key parameters

### `scene_tree`

| Param | Default | Description |
|-------|---------|-------------|
| `compact` | `true` | Compact text tree. `false` for full JSON |
| `depth` | `3` | Max tree depth |
| `maxChildren` | `15` (compact) / `100` (JSON) | Max children per node |
| `types` | all | Filter by type: `Mesh`, `Light`, `Group`, … |

### `capture_frames`

| Param | Default | Description |
|-------|---------|-------------|
| `fps` | `30` | Frames per second |
| `duration` | `3` | Seconds (max 1800 frames) |
| `format` | `png` | `png` lossless or `jpeg` smaller |
| `width` / `height` | canvas | Output size |

### `perf_monitor`

| Param | Default | Description |
|-------|---------|-------------|
| `duration` | `3` | Seconds (max 30) |
| `includeFrameTimes` | `false` | Include raw frame times |

### `pending_changes`

| Param | Default | Description |
|-------|---------|-------------|
| `style` | `both` | `vanilla`, `r3f` or `both` |
| `clear` | `false` | Forget the listed changes once they are in code |
