import type { Handler } from '../types.js';

export const texturePreviewHandler: Handler = (ctx, params) => {
  const name = params.name as string | undefined;
  const uuid = params.uuid as string | undefined;
  const maxSize = Math.min((params.maxSize as number) || 512, 2048);

  if (!name && !uuid) throw new Error('Provide texture "name" or "uuid"');

  // Find texture by traversing scene materials
  let target: any = null;
  ctx.scene.traverse((obj: any) => {
    if (target) return;
    const mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
    for (const mat of mats) {
      for (const key of Object.keys(mat)) {
        const val = mat[key];
        if (val && val.isTexture) {
          if ((name && val.name === name) || (uuid && val.uuid === uuid)) {
            target = val;
            return;
          }
        }
      }
    }
  });

  // Also check scene.background / scene.environment
  if (!target) {
    const bg = ctx.scene.background;
    if (bg?.isTexture && ((name && bg.name === name) || (uuid && bg.uuid === uuid))) target = bg;
  }
  if (!target) {
    const env = ctx.scene.environment;
    if (env?.isTexture && ((name && env.name === name) || (uuid && env.uuid === uuid))) target = env;
  }

  if (!target) throw new Error(`Texture "${name || uuid}" not found`);

  const image = target.image;
  if (!image) throw new Error('Texture has no image data (may be compressed or not yet loaded)');

  // Determine source dimensions
  let srcW: number, srcH: number;
  if (image.width !== undefined) { srcW = image.width; srcH = image.height; }
  else if (image.videoWidth !== undefined) { srcW = image.videoWidth; srcH = image.videoHeight; }
  else throw new Error('Cannot determine texture dimensions');

  // Scale to fit maxSize
  const scale = Math.min(1, maxSize / Math.max(srcW, srcH));
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx2d = canvas.getContext('2d')!;

  if (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement
    || image instanceof HTMLVideoElement || (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap)) {
    ctx2d.drawImage(image, 0, 0, w, h);
  } else if (image.data && image.data.length) {
    // DataTexture — raw typed array
    const clamped = image.data instanceof Uint8ClampedArray
      ? image.data
      : new Uint8ClampedArray(image.data.length).fill(255);
    if (!(image.data instanceof Uint8ClampedArray)) {
      for (let i = 0; i < image.data.length; i++) clamped[i] = Math.min(255, Math.max(0, image.data[i] * 255));
    }
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = srcW;
    tempCanvas.height = srcH;
    const tempCtx = tempCanvas.getContext('2d')!;
    const imgData = new ImageData(clamped, srcW, srcH);
    tempCtx.putImageData(imgData, 0, 0);
    ctx2d.drawImage(tempCanvas, 0, 0, w, h);
  } else {
    throw new Error('Unsupported texture image format (may be CompressedTexture)');
  }

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: w,
    height: h,
    originalWidth: srcW,
    originalHeight: srcH,
    textureName: target.name || '',
    textureUuid: target.uuid,
  };
};
