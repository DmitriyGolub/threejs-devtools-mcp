/** Proxy target, connection status, Playwright attach info */
import { z } from 'zod';
import { textResult, tool, type ToolContext } from '../tool-helper.js';
import { getCdpEndpoint } from '../../browser.js';

const REMOTE_NOTE = [
  'REMOTE MODE: inspection tools work normally.',
  'Live-preview tools change the page only — there is no local source code to update.',
];

export function registerConnectionTools(ctx: ToolContext): void {
  const { bridge } = ctx;
  const proxyUrl = () => `http://localhost:${bridge.proxyPort}`;

  tool(ctx, 'bridge_status', 'connection',
    'Bridge connection, proxy target, and how to attach Playwright to the same browser.',
    {},
    async () => {
      const lines = [
        `Bridge: ${bridge.connected ? 'connected' : 'NOT connected'}`,
        `Proxy: ${proxyUrl()} → ${bridge.targetUrl}`,
      ];
      if (bridge.isRemote) lines.push('', ...REMOTE_NOTE);

      lines.push('', bridge.connected
        ? 'Three.js app is accessible.'
        : `Not connected. Open ${proxyUrl()} in a browser. Wrong target? Use set_dev_port (local) or set_dev_url (remote).`);

      if (bridge.replacedCount > 0) {
        lines.push('', `WARNING: ${bridge.replacedCount} tab replacement(s) — several tabs are open on the proxy URL. `
          + 'Only the latest is active; close the others.');
      }

      const cdp = getCdpEndpoint();
      lines.push('', 'Playwright:', cdp
        ? `  Same browser: npx @playwright/mcp --cdp-endpoint ${cdp}`
        : '  Same browser: restart with CDP_PORT=9229, then npx @playwright/mcp --cdp-endpoint http://localhost:9229',
      `  Or navigate any Playwright browser to ${proxyUrl()} — the bridge is injected automatically.`);

      return textResult(lines.join('\n'));
    });

  tool(ctx, 'set_dev_port', 'connection',
    'Point the proxy at another local dev server port.',
    { port: z.number().describe('Dev server port, e.g. 3000, 5173, 8080') },
    async ({ port }) => {
      const old = bridge.targetUrl;
      bridge.setDevPort(port);
      return textResult(`Target changed: ${old} → ${bridge.targetUrl}\nProxy: ${proxyUrl()} → ${bridge.targetUrl}\nRefresh the browser.`);
    });

  tool(ctx, 'set_dev_url', 'connection',
    'Inspect a remote Three.js app by URL. Source code changes are not possible in remote mode.',
    { url: z.string().describe('Full URL, e.g. https://my-app.vercel.app') },
    async ({ url }) => {
      const old = bridge.targetUrl;
      bridge.setDevUrl(url);
      const lines = [`Target changed: ${old} → ${bridge.targetUrl}`, `Proxy: ${proxyUrl()} → ${bridge.targetUrl}`, '', 'Refresh the browser to connect.'];
      if (bridge.isRemote) lines.push('', ...REMOTE_NOTE);
      return textResult(lines.join('\n'));
    }, { annotations: { openWorldHint: true } });
}
