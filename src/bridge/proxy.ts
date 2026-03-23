import http from 'node:http';
import https from 'node:https';
import { WebSocket } from 'ws';
import type { ProxyTarget } from './server.js';

function targetLabel(target: ProxyTarget): string {
  const defaultPort = target.protocol === 'https' ? 443 : 80;
  const portSuffix = target.port === defaultPort ? '' : `:${target.port}`;
  return `${target.protocol}://${target.hostname}${portSuffix}`;
}

function waitingPage(target: ProxyTarget, proxyPort: number): string {
  const label = targetLabel(target);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>threejs-devtools-mcp</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
      background:#000;color:#ededed;min-height:100vh;
      display:flex;align-items:center;justify-content:center;
    }
    .container{max-width:540px;padding:48px 32px;text-align:center}
    .badge{
      display:inline-block;font-size:11px;font-weight:600;letter-spacing:.5px;
      text-transform:uppercase;color:#a78bfa;border:1px solid #a78bfa33;
      border-radius:999px;padding:4px 14px;margin-bottom:24px;
    }
    h1{font-size:28px;font-weight:700;letter-spacing:-.5px;margin-bottom:12px}
    .sub{color:#888;font-size:15px;line-height:1.6;margin-bottom:32px}
    .card{
      background:#111;border:1px solid #222;border-radius:12px;
      padding:20px 24px;text-align:left;margin-bottom:16px;
    }
    .card-title{font-size:13px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.4px;margin-bottom:12px}
    .step{display:flex;gap:12px;align-items:flex-start;margin-bottom:10px}
    .step:last-child{margin-bottom:0}
    .num{
      flex-shrink:0;width:22px;height:22px;border-radius:50%;
      background:#a78bfa22;color:#a78bfa;font-size:12px;font-weight:700;
      display:flex;align-items:center;justify-content:center;margin-top:1px;
    }
    .step-text{font-size:14px;line-height:1.5;color:#ccc}
    code{
      background:#1a1a2e;color:#a78bfa;padding:2px 7px;border-radius:5px;
      font-size:13px;font-family:'SF Mono',Consolas,monospace;
    }
    .status{
      display:flex;align-items:center;gap:8px;justify-content:center;
      font-size:13px;color:#666;margin-top:24px;
    }
    .dot{width:8px;height:8px;border-radius:50%;background:#a78bfa;animation:pulse 2s ease-in-out infinite}
    @keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}
    .route{color:#555;font-size:12px;font-family:'SF Mono',Consolas,monospace;margin-top:16px}
    .features{
      display:grid;grid-template-columns:1fr 1fr;gap:8px;
      margin-top:16px;text-align:left;
    }
    .feat{font-size:12px;color:#666;display:flex;align-items:center;gap:6px}
    .feat::before{content:'';width:4px;height:4px;border-radius:50%;background:#a78bfa44;flex-shrink:0}
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">threejs-devtools-mcp</div>
    <h1>Waiting for Server</h1>
    <p class="sub">
      This proxy page connects your Three.js app to AI-powered devtools.
      Start your dev server and this page will automatically load your scene.
    </p>

    <div class="card">
      <div class="card-title">Quick Setup</div>
      <div class="step">
        <div class="num">1</div>
        <div class="step-text">Make sure the server at <code>${label}</code> is running</div>
      </div>
      <div class="step">
        <div class="num">2</div>
        <div class="step-text">This page auto-refreshes when the server is ready</div>
      </div>
      <div class="step">
        <div class="num">3</div>
        <div class="step-text">Wrong target? Ask the AI to run <code>set_dev_port</code> or <code>set_dev_url</code></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">What this does</div>
      <div class="features">
        <div class="feat">Inspect scene tree</div>
        <div class="feat">Edit materials live</div>
        <div class="feat">Tweak lights & fog</div>
        <div class="feat">Debug shaders</div>
        <div class="feat">Performance stats</div>
        <div class="feat">Memory analysis</div>
        <div class="feat">Take screenshots</div>
        <div class="feat">Run custom JS</div>
        <div class="feat">Scene overlay (3D preview)</div>
      </div>
      <div style="margin-top:12px;font-size:12px;color:#888;line-height:1.6">
        <b>Overlay</b> auto-shows on scene load. To disable, ask the agent or set<br>
        <code style="background:#222;padding:2px 6px;border-radius:4px">THREEJS_DEVTOOLS_NO_OVERLAY=true</code>
      </div>
    </div>

    <div class="status">
      <div class="dot"></div>
      Polling ${label}...
    </div>
    <div class="route">proxy :${proxyPort} &rarr; ${label}</div>
  </div>
  <script>setTimeout(()=>location.reload(),3000)</script>
</body>
</html>`;
}

function httpModule(target: ProxyTarget) {
  return target.protocol === 'https' ? https : http;
}

/** Proxy an HTTP request to the target server, injecting bridge into HTML */
export function proxyRequest(
  clientReq: http.IncomingMessage,
  clientRes: http.ServerResponse,
  target: ProxyTarget,
  proxyPort: number,
  bridgeScript: string | null,
): void {
  const options: http.RequestOptions = {
    hostname: target.hostname,
    port: target.port,
    path: clientReq.url,
    method: clientReq.method,
    headers: { ...clientReq.headers, host: `${target.hostname}:${target.port}` },
  };
  delete (options.headers as Record<string, unknown>)['accept-encoding'];

  const proxyReq = httpModule(target).request(options, (proxyRes) => {
    const contentType = proxyRes.headers['content-type'] || '';

    if (contentType.includes('text/html')) {
      const chunks: Buffer[] = [];
      proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
      proxyRes.on('end', () => {
        let body = Buffer.concat(chunks).toString('utf-8');
        const noOverlay = process.env.THREEJS_DEVTOOLS_NO_OVERLAY === '1' || process.env.THREEJS_DEVTOOLS_NO_OVERLAY === 'true';
        const tag = `<script>${noOverlay ? 'window.__THREEJS_DEVTOOLS_NO_OVERLAY__=true;' : ''}window.__THREEJS_DEVTOOLS_PORT__=${proxyPort};${bridgeScript || '/* bridge not found */'}</script>`;

        if (body.includes('<head>')) body = body.replace('<head>', `<head>${tag}`);
        else if (body.includes('<HEAD>')) body = body.replace('<HEAD>', `<HEAD>${tag}`);
        else body = tag + body;

        const headers = { ...proxyRes.headers };
        delete headers['content-length'];
        delete headers['content-encoding'];
        headers['transfer-encoding'] = 'chunked';

        clientRes.writeHead(proxyRes.statusCode || 200, headers);
        clientRes.end(body);
      });
    } else {
      clientRes.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(clientRes);
    }
  });

  proxyReq.on('error', () => {
    clientRes.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
    clientRes.end(waitingPage(target, proxyPort));
  });

  clientReq.pipe(proxyReq);
}

/** Proxy a WebSocket connection to the target server (HMR etc.) */
export function proxyWebSocket(clientWs: WebSocket, req: http.IncomingMessage, target: ProxyTarget): void {
  const wsProto = target.protocol === 'https' ? 'wss' : 'ws';
  const remote = new WebSocket(`${wsProto}://${target.hostname}:${target.port}${req.url}`);
  remote.on('open', () => {
    clientWs.on('message', (data) => remote.send(data));
    remote.on('message', (data) => clientWs.send(data));
  });
  remote.on('close', () => clientWs.close());
  clientWs.on('close', () => remote.close());
  remote.on('error', () => clientWs.close());
  clientWs.on('error', () => remote.close());
}

/** Proxy a raw WebSocket upgrade to the target server */
export function proxyUpgrade(
  req: http.IncomingMessage, socket: any, head: Buffer, target: ProxyTarget,
): void {
  const headers = {
    ...req.headers,
    host: `${target.hostname}:${target.port}`,
    origin: `${target.protocol}://${target.hostname}:${target.port}`,
  };

  const proxyReq = httpModule(target).request({
    hostname: target.hostname, port: target.port, path: req.url,
    method: 'GET', headers,
  });

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\n` +
      Object.entries(proxyRes.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      '\r\n\r\n'
    );
    if (proxyHead.length) socket.write(proxyHead);
    if (head.length) proxySocket.write(head);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
    proxySocket.on('error', () => socket.destroy());
    socket.on('error', () => proxySocket.destroy());
  });

  proxyReq.on('response', (res) => {
    // Target server didn't upgrade — forward the HTTP response and close
    const statusLine = `HTTP/${res.httpVersion} ${res.statusCode} ${res.statusMessage}\r\n`;
    const hdrs = Object.entries(res.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
    socket.write(statusLine + hdrs + '\r\n\r\n');
    res.pipe(socket);
  });

  proxyReq.on('error', () => socket.destroy());
  proxyReq.end();
}
