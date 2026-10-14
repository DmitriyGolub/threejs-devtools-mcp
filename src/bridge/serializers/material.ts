import { serializeUniformValue } from './uniform.js';
import { MAP_SLOTS } from '../traversal.js';
import { readColorHex } from '../handlers/color-utils.js';

/** Scalar MeshPhysicalMaterial / MeshStandardMaterial props worth reporting when present */
const SCALAR_PROPS = [
  'roughness', 'metalness', 'emissiveIntensity', 'envMapIntensity',
  'clearcoat', 'clearcoatRoughness', 'transmission', 'thickness', 'ior',
  'sheen', 'sheenRoughness', 'iridescence', 'anisotropy', 'dispersion', 'specularIntensity',
];

const COLOR_PROPS = ['color', 'emissive', 'sheenColor', 'specularColor', 'attenuationColor'];

/**
 * NodeMaterial (WebGPU / TSL) inputs. Only the slots that are set are reported —
 * their values are node graphs, so we name the node type rather than dump it.
 */
const NODE_SLOTS = [
  'colorNode', 'normalNode', 'opacityNode', 'positionNode', 'emissiveNode',
  'roughnessNode', 'metalnessNode', 'outputNode', 'fragmentNode', 'vertexNode',
  'alphaTestNode', 'backdropNode', 'castShadowNode', 'receivedShadowNode',
];

export function serializeMaterial(mat: any): any {
  const info: any = {
    uuid: mat.uuid, name: mat.name || '',
    type: mat.constructor?.name || mat.type || 'Material',
    visible: mat.visible, transparent: mat.transparent,
    opacity: mat.opacity, side: mat.side,
    depthWrite: mat.depthWrite, depthTest: mat.depthTest,
    blending: mat.blending, wireframe: !!mat.wireframe,
  };

  for (const prop of COLOR_PROPS) {
    if (mat[prop]?.isColor) info[prop] = readColorHex(mat[prop]);
  }
  for (const prop of SCALAR_PROPS) {
    if (typeof mat[prop] === 'number') info[prop] = mat[prop];
  }

  info.maps = MAP_SLOTS.filter(slot => mat[slot] != null);

  if (mat.isNodeMaterial) {
    info.nodeMaterial = true;
    const nodes = Object.fromEntries(
      NODE_SLOTS.filter(slot => mat[slot] != null)
        .map(slot => [slot, mat[slot].constructor?.name || mat[slot].type || 'Node']),
    );
    if (Object.keys(nodes).length > 0) info.nodes = nodes;
  }

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
