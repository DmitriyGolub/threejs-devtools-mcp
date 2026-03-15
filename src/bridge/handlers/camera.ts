/**
 * Camera inspection and mutation handlers.
 */
import type { Handler } from '../types.js';
import { serializeVector3 } from '../serializers/vector.js';

export const cameraDetailsHandler: Handler = (ctx) => {
  const cam = ctx.camera;
  if (!cam) throw new Error('No camera found in scene');

  const result: any = {
    type: cam.constructor?.name || cam.type || 'Camera',
    uuid: cam.uuid,
    name: cam.name || '',
    position: serializeVector3(cam.position),
    rotation: serializeVector3(cam.rotation),
    up: serializeVector3(cam.up),
    near: cam.near,
    far: cam.far,
    layers: cam.layers?.mask,
    zoom: cam.zoom,
  };

  if (cam.isPerspectiveCamera) {
    result.fov = cam.fov;
    result.aspect = Math.round(cam.aspect * 1000) / 1000;
    result.filmGauge = cam.filmGauge;
    result.filmOffset = cam.filmOffset;
    result.focus = cam.focus;
  }

  if (cam.isOrthographicCamera) {
    result.left = cam.left;
    result.right = cam.right;
    result.top = cam.top;
    result.bottom = cam.bottom;
  }

  return result;
};

export const setCameraHandler: Handler = (ctx, params) => {
  const cam = ctx.camera;
  if (!cam) throw new Error('No camera found in scene');

  if (params.position !== undefined) {
    const p = params.position as number[];
    if (Array.isArray(p) && p.length === 3) cam.position.set(p[0], p[1], p[2]);
  }

  if (params.rotation !== undefined) {
    const r = params.rotation as number[];
    if (Array.isArray(r) && r.length === 3) cam.rotation.set(r[0], r[1], r[2]);
  }

  if (params.near !== undefined) cam.near = params.near as number;
  if (params.far !== undefined) cam.far = params.far as number;
  if (params.zoom !== undefined) cam.zoom = params.zoom as number;

  if (cam.isPerspectiveCamera) {
    if (params.fov !== undefined) cam.fov = params.fov as number;
    if (params.aspect !== undefined) cam.aspect = params.aspect as number;
  }

  if (cam.isOrthographicCamera) {
    if (params.left !== undefined) cam.left = params.left as number;
    if (params.right !== undefined) cam.right = params.right as number;
    if (params.top !== undefined) cam.top = params.top as number;
    if (params.bottom !== undefined) cam.bottom = params.bottom as number;
  }

  // Must call updateProjectionMatrix after changing projection params
  cam.updateProjectionMatrix();

  return {
    success: true,
    type: cam.constructor?.name || cam.type,
    position: serializeVector3(cam.position),
    rotation: serializeVector3(cam.rotation),
    near: cam.near,
    far: cam.far,
    zoom: cam.zoom,
    ...(cam.isPerspectiveCamera ? { fov: cam.fov, aspect: Math.round(cam.aspect * 1000) / 1000 } : {}),
    ...(cam.isOrthographicCamera ? { left: cam.left, right: cam.right, top: cam.top, bottom: cam.bottom } : {}),
  };
};
