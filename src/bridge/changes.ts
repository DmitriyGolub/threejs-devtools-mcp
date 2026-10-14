/**
 * Change journal for live-preview tools.
 *
 * Every preview tool (set_*) is wrapped: its target is read before and after the
 * call, and each value that actually changed is recorded. The journal is what
 * `pending_changes` turns into code edits and what `revert_changes` undoes.
 *
 * A reader returns values keyed by the tool's own parameter names, so reverting
 * is just calling the same handler again with the `before` values.
 */
import type { Handler, ThreeContext } from './types.js';
import { findObjectByName, findObjectByUuid, findTexture, collectMaterials, objectPath, findMaterialOwner } from './traversal.js';
import { resolveObject, resolveMaterial } from './handlers/mutate.js';
import { collectMixers } from './handlers/inspect.js';
import { findComposer } from './handlers/postprocessing-mutate.js';
import { readColorHex } from './handlers/color-utils.js';

export interface ChangeTarget {
  kind: 'object' | 'light' | 'material' | 'camera' | 'fog' | 'renderer' | 'texture' | 'animation' | 'postprocessing';
  name: string;
  uuid?: string;
  /** Three.js class, e.g. MeshStandardMaterial, DirectionalLight */
  type?: string;
  /** Dot path from the scene root (objects) or of the first mesh using it (materials) */
  path?: string;
}

export interface Change {
  id: number;
  tool: string;
  target: ChangeTarget;
  key: string;
  before: unknown;
  after: unknown;
}

interface Snapshot {
  target: ChangeTarget;
  /** Params that address the same target again (used for revert) */
  selector: Record<string, unknown>;
  values: Record<string, unknown>;
}

interface Tracker {
  read(ctx: ThreeContext, params: Record<string, unknown>): Snapshot;
  /** Build handler params that set one key back. Default: { ...selector, [key]: value } */
  toParams?(selector: Record<string, unknown>, key: string, value: unknown): Record<string, unknown>;
}

interface Entry extends Change {
  selector: Record<string, unknown>;
}

const MAX_CHANGES = 200;
const journal: Entry[] = [];
let nextId = 1;

// ── Value helpers ────────────────────────────────────────

const round = (n: number) => Math.round(n * 1e4) / 1e4;

/** Three.js value → plain JSON in the shape the set_* tools accept */
function plain(v: any): unknown {
  if (v === null || v === undefined) return v ?? null;
  if (typeof v === 'number') return round(v);
  if (v.isColor) return readColorHex(v);
  if (v.isVector2) return [round(v.x), round(v.y)];
  if (v.isVector3 || v.isEuler) return [round(v.x), round(v.y), round(v.z)];
  if (typeof v === 'object' && !Array.isArray(v)) return undefined; // textures, matrices: not tracked
  return v;
}

/** Uniforms take {x,y,z} for vectors, see set_uniform */
function plainUniform(v: any): unknown {
  if (v?.isVector2) return { x: round(v.x), y: round(v.y) };
  if (v?.isVector3) return { x: round(v.x), y: round(v.y), z: round(v.z) };
  return plain(v);
}

function pick(source: any, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (source[k] !== undefined) out[k] = plain(source[k]);
  return out;
}

function objectTarget(obj: any, kind: ChangeTarget['kind'] = obj.isLight ? 'light' : 'object'): ChangeTarget {
  return { kind, name: obj.name || '', uuid: obj.uuid, type: obj.type, path: objectPath(obj) };
}

function materialTarget(ctx: ThreeContext, mat: any): ChangeTarget {
  const owner = findMaterialOwner(ctx.scene, mat);
  return {
    kind: 'material',
    name: mat.name || owner?.name || '',
    uuid: mat.uuid,
    type: mat.type,
    ...(owner ? { path: objectPath(owner) } : {}),
  };
}

function serializePlanes(planes: any[] | null | undefined): unknown {
  if (!planes) return null;
  return planes.map((p: any) => ({ normal: plain(p.normal), constant: round(p.constant) }));
}

// ── Trackers (one per preview tool) ──────────────────────

