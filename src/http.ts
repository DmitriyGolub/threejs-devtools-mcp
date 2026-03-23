/**
 * Streamable HTTP transport entry point for non-stdio MCP clients (Cursor, Windsurf, etc.).
 *
 * Usage:
 *   node dist/http.js
 *   # → MCP HTTP server on http://localhost:9223/mcp
 *   # → Bridge proxy on http://localhost:9222
 *
 * Cursor config (mcp.json):
 *   { "url": "http://localhost:9223/mcp" }
 *
 * Windsurf config:
 *   { "serverUrl": "http://localhost:9223/mcp" }
 */

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { BridgeServer } from './bridge/server.js';
import { createMcpServer } from './server.js';
import { detectDevPort } from './detect-port.js';
import { findFreePort } from './find-port.js';
import { launchBrowser, closeBrowser, type LaunchResult } from './browser.js';

const bridgePort = Number(process.env.BRIDGE_PORT) || 9222;
const httpPort = Number(process.env.HTTP_PORT) || bridgePort + 1;
const port = await findFreePort(bridgePort);

const devTarget: number | string = process.env.DEV_URL
  ? process.env.DEV_URL
  : process.env.DEV_PORT
    ? Number(process.env.DEV_PORT)
    : await detectDevPort();

let browserResult: LaunchResult | null = null;

const bridge = new BridgeServer(port, devTarget);
bridge.onReady(async () => {
  browserResult = await launchBrowser(`http://localhost:${port}`, {
    headless: process.env.HEADLESS === 'true',
  });
});

// Track active transports by session ID
const transports = new Map<string, StreamableHTTPServerTransport>();

/** Read request body as JSON */
function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const httpServer = http.createServer(async (req, res) => {
  const url = req.url || '/';

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url === '/mcp') {
    try {
      // Check for existing session
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport = sessionId ? transports.get(sessionId) : undefined;

      if (transport) {
        // Existing session — handle request (may be POST, GET for SSE, or DELETE)
        if (req.method === 'POST') {
          const body = await readBody(req);
          await transport.handleRequest(req, res, body);
        } else {
          await transport.handleRequest(req, res);
        }
        return;
      }

      // No existing session — only accept POST with initialize request
      if (req.method === 'POST') {
        const body = await readBody(req);

        if (isInitializeRequest(body)) {
          // Create new transport + server for this session
          const newTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid: string) => {
              transports.set(sid, newTransport);
              console.error(`[threejs-devtools] HTTP session: ${sid} (${transports.size} total)`);
            },
          });

          newTransport.onclose = () => {
            const sid = newTransport.sessionId;
            if (sid) {
              transports.delete(sid);
              console.error(`[threejs-devtools] HTTP session closed: ${sid} (${transports.size} remaining)`);
            }
          };

          const server = createMcpServer(bridge);
          await server.connect(newTransport);
          await newTransport.handleRequest(req, res, body);
          return;
        }
      }

      // No session and not an initialize request
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'No active session. Send an initialize request first.' },
        id: null,
      }));
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: (err as Error).message },
          id: null,
        }));
      }
    }
    return;
  }

  // Status endpoint
  if (url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      bridge: bridge.connected,
      bridgePort: port,
      target: bridge.targetUrl,
      remote: bridge.isRemote,
      httpPort,
      sessions: transports.size,
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found. POST /mcp to connect, GET /status for status.');
});

httpServer.listen(httpPort, () => {
  console.error(`[threejs-devtools] Streamable HTTP MCP server on http://localhost:${httpPort}/mcp`);
  console.error(`[threejs-devtools] Bridge proxy on http://localhost:${port}`);
  console.error(`[threejs-devtools] Status: http://localhost:${httpPort}/status`);
});

const shutdown = async () => {
  for (const t of transports.values()) t.close?.();
  if (browserResult) await closeBrowser(browserResult);
  bridge.close();
  httpServer.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
