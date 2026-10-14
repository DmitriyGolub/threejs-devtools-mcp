import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const { version } = JSON.parse(readFileSync('package.json', 'utf-8'));
const define = { __PACKAGE_VERSION__: JSON.stringify(version) };

export default defineConfig([
  // Main MCP server entry point (stdio transport)
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'node22',
    platform: 'node',
    outDir: 'dist',
    clean: true,
    sourcemap: true,
    define,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  // HTTP transport entry point (Streamable HTTP for Cursor/Windsurf)
  {
    entry: ['src/http.ts'],
    format: ['esm'],
    target: 'node22',
    platform: 'node',
    outDir: 'dist',
    sourcemap: true,
    define,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  // Playwright / Puppeteer helpers — import from 'threejs-devtools-mcp/playwright'
  {
    entry: ['src/playwright.ts'],
    format: ['esm'],
    target: 'node22',
    platform: 'node',
    outDir: 'dist',
    sourcemap: true,
  },
  // Browser bridge script — bundled as IIFE, zero dependencies
  {
    entry: ['src/bridge/inject.ts'],
    format: ['iife'],
    platform: 'browser',
    target: 'es2020',
    outDir: 'dist',
    globalName: 'ThreeJSDevtoolsBridge',
    sourcemap: false,
    minify: true,
  },
]);
