/** Performance, memory, website health, console */
import { z } from 'zod';
import { bridgeTool, type ToolContext } from '../tool-helper.js';

export function registerPerformanceTools(ctx: ToolContext): void {
  bridgeTool(ctx, 'web_audit', 'inspect',
    'Website health check: pixel ratio, canvas resize, idle/off-screen rendering, antialias cost, '
    + 'oversized or uncompressed textures, shadow cost, color space, draw calls. Each finding has a concrete fix.',
    {}, { timeoutMs: 15000 });

  bridgeTool(ctx, 'performance_snapshot', 'inspect',
    'Draw calls, triangles, instanced meshes, object counts by type.');

  bridgeTool(ctx, 'perf_monitor', 'inspect',
    'Record FPS and frame times for N seconds: avg/min/max, percentiles, spikes, jank.',
    { duration: z.number().optional().describe('Seconds (default: 3, max: 30)'),
      includeFrameTimes: z.boolean().optional().describe('Include raw frame times (default: false)') },
    { timeoutMs: 35000 });

  bridgeTool(ctx, 'draw_call_breakdown', 'inspect',
    'Per-object draw call and triangle cost, sorted by cost. Flags multi-material objects and hidden geometry.');

  bridgeTool(ctx, 'memory_stats', 'inspect',
    'GPU memory: geometry buffers, texture VRAM, instance data, top textures by size.');

  bridgeTool(ctx, 'dispose_check', 'inspect',
    'Leak detection: geometries/textures tracked by the renderer but no longer in the scene.');

  bridgeTool(ctx, 'console_capture', 'inspect',
    'Recent browser console output (log/warn/error).',
    { clear: z.boolean().optional().describe('Clear the buffer'),
      level: z.enum(['log', 'warn', 'error']).optional(),
      limit: z.number().optional().describe('Max messages (default: 50)') });
}
