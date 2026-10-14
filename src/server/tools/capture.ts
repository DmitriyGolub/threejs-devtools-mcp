/** Screenshots, frame sequences for videos, GLB export */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { imageResult, outputDir, textResult, tool, type ToolContext } from '../tool-helper.js';
import { byName, size } from './schemas.js';

const MAX_FRAMES = 1800; // 60 s at 30 fps

interface FrameResult { frame: number; timeMs: number; dataUrl: string }

export function registerCaptureTools(ctx: ToolContext): void {
  const { bridge } = ctx;

  tool(ctx, 'take_screenshot', 'inspect',
    'Screenshot of the current scene (also saved as PNG in screenshots/).',
    size,
    async (params) => {
      const r = await bridge.request('take_screenshot', params, 15000) as { dataUrl: string; width: number; height: number };
      return imageResult(r.dataUrl, `screenshot-${Date.now()}.png`, `Screenshot: ${r.width}x${r.height}`);
    });

  tool(ctx, 'annotated_screenshot', 'inspect',
    'Screenshot with object names drawn at their screen positions ([M]esh, [L]ight, [G]roup, [C]amera). Best for understanding layout.',
    size,
    async (params) => {
      const r = await bridge.request('annotated_screenshot', params, 15000) as {
        dataUrl: string; width: number; height: number; labelCount: number;
      };
      return imageResult(r.dataUrl, `annotated-${Date.now()}.png`, `Annotated: ${r.width}x${r.height}, ${r.labelCount} labels`);
    });

  tool(ctx, 'capture_frames', 'inspect',
    'Record a frame sequence for a video. Time is virtualised, so frames are exactly 1/fps apart and smooth even if '
    + 'rendering is slow. Saves numbered images to screenshots/sequence-<time>/ and returns an ffmpeg command.',
    { fps: z.number().optional().describe('Frames per second (default: 30)'),
      duration: z.number().optional().describe('Seconds to record (default: 3)'),
      format: z.enum(['png', 'jpeg']).optional().describe('png = lossless (default), jpeg = smaller/faster'),
      ...size },
    async ({ fps = 30, duration = 3, format = 'png', width, height }) => {
      const total = Math.min(Math.round(fps * duration), MAX_FRAMES);
      const dir = outputDir(`sequence-${Date.now()}`);
      const ext = format === 'jpeg' ? 'jpg' : 'png';

      await bridge.request('capture_frames', { action: 'start', fps });
      try {
        for (let i = 1; i <= total; i++) {
          const r = await bridge.request('capture_frames', { action: 'frame', format, width, height }, 15000) as FrameResult;
          const data = r.dataUrl.slice(r.dataUrl.indexOf(',') + 1);
          fs.writeFileSync(path.join(dir, `frame-${String(i).padStart(5, '0')}.${ext}`), Buffer.from(data, 'base64'));
        }
      } finally {
        await bridge.request('capture_frames', { action: 'stop' }).catch(() => {});
      }

      const input = path.join(dir, `frame-%05d.${ext}`);
      return textResult([
        `Captured ${total} frames at ${fps} fps (${(total / fps).toFixed(2)} s) → ${dir}`,
        '',
        'MP4 (H.264, plays everywhere):',
        `ffmpeg -framerate ${fps} -i "${input}" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -crf 18 out.mp4`,
        '',
        'WebM (VP9, for the web):',
        `ffmpeg -framerate ${fps} -i "${input}" -c:v libvpx-vp9 -b:v 0 -crf 30 out.webm`,
      ].join('\n'));
    }, { annotations: { idempotentHint: false } });

  tool(ctx, 'scene_export', 'inspect',
    'Export the scene or one object as GLB/glTF into screenshots/. Needs GLTFExporter in the app (the error explains setup).',
    { ...byName('Object (omit for entire scene)'),
      binary: z.boolean().optional().describe('GLB (default) or glTF JSON') },
    async (params) => {
      const r = await bridge.request('scene_export', params, 30000) as {
        format: string; base64?: string; json?: unknown; sizeBytes?: number; target: string;
      };
      if (!r.base64) return textResult(JSON.stringify(r.json, null, 2).slice(0, 5000));

      const filePath = path.join(outputDir(), `${(r.target || 'scene').replace(/[^\w-]/g, '_')}.glb`);
      fs.writeFileSync(filePath, Buffer.from(r.base64, 'base64'));
      return textResult(`Exported ${r.format} (${((r.sizeBytes ?? 0) / 1024).toFixed(1)} KB) → ${filePath}`);
    }, { annotations: { idempotentHint: false } });
}
