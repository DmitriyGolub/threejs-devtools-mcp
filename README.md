# threejs-devtools-mcp

[![npm version](https://img.shields.io/npm/v/threejs-devtools-mcp)](https://www.npmjs.com/package/threejs-devtools-mcp)
[![license](https://img.shields.io/npm/l/threejs-devtools-mcp)](LICENSE)
[![build](https://github.com/DmitriyGolub/threejs-devtools-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/DmitriyGolub/threejs-devtools-mcp/actions)

MCP server for inspecting and modifying Three.js scenes in real time — objects, materials, shaders, textures, animations, performance.

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

> **⚠️ Keep the browser tab open.** The MCP server talks to your scene through a WebSocket bridge in the browser. Close the tab → connection drops → tools stop working. Reopen `localhost:9222` to reconnect.

### 3. Ask the AI about your scene

That's it. The AI sees the tools automatically and uses them when relevant. Just ask:

```
"use threejs-devtools-mcp to show me the scene tree"
"why is my model invisible? check with threejs-devtools"
"what materials are in the scene?"
"make the car red"
```

> **Tip:** Some AI clients (like Claude Code) pick up MCP tools automatically. Others (like Cursor) may need a nudge — mention `threejs-devtools-mcp` in your first prompt, after that the AI will keep using it.

## Usage examples

**Inspect the scene:**
```
> "what's in the scene?"

The AI calls scene_tree and gets:
  Scene
    player [Mesh]
    ground [Mesh]
    lights [Group]
      sunLight [DirectionalLight] intensity=2
      ambientLight [AmbientLight] intensity=0.5
    trees [Group]
      tree_0 [InstancedMesh] instances=42
```

**Debug a problem:**
```
> "why is my player invisible?"

The AI checks object_details("player"):
  - visible: true, position: [0, 0, 0] ✓
  - material: MeshStandardMaterial, opacity: 0 ← found it!

> "fix it"
  → set_material_property(name="player", property="opacity", value=1)
```

**Modify the scene live:**
```
> "make the ground blue"
  → set_material_property(name="ground", property="color", value="#4488ff")

> "move the sun higher"
  → set_object_transform(name="sunLight", position=[0, 20, 0])

> "show me render stats"
  → renderer_info → draw calls: 230, triangles: 3.4M, textures: 27
```

## Tip: name your objects

The scene tree uses object names to identify things. Unnamed objects show as `(unnamed)`, making debugging harder. Always set `.name`:

```js
// Three.js
const mesh = new THREE.Mesh(geometry, material);
mesh.name = "player";
```

```jsx
// React Three Fiber
<mesh name="player" geometry={geometry} material={material} />
```

## How it works

```
AI Agent ←stdio/http→ MCP Server ←proxy :9222→ Dev Server (:3000)
                           ↕ WebSocket
                      Bridge (auto-injected into HTML)
                           ↕
                      Three.js scene
```

The proxy injects a bridge script into `<head>` before Three.js loads. The bridge captures Scene and Renderer via the official `__THREE_DEVTOOLS__` API and exposes 39 tools to the AI agent.

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

Example — headless mode for CI:

```json
{
  "env": {
    "HEADLESS": "true",
    "DEV_PORT": "3000"
  }
}
```

## Documentation

- [Tools reference](docs/tools.md) — all 39 tools with parameters
- [Cursor setup](docs/cursor-setup.md) — step-by-step guide for Cursor
- [Token-efficient workflow](docs/workflow.md) — best practices for saving context

## License

MIT
