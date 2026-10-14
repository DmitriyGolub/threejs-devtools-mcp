import fs from 'node:fs';
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import type { BridgeServer } from '../bridge/server.js';

/**
 * Every tool has exactly one mode. It decides the label the AI client sees,
 * the MCP annotations, and the note appended to results — so "look", "try"
 * and "change the code" never get mixed up.
 */
export type ToolMode =
  /** Reads the scene. Changes nothing. */
  | 'inspect'
  /** Changes the scene in the browser only; recorded in pending_changes, lost on reload. */
  | 'preview'
  /** Temporary visual aid (helpers, wireframe, overlay). Never belongs in code. */
  | 'debug'
  /** Produces output meant to be written into the project's source files. */
  | 'code'
  /** Configures this MCP server itself. */
  | 'connection';

const LABELS: Record<ToolMode, string> = {
  inspect: '[INSPECT] Read-only.',
  preview: '[LIVE PREVIEW] Changes the scene in the browser only — NOT saved to source code, lost on reload. '
    + 'Recorded in pending_changes (→ code edits) and undoable with revert_changes.',
  debug: '[DEBUG VISUAL] Temporary visual aid in the browser. Nothing to put in code.',
  code: '[FOR CODE] Output is meant to be written into the project source files.',
  connection: '[CONNECTION] Configures the devtools server.',
};

const ANNOTATIONS: Record<ToolMode, ToolAnnotations> = {
  inspect: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  preview: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  debug: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  code: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  connection: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

export interface ToolContext {
  server: McpServer;
  bridge: BridgeServer;
}

type Shape = Record<string, z.ZodType>;

export interface ToolOptions {
  /** Bridge request timeout (default: bridge default) */
  timeoutMs?: number;
  /** Override the mode's default annotations */
  annotations?: Partial<ToolAnnotations>;
}

// ── Results ──────────────────────────────────────────────

export function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}

export function errorResult(err: unknown): CallToolResult {
  return { content: [{ type: 'text', text: `Error: ${(err as Error).message}` }], isError: true };
}

/** Folder for screenshots, previews, exports and frame sequences (created on demand) */
export function outputDir(...sub: string[]): string {
  const dir = path.join(process.cwd(), 'screenshots', ...sub);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Strip the data-URL prefix, save the image, and return it as MCP image content + caption */
export function imageResult(dataUrl: string, fileName: string, caption: string): CallToolResult {
  const [, mimeType = 'image/png', data = ''] = dataUrl.match(/^data:([^;]+);base64,(.*)$/) ?? [];
  let saved = '';
  try {
    saved = path.join(outputDir(), fileName);
    fs.writeFileSync(saved, Buffer.from(data, 'base64'));
  } catch { /* saving is a convenience — still return the image */ }

  return {
    content: [
      { type: 'image', data, mimeType },
      { type: 'text', text: saved ? `${caption}\nSaved to: ${saved}` : caption },
    ],
  };
}

// ── Registration ─────────────────────────────────────────

/** Register a tool with a custom implementation */
export function tool<S extends Shape>(
  { server }: ToolContext,
  name: string,
  mode: ToolMode,
  description: string,
  schema: S,
  run: (params: z.infer<z.ZodObject<S>>) => Promise<CallToolResult>,
  options: ToolOptions = {},
): void {
  server.registerTool(name, {
    description: `${LABELS[mode]}\n${description}`,
    annotations: { ...ANNOTATIONS[mode], ...options.annotations },
    inputSchema: schema,
  }, (async (params: z.infer<z.ZodObject<S>>) => {
    try { return await run(params); } catch (err) { return errorResult(err); }
  }) as any);
}

/** Note appended to preview/debug results so the agent knows nothing reached the code */
function resultNote(mode: ToolMode, result: unknown, bridge: BridgeServer): string | null {
  if (mode === 'preview') {
    if (bridge.isRemote) return 'Live preview on a remote app — lost on reload. No local source code to update.';
    const pending = (result as { pendingChanges?: number })?.pendingChanges;
    return `Live preview only — not saved. ${pending ?? 'Some'} pending change(s): `
      + 'pending_changes → code to persist them, revert_changes → undo.';
  }
  if (mode === 'debug') return 'Debug visual — browser only, resets on reload.';
  return null;
}

/** Register a tool that forwards its params to the browser bridge handler of the same name */
export function bridgeTool<S extends Shape>(
  ctx: ToolContext,
  name: string,
  mode: ToolMode,
  description: string,
  schema: S = {} as S,
  options: ToolOptions = {},
): void {
  tool(ctx, name, mode, description, schema, async (params) => {
    const result = await ctx.bridge.request(name, params as Record<string, unknown>, options.timeoutMs);
    const out = textResult(JSON.stringify(result, null, 2));
    // Separate content block keeps the first one valid JSON
    const note = resultNote(mode, result, ctx.bridge);
    if (note) out.content.push({ type: 'text', text: `_note: ${note}` });
    return out;
  }, options);
}
