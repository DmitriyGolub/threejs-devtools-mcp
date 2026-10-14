/**
 * Playwright / Puppeteer helpers — `import { … } from 'threejs-devtools-mcp/playwright'`.
 *
 * Injects the devtools bridge into any page (no proxy needed), waits for the
 * Three.js scene, and calls the same handlers the MCP tools use — for e2e
 * assertions, or so an AI agent can inspect the browser your tests drive.
 *
 * Duck-typed: no dependency on playwright or puppeteer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Playwright Page/BrowserContext (addInitScript) or Puppeteer Page (evaluateOnNewDocument) */
export interface InitScriptTarget {
  addInitScript?: (script: { content: string }) => Promise<unknown>;
  evaluateOnNewDocument?: (source: string) => Promise<unknown>;
}

export interface EvaluatePage {
  evaluate<R, A>(fn: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
}

export interface AttachOptions {
  /** MCP bridge port, so the running MCP server can see this page (default: 9222) */
  port?: number;
  /** Connect to the MCP server. false = in-page API only, e.g. plain e2e tests (default: true) */
  connect?: boolean;
  /** Show the in-browser inspector overlay (default: false) */
  overlay?: boolean;
}

let cachedBridge: string | null = null;

function bridgeSource(): string {
  if (cachedBridge) return cachedBridge;
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const p of ['inject.global.js', '../dist/inject.global.js']) {
    try { return (cachedBridge = fs.readFileSync(path.resolve(here, p), 'utf-8')); } catch { /* next */ }
  }
  throw new Error('threejs-devtools-mcp: dist/inject.global.js not found — is the package built?');
}

/** The script attachDevtools injects, for custom setups */
export function bridgeScript({ port = 9222, connect = true, overlay = false }: AttachOptions = {}): string {
  return [
    `window.__THREEJS_DEVTOOLS_PORT__=${port};`,
    connect ? '' : 'window.__THREEJS_DEVTOOLS_NO_WS__=true;',
    overlay ? '' : 'window.__THREEJS_DEVTOOLS_NO_OVERLAY__=true;',
    bridgeSource(),
  ].join('');
}

/**
 * Inject the bridge into every page opened from now on. Call before page.goto().
 * Works with a Playwright Page or BrowserContext, or a Puppeteer Page.
 */
export async function attachDevtools(target: InitScriptTarget, options: AttachOptions = {}): Promise<void> {
  const content = bridgeScript(options);
  if (target.addInitScript) await target.addInitScript({ content });
  else if (target.evaluateOnNewDocument) await target.evaluateOnNewDocument(content);
  else throw new Error('attachDevtools: expected a Playwright Page/BrowserContext or a Puppeteer Page');
}

/** Wait until the bridge has found the scene and renderer */
export async function waitForScene(page: EvaluatePage, { timeout = 15000 } = {}): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.evaluate(() => !!(window as any).__THREEJS_DEVTOOLS_READY__, undefined)) return;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`Three.js scene not found within ${timeout} ms — is attachDevtools() called before page.goto()?`);
}

/**
 * Call a devtools handler in the page. Method names match the MCP tools:
 * threeCall(page, 'object_details', { name: 'Car' })
 */
export function threeCall<T = any>(page: EvaluatePage, method: string, params: Record<string, unknown> = {}): Promise<T> {
  return page.evaluate(
    ([m, p]: [string, Record<string, unknown>]) => (window as any).__THREEJS_DEVTOOLS_API__.call(m, p),
    [method, params] as [string, Record<string, unknown>],
  ) as Promise<T>;
}
