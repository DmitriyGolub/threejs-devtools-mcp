import type { Handler } from '../types.js';
import { serializeMaterial } from '../serializers/material.js';
import { collectMaterials, findMaterial } from '../traversal.js';

export const materialListHandler: Handler = (ctx) => {
  const materials = collectMaterials(ctx.scene);
  return Array.from(materials.values()).map(serializeMaterial);
};

export const materialDetailsHandler: Handler = (ctx, params) => {
  const mat = findMaterial(ctx.scene, params.name as string, params.uuid as string);
  if (!mat) throw new Error(`Material not found: ${params.name || params.uuid}`);
  return serializeMaterial(mat);
};
