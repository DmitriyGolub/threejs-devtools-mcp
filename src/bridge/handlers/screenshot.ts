import type { Handler } from '../types.js';

export const screenshotHandler: Handler = (ctx, params) => {
  const r = ctx.renderer;
  const canvas = r.domElement as HTMLCanvasElement;
  const width = params.width as number || canvas.width;
  const height = params.height as number || canvas.height;

  let camera = ctx.camera;
  if (!camera) {
    ctx.scene.traverse((obj: any) => {
      if (!camera && (obj.isCamera || obj.isPerspectiveCamera || obj.isOrthographicCamera)) {
        camera = obj;
      }
    });
  }

  if (camera) r.render(ctx.scene, camera);

  let dataUrl: string;
  if (width !== canvas.width || height !== canvas.height) {
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const ctx2d = offscreen.getContext('2d')!;
    ctx2d.drawImage(canvas, 0, 0, width, height);
    dataUrl = offscreen.toDataURL('image/png');
  } else {
    dataUrl = canvas.toDataURL('image/png');
  }

  return { dataUrl, width, height };
};