const trackers: Record<string, Tracker> = {
  set_material_property: {
    read(ctx, params) {
      const mat = resolveMaterial(ctx, params);
      const prop = params.property as string;
      return { target: materialTarget(ctx, mat), selector: { uuid: mat.uuid }, values: { [prop]: plain(mat[prop]) } };
    },
    toParams: (selector, key, value) => ({ ...selector, property: key, value }),
  },

  set_uniform: {
    read(ctx, params) {
      const mat = resolveMaterial(ctx, params);
      const name = params.uniform as string;
      return {
        target: materialTarget(ctx, mat),
        selector: { uuid: mat.uuid },
        values: { [name]: plainUniform(mat.uniforms?.[name]?.value) },
      };
    },
    toParams: (selector, key, value) => ({ ...selector, uniform: key, value }),
  },

  set_object_transform: {
    read(ctx, params) {
      const obj = resolveObject(ctx, params);
      return { target: objectTarget(obj), selector: { uuid: obj.uuid }, values: pick(obj, ['position', 'rotation', 'scale', 'visible']) };
    },
  },

  set_light: {
    read(ctx, params) {
      const obj = resolveObject(ctx, params);
      return {
        target: objectTarget(obj, 'light'),
        selector: { uuid: obj.uuid },
        values: pick(obj, ['color', 'intensity', 'position', 'castShadow', 'groundColor']),
      };
    },
  },

  set_instanced_mesh: {
    read(ctx, params) {
      const obj = resolveObject(ctx, params);
      return { target: objectTarget(obj), selector: { uuid: obj.uuid }, values: pick(obj, ['count', 'visible', 'frustumCulled']) };
    },
  },

  set_camera: {
    read(ctx) {
      const cam = ctx.camera;
      return {
        target: objectTarget(cam, 'camera'),
        selector: {},
        values: pick(cam, ['position', 'rotation', 'near', 'far', 'zoom', 'fov', 'aspect', 'left', 'right', 'top', 'bottom']),
      };
    },
  },

  set_fog: {
    read(ctx) {
      const fog = ctx.scene.fog;
      const values = fog ? pick(fog, ['color', 'near', 'far', 'density']) : {};
      if (ctx.scene.background?.isColor) values.background = plain(ctx.scene.background);
      return { target: { kind: 'fog', name: 'scene.fog', type: fog?.isFogExp2 ? 'FogExp2' : 'Fog' }, selector: {}, values };
    },
  },

  set_renderer: {
    read(ctx) {
      const r = ctx.renderer;
      return {
        target: { kind: 'renderer', name: 'renderer', type: r.isWebGPURenderer ? 'WebGPURenderer' : 'WebGLRenderer' },
        selector: {},
        values: {
          ...pick(r, ['toneMapping', 'toneMappingExposure', 'outputColorSpace', 'sortObjects', 'localClippingEnabled']),
          pixelRatio: r.getPixelRatio?.(),
          shadowMapEnabled: r.shadowMap?.enabled,
          shadowMapType: r.shadowMap?.type,
        },
      };
    },
  },

  set_layers: {
    read(ctx, params) {
      if (params.target === 'camera') {
        return { target: objectTarget(ctx.camera, 'camera'), selector: { target: 'camera' }, values: { mask: ctx.camera.layers.mask } };
      }
      const obj = params.uuid
        ? findObjectByUuid(ctx.scene, params.uuid as string)
        : findObjectByName(ctx.scene, params.name as string);
      if (!obj) throw new Error('not found');
      return { target: objectTarget(obj), selector: { uuid: obj.uuid }, values: { mask: obj.layers.mask } };
    },
  },

  set_morph_target: {
    read(ctx, params) {
      const obj = resolveObject(ctx, params);
      const index = params.targetName !== undefined
        ? obj.morphTargetDictionary?.[params.targetName as string]
        : params.index as number;
      return {
        target: objectTarget(obj),
        selector: { uuid: obj.uuid },
        values: { [`morphTargetInfluences[${index}]`]: plain(obj.morphTargetInfluences?.[index]) },
      };
    },
    toParams: (selector, key, value) => ({ ...selector, index: Number(key.match(/\d+/)![0]), influence: value }),
  },

  set_texture: {
    read(ctx, params) {
      const tex = findTexture(ctx.scene, params.name as string, params.uuid as string);
      if (!tex) throw new Error('not found');
      return {
        target: { kind: 'texture', name: tex.name || '', uuid: tex.uuid, type: tex.constructor?.name },
        selector: { uuid: tex.uuid },
        values: pick(tex, ['wrapS', 'wrapT', 'minFilter', 'magFilter', 'anisotropy', 'flipY', 'colorSpace', 'repeat', 'offset', 'rotation']),
      };
    },
  },

  set_shadow: {
    read(ctx, params) {
      const obj = resolveObject(ctx, params);
      const values = pick(obj, ['castShadow', 'receiveShadow']);
      const shadow = obj.isLight ? obj.shadow : null;
      if (shadow) {
        Object.assign(values, pick(shadow, ['bias', 'normalBias', 'radius', 'blurSamples', 'mapSize']));
        const cam = shadow.camera ?? {};
        for (const k of ['near', 'far', 'left', 'right', 'top', 'bottom']) {
          if (cam[k] !== undefined) values[`camera${k[0].toUpperCase()}${k.slice(1)}`] = plain(cam[k]);
        }
      }
      return { target: objectTarget(obj), selector: { uuid: obj.uuid }, values };
    },
  },

  set_clipping: {
    read(ctx, params) {
      if (params.target !== 'material') {
        const r = ctx.renderer;
        return {
          target: { kind: 'renderer', name: 'renderer' },
          selector: { target: 'renderer' },
          values: { localClippingEnabled: r.localClippingEnabled, planes: serializePlanes(r.clippingPlanes) ?? [] },
        };
      }
      const mats = collectMaterials(ctx.scene);
      const mat = (params.uuid && mats.get(params.uuid as string))
        || [...mats.values()].find((m: any) => m.name === params.name);
      if (!mat) throw new Error('not found');
      return {
        target: materialTarget(ctx, mat),
        selector: { target: 'material', uuid: mat.uuid },
        values: { clipIntersection: mat.clipIntersection, clipShadows: mat.clipShadows, planes: serializePlanes(mat.clippingPlanes) },
      };
    },
    toParams: (selector, key, value) =>
      key === 'planes' && value === null ? { ...selector, enabled: false } : { ...selector, [key]: value },
  },

  set_animation: {
    read(ctx, params) {
      const mixerIndex = (params.mixerIndex as number) || 0;
      const mixer = collectMixers(ctx).mixers[mixerIndex];
      if (!mixer) throw new Error('not found');
      const clipName = params.clipName as string | undefined;
      const values: Record<string, unknown> = { timeScale: mixer.timeScale };
      const action = clipName ? (mixer._actions || []).find((a: any) => a._clip?.name === clipName) : null;
      if (action) {
        values.actionWeight = round(action.weight);
        values.actionTimeScale = action.timeScale;
        values.actionPaused = action.paused;
        values.playing = action.isRunning?.() ?? false;
      }
      return {
        target: { kind: 'animation', name: clipName || mixer._root?.name || `mixer ${mixerIndex}` },
        selector: { mixerIndex, ...(clipName ? { clipName } : {}) },
        values,
      };
    },
    toParams: (selector, key, value) =>
      key === 'playing' ? { ...selector, [value ? 'play' : 'stop']: true } : { ...selector, [key]: value },
  },

  set_postprocessing: {
    read(ctx, params) {
      const composer = findComposer(ctx);
      const passes: any[] = composer?.passes ?? [];
      const passIndex = params.passIndex !== undefined
        ? params.passIndex as number
        : passes.findIndex((p: any) => p.name === params.passName || p.constructor?.name === params.passName);
      const pass = passes[passIndex];
      if (!pass) throw new Error('not found');

      const values: Record<string, unknown> = { enabled: pass.enabled };
      const uniforms = pass.uniforms ?? pass.material?.uniforms ?? pass.fsQuad?.material?.uniforms;
      for (const k of Object.keys((params.uniforms as object) ?? {})) {
        const u = uniforms?.[k];
        values[`uniforms.${k}`] = plain(u && typeof u === 'object' && 'value' in u ? u.value : u);
      }
      const effect = params.effectIndex !== undefined ? pass.effects?.[params.effectIndex as number] : null;
      for (const k of Object.keys((params.effectParams as object) ?? {})) {
        values[`effectParams.${k}`] = plain(effect?.[k] ?? effect?.uniforms?.get?.(k)?.value);
      }
      return {
        target: { kind: 'postprocessing', name: pass.name || pass.constructor?.name || `pass ${passIndex}`, type: pass.constructor?.name },
        selector: { passIndex, ...(params.effectIndex !== undefined ? { effectIndex: params.effectIndex } : {}) },
        values,
      };
    },
    toParams(selector, key, value) {
      const [group, name] = key.split('.');
      return name ? { ...selector, [group]: { [name]: value } } : { ...selector, [key]: value };
    },
  },
};

