import type { Handler } from '../types.js';

export type ImageFormat = 'png' | 'jpeg';

/** Read the canvas as a data URL, scaling through an offscreen canvas when a size is given */
export function canvasToDataUrl(
  canvas: HTMLCanvasElement, width: number, height: number, format: ImageFormat = 'png',
): string {
  const mime = `image/${format}`;
  if (width === canvas.width && height === canvas.height) return canvas.toDataURL(mime, 0.92);

  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  offscreen.getContext('2d')!.drawImage(canvas, 0, 0, width, height);
  return offscreen.toDataURL(mime, 0.92);
}

export const screenshotHandler: Handler = (ctx, params) => {
  const r = ctx.renderer;
  const canvas = r.domElement as HTMLCanvasElement;
  const width = params.width as number || canvas.width;
  const height = params.height as number || canvas.height;

  let camera = ctx.camera;
  if (!camera) {
    ctx.scene.traverse((obj: any) => {
      if (!camera && obj.isCamera) camera = obj;
    });
  }

  // Render right before reading so the drawing buffer is not cleared yet
  if (camera) r.render(ctx.scene, camera);

  return { dataUrl: canvasToDataUrl(canvas, width, height), width, height };
};
