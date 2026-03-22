# Advanced Setup

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
AI Agent <-stdio/http-> MCP Server <-proxy :9222-> Dev Server (:3000)
                            | WebSocket
                       Bridge (auto-injected into HTML)
                            |
                       Three.js scene
```

The proxy injects a bridge script into `<head>` before Three.js loads. The bridge captures Scene and Renderer via the official `__THREE_DEVTOOLS__` API and exposes 52 tools to the AI agent. Screenshots and texture previews are saved to a `screenshots/` folder in your project.

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

## Transports

| Transport | Command | Use case |
|---|---|---|
| **stdio** (default) | `npx threejs-devtools-mcp` | Claude Code, Claude Desktop, Cursor, Windsurf, VS Code |
| **Streamable HTTP** | `npx threejs-devtools-mcp-http` | Cursor, Windsurf, or any HTTP MCP client |

The HTTP transport runs on `http://localhost:9223/mcp` (configurable via `HTTP_PORT`).
