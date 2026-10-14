# Browsers, Puppeteer & Playwright

The devtools talk to your scene through a small **bridge** script inside the page. There are three ways to get it there. The tools work the same in all of them.

| | How | Use it for |
|---|---|---|
| **1. Your browser (default)** | Open `http://localhost:9222`. The proxy injects the bridge and talks to it over WebSocket | Everyday work in any browser: Chrome, Edge, Firefox, Safari |
| **2. Launched Chrome (Puppeteer)** | `HEADLESS=true` or `PUPPETEER=true`. The server starts Chrome itself | CI, headless runs, sharing one browser with Playwright MCP (`CDP_PORT`) |
| **3. Your Playwright / Puppeteer tests** | `attachDevtools(page)` from `threejs-devtools-mcp/playwright` | e2e assertions on the scene, visual tests, no proxy needed |

## Playwright MCP + devtools in one browser

Let the AI click through your site with [Playwright MCP](https://github.com/microsoft/playwright-mcp) **and** inspect the 3D scene in the same tab:

```json
{
  "mcpServers": {
    "threejs-devtools-mcp": {
      "command": "npx",
      "args": ["-y", "threejs-devtools-mcp"],
      "env": { "CDP_PORT": "9229" }
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp", "--cdp-endpoint", "http://localhost:9229"]
    }
  }
}
```

`CDP_PORT` makes the devtools launch Chrome with remote debugging, and Playwright MCP attaches to that same browser. `bridge_status` prints the exact command.

Simpler alternative: let Playwright use its own browser and just navigate it to `http://localhost:9222`. The bridge is injected by the proxy either way.

## Playwright tests

```ts
import { test, expect } from '@playwright/test';
import { attachDevtools, waitForScene, threeCall } from 'threejs-devtools-mcp/playwright';

test.beforeEach(async ({ context }) => {
  // connect: false → in-page API only, no MCP server needed
  await attachDevtools(context, { connect: false });
});

test('car is in the scene and red', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await waitForScene(page);

  const car = await threeCall(page, 'object_details', { name: 'Car' });
  expect(car.visible).toBe(true);

  const paint = await threeCall(page, 'material_details', { name: 'CarPaint' });
  expect(paint.color).toBe('#ff0000');

  const audit = await threeCall(page, 'web_audit');
  expect(audit.findings.filter(f => f.severity === 'high')).toEqual([]);
});
```

- Method names and params are the same as the MCP tools (`scene_tree`, `object_details`, `web_audit`, …).
- With `connect: true` (the default) the page also connects to a running MCP server, so the AI can inspect the browser your test is driving.
- The same helpers accept a Puppeteer `Page` (`evaluateOnNewDocument` is used automatically).
- Without the helper: `page.evaluate(() => window.__THREEJS_DEVTOOLS_API__.call('scene_tree'))`, and wait for `window.__THREEJS_DEVTOOLS_READY__` or the `threejs-devtools:ready` event.

## Recommendations

**Wait for the scene, not for `load`.** Models and textures arrive after `load`. Use `waitForScene(page)`, then wait for your own "ready" flag if assets stream in.

**Make visual tests deterministic.**
- Freeze time: `await page.clock.install({ time: 0 })` before `goto`, so animations driven by `Date`/`performance.now` stop moving.
- Use a fixed viewport and `deviceScaleFactor: 1`; pixel ratio changes every pixel.
- Compare with a tolerance: `await expect(page).toHaveScreenshot({ maxDiffPixelRatio: 0.01 })`. GPU and driver differences are normal.

**Headless CI needs software WebGL.** Without a GPU, Chrome may refuse WebGL:

```ts
// playwright.config.ts
use: { launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } }
```

(`HEADLESS=true` adds these flags automatically when the devtools launch Chrome.)

**WebGPU in CI** is not reliably available in headless Chrome. Test the WebGL fallback of `WebGPURenderer` there, and run WebGPU checks on a machine with a GPU.

**Videos from tests.** For smooth clips use the `capture_frames` tool (virtual time, exact fps) rather than Playwright's `recordVideo`, which records in real time and drops frames when rendering is slow.
