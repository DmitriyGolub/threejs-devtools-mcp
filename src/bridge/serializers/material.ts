import { serializeUniformValue } from './uniform.js';

const MAP_SLOTS = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap',
  'emissiveMap', 'displacementMap', 'alphaMap', 'envMap', 'lightMap',
  'bumpMap', 'specularMap', 'gradientMap',
];

/**
 * Read a Color as sRGB hex. Three.js stores colors in linear space internally,
 * so we need getHexString('srgb') to get the CSS-style value users expect.
 */
function colorToSrgbHex(color: any): string {
  try {
    return '#' + color.getHexString('srgb');
  } catch {
    return '#' + color.getHexString();
  }
}

export function serializeMaterial(mat: any): any {
  const info: any = {
    uuid: mat.uuid, name: mat.name || '',
    type: mat.constructor?.name || mat.type || 'Material',
    visible: mat.visible, transparent: mat.transparent,
    opacity: mat.opacity, side: mat.side,
    depthWrite: mat.depthWrite, depthTest: mat.depthTest,
    blending: mat.blending, wireframe: !!mat.wireframe,
  };

  if (mat.color) info.color = colorToSrgbHex(mat.color);
  if (mat.emissive) info.emissive = colorToSrgbHex(mat.emissive);
  if (mat.roughness !== undefined) info.roughness = mat.roughness;
  if (mat.metalness !== undefined) info.metalness = mat.metalness;

  info.maps = MAP_SLOTS.filter(slot => mat[slot] != null);

  if (mat.uniforms) {
    info.uniforms = {};
    for (const [key, u] of Object.entries(mat.uniforms)) {
      info.uniforms[key] = serializeUniformValue((u as any).value);
    }
  }

  if (mat.defines && Object.keys(mat.defines).length > 0) info.defines = mat.defines;

  if (mat.customProgramCacheKey) {
    info.customProgramCacheKey = typeof mat.customProgramCacheKey === 'function'
      ? mat.customProgramCacheKey() : mat.customProgramCacheKey;
  }

  return info;
}
