import type { Handler } from '../types.js';

export const rendererInfoHandler: Handler = (ctx) => {
  const r = ctx.renderer;
  const info = r.info;

  return {
    render: {
      calls: info.render?.calls || 0, triangles: info.render?.triangles || 0,
      points: info.render?.points || 0, lines: info.render?.lines || 0,
      frame: info.render?.frame || 0,
    },
    memory: { geometries: info.memory?.geometries || 0, textures: info.memory?.textures || 0 },
    programs: info.programs?.length || 0,
    canvas: { width: r.domElement?.width || 0, height: r.domElement?.height || 0 },
    pixelRatio: r.getPixelRatio?.() || 1,
    capabilities: {
      maxTextures: r.capabilities?.maxTextures || 0,
      maxVertexTextures: r.capabilities?.maxVertexTextures || 0,
      maxTextureSize: r.capabilities?.maxTextureSize || 0,
      maxCubemapSize: r.capabilities?.maxCubemapSize || 0,
      precision: r.capabilities?.precision || '',
    },
    outputColorSpace: r.outputColorSpace || '',
    toneMapping: r.toneMapping || 0,
    shadowMap: { enabled: r.shadowMap?.enabled || false, type: r.shadowMap?.type || 0 },
  };
};
