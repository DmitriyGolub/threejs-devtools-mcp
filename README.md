# threejs-devtools-mcp

[![npm version](https://img.shields.io/npm/v/threejs-devtools-mcp)](https://www.npmjs.com/package/threejs-devtools-mcp)
[![license](https://img.shields.io/npm/l/threejs-devtools-mcp)](LICENSE)
[![build](https://github.com/DmitriyGolub/threejs-devtools-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/DmitriyGolub/threejs-devtools-mcp/actions)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://mcp-marketplace.io/server/io-github-dmitriygolub-threejs-devtools)

MCP server for inspecting and modifying Three.js scenes in real time — 52 tools for objects, materials, shaders, textures, animations, performance monitoring, memory diagnostics, console capture, and code generation.

**Zero changes to your project.** Works with vanilla Three.js, React Three Fiber, and any framework.

## Setup

### 1. Add the MCP server

<details open>
<summary><strong>Claude Code</strong></summary>

```bash
claude mcp add threejs-devtools-mcp -- npx threejs-devtools-mcp
```

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "threejs-devtools-mcp": {
      "command": "npx",
      "args": ["-y", "threejs-devtools-mcp"]
    }
  }
}
```

</details>

<details>
<summary><strong>Cursor</strong></summary>

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "threejs-devtools-mcp": {
      "command": "npx",
      "args": ["-y", "threejs-devtools-mcp"]
    }
  }
}
```

Or use the HTTP transport — see [Cursor setup guide](docs/cursor-setup.md).

</details>

<details>
<summary><strong>Windsurf</strong></summary>

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "threejs-devtools-mcp": {
      "command": "npx",
      "args": ["-y", "threejs-devtools-mcp"]
    }
  }
}
```

</details>

<details>
<summary><strong>VS Code (Copilot)</strong></summary>

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "threejs-devtools-mcp": {
      "command": "npx",
      "args": ["-y", "threejs-devtools-mcp"]
    }
  }
}
```

</details>

### 2. Start your dev server and open the browser

Start your Three.js dev server as usual (`npm run dev`). The MCP server auto-detects the port from `package.json` (Next.js → 3000, Vite → 5173, etc.) and opens a browser at `localhost:9222` with the devtools bridge injected.

> **Keep the browser tab open.** The MCP server talks to your scene through a WebSocket bridge in the browser. Close the tab → connection drops → tools stop working. Reopen `localhost:9222` to reconnect.

### 3. Ask the AI about your scene

The AI sees the tools automatically and uses them when relevant. Just ask:

```
"show me the scene tree"
"why is my model invisible?"
"make the car red"
"check for memory leaks"
"what's my FPS?"
"show me the diffuse texture"
"generate a React component from my model.glb"
```

> **Tip:** Some AI clients (like Claude Code) pick up MCP tools automatically. Others (like Cursor) may need a nudge — mention `threejs-devtools-mcp` in your first prompt.

## Usage examples

**Inspect and debug:**
```
> "what's in the scene?"
  → scene_tree → player, ground, lights, trees (42 instances)

> "why is my player invisible?"
  → object_details("player") → opacity: 0 ← found it!
  → set_material_property(name="player", property="opacity", value=1)

> "find all invisible meshes"
  → find_objects(type="Mesh", visible=false) → 3 hidden meshes

> "check for memory leaks"
  → dispose_check → 12 orphaned geometries, 4 orphaned textures

> "are there any errors in the browser?"
  → console_capture → 2 errors: "Texture format not supported", "Shader compile failed"
```

**Performance and visuals:**
```
> "what's my FPS?"
  → perf_monitor(duration=3) → avg: 58 FPS, p99: 22ms, 3 spikes

> "show me the diffuse texture"
  → texture_preview(name="diffuse") → [image] 1024x1024, saved to screenshots/

> "take a screenshot"
  → take_screenshot → [image] 1920x1080, saved to screenshots/screenshot-1234.png

> "click on an object to inspect it"
  → click_inspect → user clicks → road_0 [Mesh], MeshStandardMaterial, distance: 12.3
```

**Modify the scene live:**
```
> "make the ground blue"
  → set_material_property(name="ground", property="color", value="#4488ff")

> "switch animation to Idle"
  → set_animation(clipName="Idle", play=true)

> "convert my character.glb to a React component"
  → gltf_to_r3f(filePath="public/character.glb")
  → Generated CharacterModel.tsx with useGLTF, useAnimations
```

## Tip: name your objects

The scene tree uses object names to identify things. Unnamed objects show as `(unnamed)`, making debugging harder:

```js
// Three.js
mesh.name = "player";
```

```jsx
// React Three Fiber
<mesh name="player" geometry={geometry} material={material} />
```

## Animations

Works out of the box with vanilla Three.js. For **React Three Fiber** with `useAnimations`, add 2 lines to expose the mixer and clips:

```tsx
const { actions, mixer } = useAnimations(animations, group);

// Expose for devtools:
useEffect(() => {
  if (group.current) group.current.animations = animations;
  window.__THREE_ANIMATION_MIXERS__ = [mixer];
  return () => { window.__THREE_ANIMATION_MIXERS__ = []; };
}, [animations, mixer]);
```

**Why?** R3F's `useAnimations` stores the mixer in a React closure — JavaScript cannot access closure variables from outside. Without these lines, devtools can detect an active mixer but cannot control it.

For vanilla Three.js:

```js
window.__THREE_ANIMATION_MIXERS__ = [mixer];
model.animations = gltf.animations;
```

## Scene export

The `scene_export` tool requires `GLTFExporter` to be available. Add to your app:

```js
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
window.GLTFExporter = GLTFExporter;
```

## How it works

```
AI Agent ←stdio/http→ MCP Server ←proxy :9222→ Dev Server (:3000)
                           ↕ WebSocket
                      Bridge (auto-injected into HTML)
                           ↕
                      Three.js scene
```

The proxy injects a bridge script into `<head>` before Three.js loads. The bridge captures Scene and Renderer via the official `__THREE_DEVTOOLS__` API and exposes 52 tools to the AI agent. Screenshots and texture previews are saved to a `screenshots/` folder in your project.

## Transports

| Transport | Command | Use case |
|---|---|---|
| **stdio** (default) | `npx threejs-devtools-mcp` | Claude Code, Claude Desktop, Cursor, Windsurf, VS Code |
| **Streamable HTTP** | `npx threejs-devtools-mcp-http` | Cursor, Windsurf, or any HTTP MCP client |

The HTTP transport runs on `http://localhost:9223/mcp` (configurable via `HTTP_PORT`).

## Configuration

All settings are optional. The defaults work out of the box.

| Env Variable | Default | Description |
|---|---|---|
| `DEV_PORT` | auto-detected | Dev server port to proxy |
| `BRIDGE_PORT` | `9222` | Port the proxy listens on |
| `HTTP_PORT` | `9223` | Streamable HTTP server port (http transport only) |
| `BROWSER` | auto-open | Set to `none` to disable auto-opening the browser |
| `PUPPETEER` | `false` | Set to `true` to launch via puppeteer instead of system browser |
| `HEADLESS` | `false` | Set to `true` for headless Chrome (implies PUPPETEER=true, for CI) |
| `CHROME_PATH` | auto-detected | Path to Chrome/Edge/Chromium executable |

Example — custom dev port, no browser auto-open:

```json
{
  "mcpServers": {
    "threejs-devtools-mcp": {
      "command": "npx",
      "args": ["-y", "threejs-devtools-mcp"],
      "env": {
        "DEV_PORT": "5173",
        "BROWSER": "none"
      }
    }
  }
}
```

## Documentation

- [Tools reference](docs/tools.md) — all 52 tools with parameters
- [Cursor setup](docs/cursor-setup.md) — step-by-step guide for Cursor
- [Token-efficient workflow](docs/workflow.md) — best practices for saving context

## License

MIT
