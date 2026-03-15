import type { Handler } from '../types.js';
import { serializeTexture } from '../serializers/texture.js';
import { collectTextures } from '../traversal.js';

export const textureListHandler: Handler = (ctx) => {
  const textures = collectTextures(ctx.scene);
  return Array.from(textures.values()).map(serializeTexture);
};

export const textureDetailsHandler: Handler = (ctx, params) => {
  const textures = collectTextures(ctx.scene);
  let tex: any = null;

  if (params.uuid) tex = textures.get(params.uuid as string);
  if (!tex && params.name) {
    for (const t of textures.values()) {
      if (t.name === params.name) { tex = t; break; }
    }
  }
  if (!tex) throw new Error(`Texture not found: ${params.name || params.uuid}`);
  return serializeTexture(tex);
};
