import http from 'node:http';
import { WebSocket } from 'ws';

/** Proxy an HTTP request to the dev server, injecting bridge into HTML */
export function proxyRequest(
  clientReq: http.IncomingMessage,
  clientRes: http.ServerResponse,
  devPort: number,
  proxyPort: number,
  bridgeScript: string | null,
): void {
  const options: http.RequestOptions = {
    hostname: 'localhost',
    port: devPort,
    path: clientReq.url,
    method: clientReq.method,
    headers: { ...clientReq.headers, host: `localhost:${devPort}` },
  };
  delete (options.headers as Record<string, unknown>)['accept-encoding'];

  const proxyReq = http.request(options, (proxyRes) => {
    const contentType = proxyRes.headers['content-type'] || '';

    if (contentType.includes('text/html')) {
      const chunks: Buffer[] = [];
      proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
      proxyRes.on('end', () => {
        let body = Buffer.concat(chunks).toString('utf-8');
        const tag = `<script>window.__THREEJS_DEVTOOLS_PORT__=${proxyPort};${bridgeScript || '/* bridge not found */'}</script>`;

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
    clientRes.writeHead(502, { 'Content-Type': 'text/html' });
    clientRes.end(
      `<html><body style="font-family:system-ui;padding:40px;color:#ccc;background:#1a1a2e">` +
      `<h1>threejs-devtools</h1>` +
      `<p>Cannot reach dev server at <b>localhost:${devPort}</b></p>` +
      `<p>Make sure your dev server is running, or use <code>set_dev_port</code> tool.</p>` +
      `<p style="color:#666">Proxy: localhost:${proxyPort} → localhost:${devPort}</p>` +
      `</body></html>`
    );
  });

  clientReq.pipe(proxyReq);
}

/** Proxy a WebSocket connection to the dev server (HMR etc.) */
export function proxyWebSocket(clientWs: WebSocket, req: http.IncomingMessage, devPort: number): void {
  const target = new WebSocket(`ws://localhost:${devPort}${req.url}`);
  target.on('open', () => {
    clientWs.on('message', (data) => target.send(data));
    target.on('message', (data) => clientWs.send(data));
  });
  target.on('close', () => clientWs.close());
  clientWs.on('close', () => target.close());
  target.on('error', () => clientWs.close());
  clientWs.on('error', () => target.close());
}

/** Proxy a raw WebSocket upgrade to the dev server */
export function proxyUpgrade(
  req: http.IncomingMessage, socket: any, head: Buffer, devPort: number,
): void {
  const headers = {
    ...req.headers,
    host: `localhost:${devPort}`,
    origin: `http://localhost:${devPort}`,
  };

  const proxyReq = http.request({
    hostname: 'localhost', port: devPort, path: req.url,
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
    // Dev server didn't upgrade — forward the HTTP response and close
    const statusLine = `HTTP/${res.httpVersion} ${res.statusCode} ${res.statusMessage}\r\n`;
    const hdrs = Object.entries(res.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
    socket.write(statusLine + hdrs + '\r\n\r\n');
    res.pipe(socket);
  });

  proxyReq.on('error', () => socket.destroy());
  proxyReq.end();
}
