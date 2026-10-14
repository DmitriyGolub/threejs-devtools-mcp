/**
 * Ready-made workflows exposed as MCP prompts — clients show them as slash
 * commands (e.g. /threejs-devtools-mcp:web-perf-audit in Claude Code).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

function userPrompt(text: string) {
  return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] };
}

interface PromptDef {
  name: string;
  title: string;
  description: string;
  args?: Record<string, z.ZodType<string | undefined>>;
  text: (args: Record<string, string | undefined>) => string;
}

const PROMPTS: PromptDef[] = [
  {
    name: 'inspect-scene',
    title: 'Inspect scene',
    description: 'Overview of the running scene and its problems — looks only, changes nothing.',
    text: () => `Inspect my Three.js scene without changing anything.
1. bridge_status — make sure the bridge is connected.
2. scene_tree (compact) and annotated_screenshot to understand the layout.
3. renderer_info, draw_call_breakdown, memory_stats, console_capture (level=error).
Summarise: what is in the scene, the 3 biggest problems (performance, visuals, errors), and what you would change. Do not use any LIVE PREVIEW tool.`,
  },
  {
    name: 'try-look',
    title: 'Try a look (preview only)',
    description: 'Try a visual change live in the browser. Nothing is written to code.',
    args: { idea: z.string().describe('What to try, e.g. "warmer sunset lighting"') },
    text: ({ idea }) => `Try this in the live scene: ${idea}
Use only LIVE PREVIEW tools (set_*), then take_screenshot to show the result.
Do NOT edit any source files. End with a short list of what was changed and tell me:
"This is a preview only. Say 'keep it' to write it into the code, or 'undo' to revert."`,
  },
  {
    name: 'apply-to-code',
    title: 'Apply preview to code',
    description: 'Write the live-preview changes into the project source.',
    text: () => `Persist my live-preview changes into the source code.
1. pending_changes (style matching this project: r3f if it uses React Three Fiber, else vanilla).
2. For each target, search the source by object/material name or path and apply the change in the project's own style (props in JSX for R3F, property assignments for vanilla). Do not paste code blindly — merge it with what is there.
3. When all edits are done, pending_changes clear=true.
4. List the files you changed. If a target could not be found in the source, say so instead of guessing.`,
  },
  {
    name: 'web-perf-audit',
    title: 'Website performance audit',
    description: 'Checks a Three.js website for blurriness, battery drain, load weight and frame drops.',
    text: () => `Audit this Three.js website like a performance engineer.
1. web_audit — pixel ratio, resize, idle rendering, textures, shadows, color space.
2. perf_monitor (duration 5), draw_call_breakdown, memory_stats, dispose_check.
3. Report a prioritised list: issue → impact on users (mobile especially) → exact code fix in this project.
Only inspect; do not change the scene. Offer to apply the fixes in code afterwards.`,
  },
  {
    name: 'prepare-video',
    title: 'Record a video',
    description: 'Check the scene and record a smooth frame sequence for a video or promo clip.',
    args: {
      fps: z.string().optional().describe('Frames per second (default 30)'),
      duration: z.string().optional().describe('Seconds (default 5)'),
      resolution: z.string().optional().describe('e.g. 1920x1080 (default: canvas size)'),
    },
    text: ({ fps = '30', duration = '5', resolution }) => {
      const [w, h] = resolution?.split('x').map(Number) ?? [];
      return `Prepare and record a video of the scene.
1. take_screenshot and check framing; console_capture for errors.
2. Check for things that look bad on video: aliasing (no antialias at pixel ratio 1), banding, toneMapping/outputColorSpace — report them; preview fixes only if I agree.
3. capture_frames fps=${fps} duration=${duration}${w && h ? ` width=${w} height=${h}` : ''}.
4. Give me the ffmpeg command from the result and the frame folder.
Note: time is virtual while capturing, so animations driven by requestAnimationFrame / clock are smooth regardless of render speed.`;
    },
  },
  {
    name: 'debug-invisible',
    title: 'Why is it invisible?',
    description: 'Checklist for an object that does not show up.',
    args: { object: z.string().describe('Object name') },
    text: ({ object }) => `"${object}" is not visible. Find out why — inspect only.
Check in order: find_objects / object_details (exists? visible? parent visible? scale 0?), layers vs camera (layer_details), position vs camera near/far and frustum (camera_details, bounding_boxes), material (opacity, transparent, side, depthTest, colorWrite), geometry (vertex count, draw range), clipping planes, lights for lit materials.
You may use DEBUG VISUAL tools (bounding_boxes, highlight_object). Report the cause and the code fix.`,
  },
  {
    name: 'playwright-setup',
    title: 'Use with Playwright',
    description: 'Connect Playwright (tests or Playwright MCP) to the same Three.js scene.',
    text: () => `Help me use threejs-devtools-mcp together with Playwright in this project.
Read bridge_status first. Then, depending on what I use:
- Playwright MCP in the same session: restart this server with CDP_PORT=9229 and add @playwright/mcp with --cdp-endpoint http://localhost:9229 so both drive one browser.
- Playwright tests: import { attachDevtools, waitForScene, threeCall } from 'threejs-devtools-mcp/playwright'; call attachDevtools(page) before page.goto, await waitForScene(page), then assert on threeCall(page, 'scene_tree') etc.
- Visual tests: fix time with page.clock, disable animations, and compare take_screenshot / toHaveScreenshot; headless CI needs --use-angle=swiftshader.
Write the config or test code into this project.`,
  },
];

export function registerPrompts(server: McpServer): void {
  for (const p of PROMPTS) {
    server.registerPrompt(p.name, {
      title: p.title,
      description: p.description,
      ...(p.args ? { argsSchema: p.args } : {}),
    }, ((args: Record<string, string | undefined>) => userPrompt(p.text(args ?? {}))) as any);
  }
}
