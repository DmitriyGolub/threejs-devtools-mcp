import type { Handler } from '../types.js';
import { serializeSceneNode, compactSceneTree } from '../serializers/scene-node.js';
import { serializeVector3 } from '../serializers/vector.js';
import { serializeMaterial } from '../serializers/material.js';
import { findObjectByName, findObjectByUuid, findObjectByPath } from '../traversal.js';

export const sceneTreeHandler: Handler = (ctx, params) => {
  const depth = (params.depth as number) || 3;
  const types = params.types as string[] | undefined;
  const maxChildren = params.maxChildren as number | undefined;
  const compact = params.compact !== false;

  if (compact) {
    const limit = maxChildren || 15;
    return compactSceneTree(ctx.scene, 0, depth, types, limit);
  }

  return serializeSceneNode(ctx.scene, 0, depth, types, maxChildren);
};

export const objectDetailsHandler: Handler = (ctx, params) => {
  let obj: any = null;
  if (params.uuid) obj = findObjectByUuid(ctx.scene, params.uuid as string);
  else if (params.path) obj = findObjectByPath(ctx.scene, params.path as string);
  else if (params.name) obj = findObjectByName(ctx.scene, params.name as string);

  if (!obj) throw new Error(`Object not found: ${params.name || params.uuid || params.path}`);

  const node = serializeSceneNode(obj, 0, 1);

  node.worldPosition = serializeVector3(obj.getWorldPosition(obj.position.clone()));
  node.worldScale = serializeVector3(obj.getWorldScale(obj.scale.clone()));
  node.frustumCulled = obj.frustumCulled;
  node.renderOrder = obj.renderOrder;
  node.layers = obj.layers?.mask;
  if (obj.userData && Object.keys(obj.userData).length > 0) node.userData = obj.userData;

  if (obj.material) {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    node.materialDetails = mats.map(serializeMaterial);
  }

  if (obj.geometry) {
    const geo = obj.geometry;
    node.geometryDetails = {
      type: geo.constructor?.name || geo.type,
      vertices: geo.attributes?.position?.count || 0,
      index: geo.index?.count || 0,
      attributes: Object.keys(geo.attributes || {}),
      boundingSphere: geo.boundingSphere
        ? { center: serializeVector3(geo.boundingSphere.center), radius: geo.boundingSphere.radius }
        : null,
      groups: geo.groups?.length || 0,
    };
  }

  return node;
};
