import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { FRAMEWORK_PORTS, COMMON_PORTS } from './constants.js';

export async function detectDevPort(): Promise<number> {
  const fromPkg = detectFromPackageJson(process.cwd());
  if (fromPkg) {
    console.error(`[threejs-devtools] Detected dev port ${fromPkg.port} (${fromPkg.reason})`);
    return fromPkg.port;
  }

  const runningPort = await scanPorts(COMMON_PORTS);
  if (runningPort) {
    console.error(`[threejs-devtools] Found running dev server on port ${runningPort}`);
    return runningPort;
  }

  console.error('[threejs-devtools] Could not detect dev port, using 3000');
  return 3000;
}

function detectFromPackageJson(cwd: string): { port: number; reason: string } | null {
  let pkg: Record<string, unknown>;
  try { pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8')); }
  catch { return null; }

  const deps = {
    ...(pkg.dependencies as Record<string, string> || {}),
    ...(pkg.devDependencies as Record<string, string> || {}),
  };
  const scripts = (pkg.scripts as Record<string, string>) || {};
  const devScript = scripts.dev || scripts.start || '';

  const portMatch = devScript.match(/--port\s+(\d+)/) || devScript.match(/-p\s+(\d+)/);
  if (portMatch) return { port: Number(portMatch[1]), reason: '--port in scripts.dev' };

  const envMatch = devScript.match(/PORT=(\d+)/);
  if (envMatch) return { port: Number(envMatch[1]), reason: 'PORT= in scripts.dev' };

  for (const [dep, defaultPort] of Object.entries(FRAMEWORK_PORTS)) {
    if (deps[dep]) return { port: defaultPort, reason: dep };
  }

  return null;
}

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ hostname: 'localhost', port, path: '/', timeout: 500 }, (res) => {
      res.destroy(); resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function scanPorts(ports: number[]): Promise<number | null> {
  const results = await Promise.all(ports.map(async (p) => ({ port: p, alive: await checkPort(p) })));
  return results.find((r) => r.alive)?.port || null;
}
