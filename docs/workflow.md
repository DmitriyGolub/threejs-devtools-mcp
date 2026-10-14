# Token-Efficient Workflow — threejs-devtools-mcp

## The problem

A full `scene_tree` JSON can be **60KB+** — that's a huge chunk of context wasted on data you don't need.

## The solution

`scene_tree` returns **compact text by default** (~2KB, 97% smaller). Use targeted tools for details.

## Recommended workflow

```
1. scene_tree              → compact overview (~2KB)
2. Find object by name
3. object_details(name)    → specifics for one object
4. material_details(name)  → material properties
5. Change it — see below: preview in the browser, or edit the code
```

## Look now vs. change the code

| You say | What happens | Saved? |
|---|---|---|
| "try the car in red", "what if the fog was denser" | **Live preview**: `set_*` tools change the running scene, then a screenshot | No, lost on reload |
| "keep it", "save that" | `pending_changes` → the agent edits your source → `pending_changes clear=true` | Yes |
| "undo" | `revert_changes` restores the previous values in the browser | — |
| "make the car red", "fix the shadows" | The agent edits your source directly (a preview first is optional) | Yes |

```
→ set_material_property(name="Body", property="color", value="#ff0000")
← { success: true, … }   _note: Live preview only — not saved. 1 pending change(s) …

→ pending_changes(style="r3f")
← ## Material "CarPaint" (MeshPhysicalMaterial) — used by Scene.Car.Body
  <meshPhysicalMaterial color="#ff0000" />
  - #1 color: "#3366ff" → "#ff0000"
```

## Examples

### "What's in the scene?"

```
→ scene_tree
← sky [Group]
    skyGradient [Mesh]
    sunDisk [Mesh]
    sunLight [DirectionalLight] intensity=2
  environment [Group]
    env_0 [InstancedMesh] instances=42
    env_1 [InstancedMesh] instances=18
  road [Group]
    road_0 [Mesh]
    road_1 [Mesh]
    ...
```

### "What material does the road use?"

```
→ material_details(name="road_0")
← { type: "MeshStandardMaterial", color: "#8B7355", map: "road_diffuse.png", ... }
```

### "I need full JSON with positions"

```
→ scene_tree(compact=false, depth=2)
← { name: "Scene", type: "Scene", children: [ { name: "sky", position: [0, 10, 0], ... } ] }
```

## When to use `compact=false`

- You need exact positions/rotations of multiple objects
- You're debugging a layout or transform issue
- You need geometry/vertex counts for the whole scene
- Otherwise, always use the default compact mode
