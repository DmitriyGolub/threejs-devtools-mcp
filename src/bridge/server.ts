import { WebSocketServer, WebSocket } from 'ws';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BridgeRequest, BridgeResponse } from '../types/scene.js';
import { proxyRequest, proxyUpgrade } from './proxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function isDevWsPath(url: string): boolean {
  return url.startsWith('/_next/') || url.startsWith('/__webpack')
    || url.includes('hot-update') || url.includes('hmr');
}

export class BridgeServer {
  private wss: WebSocketServer;
  private httpServer: http.Server;
  private client: WebSocket | null = null;
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private nextId = 0;
  private _devPort: number;
  private _onReady?: () => void;

  get devPort(): number { return this._devPort; }
  get proxyPort(): number { return this.port; }
  get connected(): boolean { return this.client !== null && this.client.readyState === WebSocket.OPEN; }

  setDevPort(newPort: number): void {
    this._devPort = newPort;
    console.error(`[threejs-devtools-mcp] Dev port changed to ${newPort}`);
  }

  constructor(private port: number = 9222, devPort: number = 3000) {
    this._devPort = devPort;

    this.httpServer = http.createServer((req, res) => {
      const url = req.url || '/';
      if (url === '/bridge.js' || url === '/inject.js') { this.serveBridgeScript(res); return; }
      if (url === '/__devtools_status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ connected: this.client !== null, port: this.port, devPort: this._devPort }));
        return;
      }
      proxyRequest(req, res, this._devPort, this.port, this.loadBridgeScript());
    });

    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on('connection', (ws) => {
      this.handleBridgeConnection(ws);
    });

    this.httpServer.on('upgrade', (req, socket, head) => {
      if (isDevWsPath(req.url || '')) {
        proxyUpgrade(req, socket, head, this._devPort);
      } else {
        this.wss.handleUpgrade(req, socket as any, head, (ws) => {
          this.wss.emit('connection', ws, req);
        });
      }
    });

    this.httpServer.listen(this.port, () => {
      const url = `http://localhost:${this.port}`;
      console.error(`[threejs-devtools-mcp] Proxy: ${url} → http://localhost:${this._devPort}`);
      this._onReady?.();
    });
  }

  /** Register a callback for when the HTTP server is ready. */
  onReady(cb: () => void): void {
    this._onReady = cb;
  }

  async request(method: string, params: Record<string, unknown> = {}, timeoutMs = 10000): Promise<unknown> {
    if (!this.connected) {
      throw new Error(
        `No Three.js app connected.\nOpen http://localhost:${this.port} in your browser.`
      );
    }
    const id = String(++this.nextId);
    const msg: BridgeRequest = { id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pendingRequests.delete(id); reject(new Error(`${method} timed out`)); }, timeoutMs);
      this.pendingRequests.set(id, { resolve, reject, timer });
      this.client!.send(JSON.stringify(msg));
    });
  }

  /** Disconnect the browser bridge WebSocket (stops all communication). */
  disconnectBridge(): void {
    if (this.client) {
      this.client.close();
      this.client = null;
      this.rejectAll('Bridge manually disconnected');
      console.error('[threejs-devtools-mcp] Bridge manually disconnected');
    }
  }

  /** Check if bridge can reconnect (it will auto-reconnect from browser side). */
  get bridgeReady(): boolean {
    return this.wss.clients.size > 0;
  }

  close(): void {
    this.rejectAll('Server shutting down');
    this.client?.close();
    this.wss.close();
    this.httpServer.close();
  }

  private handleBridgeConnection(ws: WebSocket): void {
    // Gracefully replace old client: detach listeners, let it close naturally.
    // Do NOT call .close() — it triggers browser reconnect → infinite loop.
    const prev = this.client;
    if (prev && prev !== ws && prev.readyState === WebSocket.OPEN) {
      prev.removeAllListeners();
      // Send a "replaced" message so the old tab knows to stop reconnecting
      try { prev.send(JSON.stringify({ id: '__replaced', error: { code: -99, message: 'Replaced by new connection' } })); } catch { /* ignore */ }
      prev.close(4000, 'Replaced by new tab');
    }
    this.client = ws;
    console.error('[threejs-devtools-mcp] Bridge connected');

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as BridgeResponse;
        const pending = this.pendingRequests.get(msg.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pendingRequests.delete(msg.id);
        if (msg.error) pending.reject(new Error(msg.error.message));
        else pending.resolve(msg.result);
      } catch { /* ignore */ }
    });

    ws.on('close', (code) => {
      if (this.client === ws) { this.client = null; console.error('[threejs-devtools-mcp] Bridge disconnected'); }
      // Only reject pending if this was the active client
      if (this.client === null) this.rejectAll('Bridge disconnected');
    });

    ws.on('error', (err) => console.error('[threejs-devtools-mcp] WS error:', err.message));
  }

  private loadBridgeScript(): string | null {
    for (const p of ['inject.global.js', '../inject.global.js', 'inject.js', '../inject.js']) {
      try { return fs.readFileSync(path.resolve(__dirname, p), 'utf-8'); } catch { /* next */ }
    }
    return null;
  }

  private serveBridgeScript(res: http.ServerResponse): void {
    const script = this.loadBridgeScript();
    if (script) {
      res.writeHead(200, { 'Content-Type': 'application/javascript', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' });
      res.end(script);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('inject.js not found. Run: npm run build');
    }
  }

  private rejectAll(reason: string): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer); pending.reject(new Error(reason)); this.pendingRequests.delete(id);
    }
  }
}