export const PREVIEW_TOOLS = Object.keys(trackers);

// ── Journal ──────────────────────────────────────────────

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function record(tool: string, before: Snapshot, after: Snapshot): void {
  for (const [key, afterValue] of Object.entries(after.values)) {
    const beforeValue = before.values[key];
    if (afterValue === undefined || same(beforeValue, afterValue)) continue;

    const existing = journal.find(e => e.tool === tool && e.key === key && same(e.selector, after.selector));
    if (existing) {
      existing.after = afterValue;
      // Changed back to the original value — nothing left to persist
      if (same(existing.before, afterValue)) journal.splice(journal.indexOf(existing), 1);
      continue;
    }
    journal.push({ id: nextId++, tool, target: after.target, selector: after.selector, key, before: beforeValue, after: afterValue });
    if (journal.length > MAX_CHANGES) journal.shift();
  }
}

function safeRead(tracker: Tracker, ctx: ThreeContext, params: Record<string, unknown>): Snapshot | null {
  try { return tracker.read(ctx, params); } catch { return null; }
}

/** Wrap every preview handler so its effects land in the journal */
export function withChangeTracking(handlers: Record<string, Handler>): Record<string, Handler> {
  const wrapped = { ...handlers };
  for (const [tool, tracker] of Object.entries(trackers)) {
    const handler = handlers[tool];
    if (!handler) continue;
    wrapped[tool] = async (ctx, params) => {
      const before = safeRead(tracker, ctx, params);
      const result = await handler(ctx, params);
      const after = before && safeRead(tracker, ctx, params);
      if (before && after) record(tool, before, after);
      return result && typeof result === 'object'
        ? { ...result, pendingChanges: journal.length }
        : result;
    };
  }
  return wrapped;
}

// ── pending_changes / revert_changes ─────────────────────

export function pendingChangesHandler(): Handler {
  return (_ctx, params) => {
    const changes: Change[] = journal.map(({ selector: _s, ...change }) => change);
    if (params.clear) journal.length = 0;
    return { count: changes.length, changes, cleared: !!params.clear };
  };
}

/** Undo changes newest-first by calling the original (unwrapped) handlers with `before` values */
export function revertChangesHandler(handlers: Record<string, Handler>): Handler {
  return async (ctx, params) => {
    const ids = params.ids as number[] | undefined;
    const targets = journal.filter(e => !ids || ids.includes(e.id)).reverse();
    const reverted: number[] = [];
    const failed: { id: number; error: string }[] = [];

    for (const entry of targets) {
      const tracker = trackers[entry.tool];
      const toParams = tracker.toParams ?? ((s, k, v) => ({ ...s, [k]: v }));
      try {
        await handlers[entry.tool](ctx, toParams(entry.selector, entry.key, entry.before));
        journal.splice(journal.indexOf(entry), 1);
        reverted.push(entry.id);
      } catch (err) {
        failed.push({ id: entry.id, error: (err as Error).message });
      }
    }
    return { reverted: reverted.length, failed, remaining: journal.length };
  };
}
