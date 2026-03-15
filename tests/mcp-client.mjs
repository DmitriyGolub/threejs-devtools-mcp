/**
 * Minimal MCP client for testing — spawns the server and sends JSON-RPC.
 */
import { spawn } from 'child_process';
import path from 'node:path';

export function createTestClient(serverDir) {
  const proc = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: serverDir,
  });

  let stdout = '';
  const responses = new Map();
  let resolveWaiter = null;

  proc.stderr.on('data', (d) => process.stderr.write(d));

  proc.stdout.on('data', (d) => {
    stdout += d.toString();
    const lines = stdout.split('\n');
    stdout = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const json = JSON.parse(trimmed);
        if (json.id !== undefined) {
          responses.set(json.id, json);
          if (resolveWaiter) resolveWaiter();
        }
      } catch {}
    }
  });

  function send(obj) {
    proc.stdin.write(JSON.stringify(obj) + '\n');
  }

  async function waitFor(id, timeoutMs = 15000) {
    const start = Date.now();
    while (!responses.has(id)) {
      if (Date.now() - start > timeoutMs) throw new Error(`Timeout waiting for id=${id}`);
      await new Promise(r => { resolveWaiter = r; setTimeout(r, 100); });
    }
    return responses.get(id);
  }

  async function initialize() {
    send({
      jsonrpc: '2.0', id: 0, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
    });
    const resp = await waitFor(0);
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    return resp;
  }

  let nextId = 100;
  async function callTool(name, args = {}) {
    const id = nextId++;
    send({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });
    return waitFor(id);
  }

  function kill() { proc.kill(); }

  return { initialize, callTool, kill, send, waitFor };
}
