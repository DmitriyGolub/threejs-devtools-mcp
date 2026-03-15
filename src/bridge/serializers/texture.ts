export function serializeTexture(tex: any): any {
  return {
    uuid: tex.uuid, name: tex.name || '',
    width: tex.image?.width || tex.image?.videoWidth || 0,
    height: tex.image?.height || tex.image?.videoHeight || 0,
    format: tex.format, type: tex.type,
    wrapS: tex.wrapS, wrapT: tex.wrapT,
    minFilter: tex.minFilter, magFilter: tex.magFilter,
    colorSpace: tex.colorSpace || tex.encoding || '',
    flipY: tex.flipY, generateMipmaps: tex.generateMipmaps,
    sourceUrl: tex.image?.src || tex.image?.currentSrc || '',
  };
}
