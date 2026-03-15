# threejs-devtools-mcp

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

### 2. Browser opens automatically

The server auto-launches a browser at `localhost:9222` with the devtools bridge injected. Uses your system Chrome/Edge — no extra download needed.

Dev port is auto-detected from `package.json` (Next.js → 3000, Vite → 5173, etc.). Override with `DEV_PORT=5173` or tell the AI *"set dev port to 5173"*.

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

| Env Variable | Default | Description |
|---|---|---|
| `DEV_PORT` | auto-detected | Dev server port to proxy |
| `BRIDGE_PORT` | `9222` | Port the proxy listens on |
| `HTTP_PORT` | `9223` | Streamable HTTP server port (http transport only) |
| `BROWSER` | auto-open | Set to `none` to disable auto-opening the browser |
| `HEADLESS` | `false` | Set to `true` for headless Chrome (puppeteer only, for CI) |
| `CHROME_PATH` | auto-detected | Path to Chrome/Edge/Chromium executable |

## Documentation

- [Tools reference](docs/tools.md) — all 39 tools with parameters
- [Cursor setup](docs/cursor-setup.md) — step-by-step guide for Cursor
- [Token-efficient workflow](docs/workflow.md) — best practices for saving context

## License

MIT
