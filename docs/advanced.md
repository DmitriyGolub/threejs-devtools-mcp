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

The proxy injects a bridge script into `<head>` before Three.js loads. Launched Chrome (Puppeteer) and Playwright tests are covered in [Browsers, Puppeteer & Playwright](playwright.md). The bridge captures Scene and Renderer via the official `__THREE_DEVTOOLS__` API and exposes 69 tools to the AI agent. Screenshots and texture previews are saved to a `screenshots/` folder in your project.

## Configuration

All settings are optional. The defaults work out of the box.

| Env Variable | Default | Description |
|---|---|---|
| `DEV_PORT` | auto-detected | Dev server port to proxy |
| `DEV_URL` | — | Remote app URL instead of a local dev server (previews only, no source code) |
| `BRIDGE_PORT` | `9222` | Port the proxy listens on |
| `HTTP_PORT` | `9223` | Streamable HTTP server port (http transport only) |
| `BROWSER` | auto-open | Set to `none` to disable auto-opening the browser |
| `PUPPETEER` | `false` | Set to `true` to launch via puppeteer instead of system browser |
| `HEADLESS` | `false` | Set to `true` for headless Chrome (implies PUPPETEER=true, adds software-WebGL flags for CI) |
| `CDP_PORT` | — | Launch Chrome with remote debugging on this port so Playwright MCP can share the browser (implies PUPPETEER=true) |
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

## Requirements

Node.js 22.18+ (or 24.11+). Works with WebGLRenderer and WebGPURenderer (WebGPU or its WebGL2 fallback), vanilla Three.js and React Three Fiber.

## Shader patching recipe (`run_js`)

When experimenting with `onBeforeCompile` patches through `run_js`:

1. Reset any patch flags your code sets and stop old animation loops you started.
2. Use **one** `onBeforeCompile` pass. Never chain them; combine all effects in one function.
3. Replace a chunk such as `#include <project_vertex>` with your full transform, keeping the `USE_BATCHING` / `USE_INSTANCING` guards.
4. Declare uniforms before `main()`: `shader.vertexShader = shader.vertexShader.replace('void main() {', 'uniform float uTime;
void main() {')`.
5. Force recompilation: `mat.customProgramCacheKey = () => 'effect-' + Date.now(); mat.needsUpdate = true;`.
6. Animate uniforms from your own `requestAnimationFrame` loop.

`run_js` changes are **not** recorded in `pending_changes`. Once the effect looks right, write it into your material code.

For NodeMaterial (TSL / WebGPU) there is no GLSL to patch: set `colorNode`, `positionNode`, etc. in your source instead.
