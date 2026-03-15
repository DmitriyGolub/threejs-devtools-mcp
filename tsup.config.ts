import { defineConfig } from 'tsup';

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
    dts: true,
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
    banner: {
      js: '#!/usr/bin/env node',
    },
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
