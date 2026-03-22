/**
 * Advanced inspection handlers: animation, skeleton, geometry, morph targets, raycasting, helpers.
 */
import type { Handler } from '../types.js';
import { serializeVector3 } from '../serializers/vector.js';
import { findObjectByName, findObjectByUuid } from '../traversal.js';
import { resolveObject } from './mutate.js';
import { getThreeModule } from '../discovery/index.js';

// ── animation_details ────────────────────────────────────

function serializeMixer(mixer: any) {
  const actions = mixer._actions || [];
  return {
    time: mixer.time,
    timeScale: mixer.timeScale,
    root: mixer._root?.name || mixer._root?.uuid || 'unknown',
    actions: actions.map((a: any) => ({
      clipName: a._clip?.name || 'unnamed',
      clipDuration: a._clip?.duration || 0,
      isRunning: a.isRunning?.() ?? false,
      paused: a.paused,
      weight: a.weight,
      effectiveWeight: a.getEffectiveWeight?.() ?? a.weight,
      timeScale: a.timeScale,
      effectiveTimeScale: a.getEffectiveTimeScale?.() ?? a.timeScale,
      time: a.time,
      loop: a.loop,
      repetitions: a.repetitions,
      clampWhenFinished: a.clampWhenFinished,
    })),
  };
}

/** Check if an object looks like an AnimationMixer */
function isMixer(obj: any): boolean {
  return obj && typeof obj.time === 'number' && typeof obj.timeScale === 'number'
    && Array.isArray(obj._actions) && typeof obj.clipAction === 'function';
}

export const animationDetailsHandler: Handler = (ctx) => {
  const mixers: any[] = [];
  const seen = new Set<any>();

  function addMixer(mixer: any) {
    if (!mixer || seen.has(mixer)) return;
    seen.add(mixer);
    mixers.push(serializeMixer(mixer));
  }

  // Strategy 1: Global mixer registry
  const globalMixers = (window as any).__THREE_ANIMATION_MIXERS__;
  if (Array.isArray(globalMixers)) {
    for (const mixer of globalMixers) addMixer(mixer);
  }

  // Strategy 2: Traverse scene for mixers on objects (userData, __mixer, or R3F fiber refs)
  ctx.scene.traverse((obj: any) => {
    // Direct attachment
    if (isMixer(obj.userData?.__mixer)) addMixer(obj.userData.__mixer);
    if (isMixer(obj.__mixer)) addMixer(obj.__mixer);

    // R3F fiber node: walk __r3f.objects Map and check refs for mixers
    const r3f = obj.__r3f;
    if (r3f) {
      // R3F v9+: r3f.memoizedProps may contain animations or mixer refs
      // R3F stores local state in fiber nodes; walk primitive objects
      if (r3f.objects) {
        try {
          r3f.objects.forEach((child: any) => {
            if (isMixer(child)) addMixer(child);
          });
        } catch { /* Map iteration may fail */ }
      }
      // Check if parent fiber has animations-related hooks
      // useAnimations attaches mixer to a ref — check __r3f.handlers or eventCount
    }

    // Check all own properties for mixer instances (covers custom attachments)
    for (const key of Object.keys(obj)) {
      if (key.startsWith('_') || key === 'parent' || key === 'children') continue;
      if (isMixer(obj[key])) addMixer(obj[key]);
    }
  });

  // Strategy 3: R3F store — walk internal subscribers and check refs
  const r3fRoot = (ctx.scene as any).__r3f?.root;
  const r3fState = typeof r3fRoot?.getState === 'function' ? r3fRoot.getState() : null;

  // Also try canvas.__r3f
  if (!r3fState) {
    const canvases = document.querySelectorAll('canvas');
    for (const canvas of canvases) {
      const r3f = (canvas as any).__r3f;
      if (!r3f) continue;
      const root = r3f.store?.getState?.() || r3f.root?.getState?.();
      if (root) { Object.assign(r3fState || {}, root); break; }
    }
  }

  const storeState = r3fState || ((): any => {
    const canvases = document.querySelectorAll('canvas');
    for (const c of canvases) {
      const r = (c as any).__r3f;
      const s = r?.store?.getState?.() || r?.root?.getState?.();
      if (s) return s;
    }
    return null;
  })();

  let activeMixerCount = 0;
  if (storeState?.internal?.subscribers) {
    for (const sub of storeState.internal.subscribers) {
      // Check if subscriber ref holds a mixer directly
      const ref = sub?.ref?.current;
      if (isMixer(ref)) { addMixer(ref); continue; }

      // Detect useAnimations pattern: subscriber source contains 'mixer.update'
      if (typeof ref === 'function') {
        const src = ref.toString();
        if (src.includes('mixer') && src.includes('update')) {
          activeMixerCount++;
        }
      }
    }
  }

  // Strategy 4: Check for objects with .animations array (GLTF data)
  const clips: any[] = [];
  ctx.scene.traverse((obj: any) => {
    if (obj.animations && obj.animations.length > 0) {
      clips.push({
        objectName: obj.name || obj.uuid,
        objectType: obj.type,
        clips: obj.animations.map((clip: any) => ({
          name: clip.name,
          duration: clip.duration,
          tracks: clip.tracks?.length || 0,
        })),
      });
    }
  });

  // Strategy 5: Detect loaded animation GLBs via performance resource entries
  let loadedGlbs: string[] = [];
  try {
    loadedGlbs = [...new Set(
      performance.getEntriesByType('resource')
        .map((e: any) => { try { return new URL(e.name).pathname; } catch { return ''; } })
        .filter((p: string) => /\.(glb|gltf)$/i.test(p))
    )];
  } catch { /* performance API may not be available */ }

  // Strategy 6: Check SkinnedMesh presence — implies character with potential animations
  const skinnedMeshes: any[] = [];
  ctx.scene.traverse((obj: any) => {
    if (obj.isSkinnedMesh) {
      skinnedMeshes.push({
        name: obj.name || obj.uuid,
        boneCount: obj.skeleton?.bones?.length || 0,
        parentName: obj.parent?.name || '',
      });
    }
  });

  // Build response
  const noMixersFound = mixers.length === 0;
  const hasR3fMixerActivity = activeMixerCount > 0;
  const hasSkeletons = skinnedMeshes.length > 0;

  return {
    mixers,
    ...(clips.length > 0 ? { availableClips: clips } : {}),
    ...(activeMixerCount > 0 ? { activeMixersDetected: activeMixerCount } : {}),
    ...(skinnedMeshes.length > 0 ? { skinnedMeshes } : {}),
    ...(loadedGlbs.length > 0 ? { loadedGlbFiles: loadedGlbs } : {}),
    ...(noMixersFound && (hasR3fMixerActivity || hasSkeletons) ? {
      hint: 'Mixer is in a React closure — devtools cannot access it directly.\n'
        + 'Add 2 lines to your component after useAnimations():\n\n'
        + '  useEffect(() => {\n'
        + '    if (group.current) group.current.animations = animations;\n'
        + '    window.__THREE_ANIMATION_MIXERS__ = [mixer];\n'
        + '    return () => { window.__THREE_ANIMATION_MIXERS__ = []; };\n'
        + '  }, [animations, mixer]);',
    } : {}),
  };
};

// ── set_animation ────────────────────────────────────────

export const setAnimationHandler: Handler = (ctx, params) => {
  const mixerIndex = (params.mixerIndex as number) || 0;

  // Find all mixers using the same strategies as animationDetailsHandler
  const allMixers: any[] = [];
  const seen = new Set<any>();

  function addMixer(m: any) {
    if (!m || seen.has(m)) return;
    seen.add(m);
    allMixers.push(m);
  }

  // Global registry
  const globalMixers = (window as any).__THREE_ANIMATION_MIXERS__;
  if (Array.isArray(globalMixers)) {
    for (const m of globalMixers) addMixer(m);
  }

  // Traverse scene
  ctx.scene.traverse((obj: any) => {
    if (isMixer(obj.userData?.__mixer)) addMixer(obj.userData.__mixer);
    if (isMixer(obj.__mixer)) addMixer(obj.__mixer);
    for (const key of Object.keys(obj)) {
      if (key.startsWith('_') || key === 'parent' || key === 'children') continue;
      if (isMixer(obj[key])) addMixer(obj[key]);
    }
  });

  const mixer = allMixers[mixerIndex];
  if (!mixer) throw new Error(
    'No AnimationMixer found. In React Three Fiber, add this to your component:\n'
    + '  useEffect(() => { window.__THREE_ANIMATION_MIXERS__ = [mixer]; }, [mixer]);\n'
    + 'For vanilla Three.js: window.__THREE_ANIMATION_MIXERS__ = [mixer];'
  );

  if (params.timeScale !== undefined) mixer.timeScale = params.timeScale as number;
  if (params.time !== undefined) mixer.time = params.time as number;

  // Control specific action by clip name
  if (params.clipName !== undefined) {
    let action = (mixer._actions || []).find((a: any) => a._clip?.name === params.clipName);

    // Auto-create action from available clips if not yet registered
    if (!action) {
      const root = mixer._root;
      const clip = (root?.animations || []).find((c: any) => c.name === params.clipName);
      if (clip) {
        action = mixer.clipAction(clip);
      }
    }

    if (!action) {
      const registered = (mixer._actions || []).map((a: any) => a._clip?.name).filter(Boolean);
      const available = (mixer._root?.animations || []).map((c: any) => c.name).filter(Boolean);
      throw new Error(
        `Clip "${params.clipName}" not found.\n`
        + `Registered actions: ${registered.join(', ') || 'none'}\n`
        + `Available clips on group: ${available.join(', ') || 'none — expose clips via: group.animations = gltf.animations'}`
      );
    }

    if (params.actionWeight !== undefined) action.weight = params.actionWeight as number;
    if (params.actionTimeScale !== undefined) action.timeScale = params.actionTimeScale as number;
    if (params.actionPaused !== undefined) action.paused = !!params.actionPaused;
    if (params.play) action.reset().fadeIn(0.3).play();
    if (params.stop) action.fadeOut(0.3).stop();
  }

  return {
    success: true,
    timeScale: mixer.timeScale,
    time: mixer.time,
  };
};

// ── skeleton_details ─────────────────────────────────────

export const skeletonDetailsHandler: Handler = (ctx) => {
  const skeletons: any[] = [];

  ctx.scene.traverse((obj: any) => {
    if (obj.isSkinnedMesh && obj.skeleton) {
      const skel = obj.skeleton;
      const bones = skel.bones.map((bone: any) => ({
        name: bone.name || '',
        position: serializeVector3(bone.position),
        rotation: serializeVector3(bone.rotation),
        scale: serializeVector3(bone.scale),
        parentName: bone.parent?.name || '',
        childCount: bone.children?.length || 0,
      }));

      skeletons.push({
        meshName: obj.name || obj.uuid,
        meshUuid: obj.uuid,
        boneCount: skel.bones.length,
        bones,
      });
    }
  });

  return { skeletons };
};

// ── geometry_details ─────────────────────────────────────

export const geometryDetailsHandler: Handler = (ctx, params) => {
  const obj = resolveObject(ctx, params);
  const geo = obj.geometry;

  if (!geo) throw new Error(`Object "${obj.name || obj.uuid}" has no geometry`);

  // Compute bounding box/sphere if needed
  if (!geo.boundingBox) geo.computeBoundingBox();
  if (!geo.boundingSphere) geo.computeBoundingSphere();

  const attributes: any = {};
  if (geo.attributes) {
    for (const [key, attr] of Object.entries(geo.attributes)) {
      const a = attr as any;
      attributes[key] = {
        itemSize: a.itemSize,
        count: a.count,
        normalized: a.normalized || false,
        isInstancedBufferAttribute: a.isInstancedBufferAttribute || false,
        // Sample first few values for quick inspection
        sample: Array.from(a.array.slice(0, Math.min(a.itemSize * 3, 12)))
          .map((v: any) => Math.round(v * 1000) / 1000),
      };
    }
  }

  const result: any = {
    type: geo.constructor?.name || geo.type || 'BufferGeometry',
    uuid: geo.uuid,
    vertexCount: geo.attributes?.position?.count || 0,
    attributes,
    groups: geo.groups || [],
    drawRange: geo.drawRange,
  };

  if (geo.index) {
    result.index = {
      count: geo.index.count,
      itemSize: geo.index.itemSize,
    };
    result.triangleCount = geo.index.count / 3;
  } else {
    result.triangleCount = (geo.attributes?.position?.count || 0) / 3;
  }

  if (geo.boundingBox) {
    result.boundingBox = {
      min: serializeVector3(geo.boundingBox.min),
      max: serializeVector3(geo.boundingBox.max),
    };
  }

  if (geo.boundingSphere) {
    result.boundingSphere = {
      center: serializeVector3(geo.boundingSphere.center),
      radius: Math.round(geo.boundingSphere.radius * 1000) / 1000,
    };
  }

  // Morph attributes
  if (geo.morphAttributes && Object.keys(geo.morphAttributes).length > 0) {
    result.morphAttributes = {};
    for (const [key, attrs] of Object.entries(geo.morphAttributes)) {
      result.morphAttributes[key] = (attrs as any[]).length;
    }
  }

  return result;
};

// ── morph_targets ────────────────────────────────────────

export const morphTargetsHandler: Handler = (ctx) => {
  const meshes: any[] = [];

  ctx.scene.traverse((obj: any) => {
    if (obj.isMesh && obj.morphTargetInfluences && obj.morphTargetInfluences.length > 0) {
      const geo = obj.geometry;
      const targetNames: string[] = [];

      if (geo?.morphAttributes?.position) {
        for (let i = 0; i < geo.morphAttributes.position.length; i++) {
          targetNames.push(obj.morphTargetDictionary
            ? Object.keys(obj.morphTargetDictionary).find(k => obj.morphTargetDictionary[k] === i) || `target_${i}`
            : `target_${i}`);
        }
      }

      meshes.push({
        name: obj.name || obj.uuid,
        uuid: obj.uuid,
        targets: targetNames,
        influences: Array.from(obj.morphTargetInfluences),
        morphTargetDictionary: obj.morphTargetDictionary || {},
      });
    }
  });

  return { meshes };
};

// ── set_morph_target ─────────────────────────────────────

export const setMorphTargetHandler: Handler = (ctx, params) => {
  const obj = resolveObject(ctx, params);

  if (!obj.morphTargetInfluences) {
    throw new Error(`Object "${obj.name || obj.uuid}" has no morph targets`);
  }

  const index = params.index as number;
  const targetName = params.targetName as string;
  const influence = params.influence as number;

  if (influence === undefined) throw new Error('Missing "influence" parameter');

  let targetIndex = index;
  if (targetName !== undefined && obj.morphTargetDictionary) {
    targetIndex = obj.morphTargetDictionary[targetName];
    if (targetIndex === undefined) {
      throw new Error(`Morph target "${targetName}" not found. Available: ${Object.keys(obj.morphTargetDictionary).join(', ')}`);
    }
  }

  if (targetIndex === undefined || targetIndex < 0 || targetIndex >= obj.morphTargetInfluences.length) {
    throw new Error(`Morph target index ${targetIndex} out of range (0..${obj.morphTargetInfluences.length - 1})`);
  }

  obj.morphTargetInfluences[targetIndex] = influence;

  return {
    success: true,
    object: obj.name || obj.uuid,
    index: targetIndex,
    influence: obj.morphTargetInfluences[targetIndex],
    allInfluences: Array.from(obj.morphTargetInfluences),
  };
};

// ── raycast ──────────────────────────────────────────────

export const raycastHandler: Handler = (ctx, params) => {
  const x = params.x as number; // normalized device coords: -1..1
  const y = params.y as number;

  if (x === undefined || y === undefined) {
    throw new Error('Missing x and/or y parameters (normalized device coordinates, -1 to 1)');
  }

  const camera = ctx.camera;
  const scene = ctx.scene;

  // Raycaster is always in the bundle when R3F is used (it's in the store)
  const THREE = getThreeModule();
  const RaycasterCtor = THREE?.Raycaster;

  if (!RaycasterCtor) {
    throw new Error('THREE.Raycaster not available. R3F apps should have it auto-detected.');
  }

  const raycaster = new RaycasterCtor();
  const mouse = { x, y };

  // setFromCamera expects {x, y} and camera
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);

  const hits = intersects.slice(0, params.maxHits as number || 10).map((hit: any) => ({
    object: hit.object?.name || '',
    objectUuid: hit.object?.uuid || '',
    objectType: hit.object?.type || '',
    distance: Math.round(hit.distance * 1000) / 1000,
    point: serializeVector3(hit.point),
    faceIndex: hit.faceIndex,
    instanceId: hit.instanceId,
  }));

  return { hits, totalHits: intersects.length };
};

// ── add_helper / remove_helper ───────────────────────────

const activeHelpers = new Map<string, any>();

export const addHelperHandler: Handler = (ctx, params) => {
  const targetName = params.target as string;
  const targetUuid = params.targetUuid as string;
  const helperType = (params.type as string) || 'box';
  const size = (params.size as number) || 1;
  const color = (params.color as number) || 0x00ff00;

  let target: any = null;
  if (targetUuid) target = findObjectByUuid(ctx.scene, targetUuid);
  else if (targetName) target = findObjectByName(ctx.scene, targetName);
  if (!target) throw new Error(`Target object not found: ${targetName || targetUuid}`);

  const THREE = getThreeModule();

  let helper: any;
  const helperId = `helper_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // Direction/origin for ArrowHelper
  const dir = params.direction as number[] | undefined;
  const origin = params.origin as number[] | undefined;
  const length = (params.length as number) || 1;
  const gridDivisions = (params.divisions as number) || 10;

  // Vector3 constructor — get from existing object if THREE module not available
  const Vec3 = THREE?.Vector3 || target.position.constructor;
  const makeVec3 = (x: number, y: number, z: number) => new Vec3(x, y, z);

  const require3 = (name: string) => {
    if (!THREE?.[name]) throw new Error(
      `THREE.${name} not available. Helpers need the full THREE module.\n` +
      `Fix: add this to your app entry point:\n` +
      `  import * as THREE from "three"; window.THREE = THREE;\n` +
      `Or use run_js to create helpers manually.`
    );
    return THREE[name];
  };

  if (helperType === 'box') {
    const Ctor = require3('BoxHelper');
    helper = new Ctor(target, color);
    ctx.scene.add(helper);
  } else if (helperType === 'axes') {
    const Ctor = require3('AxesHelper');
    helper = new Ctor(size);
    target.add(helper);
  } else if (helperType === 'skeleton') {
    const Ctor = require3('SkeletonHelper');
    helper = new Ctor(target);
    ctx.scene.add(helper);
  } else if (helperType === 'arrow') {
    const Ctor = require3('ArrowHelper');
    const d = dir ? makeVec3(dir[0], dir[1], dir[2]).normalize() : makeVec3(0, 1, 0);
    const o = origin ? makeVec3(origin[0], origin[1], origin[2]) : target.position.clone();
    helper = new Ctor(d, o, length, color);
    ctx.scene.add(helper);
  } else if (helperType === 'grid') {
    const Ctor = require3('GridHelper');
    helper = new Ctor(size, gridDivisions, color, color);
    helper.position.copy(target.position);
    ctx.scene.add(helper);
  } else if (helperType === 'polar_grid') {
    const Ctor = require3('PolarGridHelper');
    helper = new Ctor(size, 16, 8, 64);
    helper.position.copy(target.position);
    ctx.scene.add(helper);
  } else if (helperType === 'camera') {
    const Ctor = require3('CameraHelper');
    if (!target.isCamera) throw new Error(`Target "${target.name || target.uuid}" is not a Camera`);
    helper = new Ctor(target);
    ctx.scene.add(helper);
  } else if (helperType === 'directional_light') {
    const Ctor = require3('DirectionalLightHelper');
    if (!target.isDirectionalLight) throw new Error(`Target "${target.name || target.uuid}" is not a DirectionalLight`);
    helper = new Ctor(target, size, color);
    ctx.scene.add(helper);
  } else if (helperType === 'spot_light') {
    const Ctor = require3('SpotLightHelper');
    if (!target.isSpotLight) throw new Error(`Target "${target.name || target.uuid}" is not a SpotLight`);
    helper = new Ctor(target, color);
    ctx.scene.add(helper);
  } else if (helperType === 'point_light') {
    const Ctor = require3('PointLightHelper');
    if (!target.isPointLight) throw new Error(`Target "${target.name || target.uuid}" is not a PointLight`);
    helper = new Ctor(target, size, color);
    ctx.scene.add(helper);
  } else if (helperType === 'hemisphere_light') {
    const Ctor = require3('HemisphereLightHelper');
    if (!target.isHemisphereLight) throw new Error(`Target "${target.name || target.uuid}" is not a HemisphereLight`);
    helper = new Ctor(target, size, color);
    ctx.scene.add(helper);
  } else if (helperType === 'plane') {
    const PlaneCtor = require3('Plane');
    const HelperCtor = require3('PlaneHelper');
    const normal = dir ? makeVec3(dir[0], dir[1], dir[2]).normalize() : makeVec3(0, 1, 0);
    const plane = new PlaneCtor(normal, 0);
    helper = new HelperCtor(plane, size, color);
    helper.position.copy(target.position);
    ctx.scene.add(helper);
  } else {
    throw new Error(`Unknown helper type: "${helperType}". Supported: box, axes, skeleton, arrow, grid, polar_grid, camera, directional_light, spot_light, point_light, hemisphere_light, plane`);
  }

  helper.name = helperId;
  activeHelpers.set(helperId, { helper, parent: helper.parent });

  return {
    success: true,
    helperId,
    type: helperType,
    target: target.name || target.uuid,
  };
};

export const removeHelperHandler: Handler = (ctx, params) => {
  const helperId = params.helperId as string;
  if (!helperId) throw new Error('Missing "helperId" parameter');

  const entry = activeHelpers.get(helperId);
  if (!entry) {
    // Try to find by name in scene
    let found: any = null;
    ctx.scene.traverse((obj: any) => {
      if (!found && obj.name === helperId) found = obj;
    });
    if (found && found.parent) {
      found.parent.remove(found);
      if (found.dispose) found.dispose();
      return { success: true, helperId };
    }
    throw new Error(`Helper "${helperId}" not found`);
  }

  const { helper } = entry;
  if (helper.parent) helper.parent.remove(helper);
  if (helper.dispose) helper.dispose();
  activeHelpers.delete(helperId);

  return { success: true, helperId };
};

// ── set_texture ──────────────────────────────────────────

export const setTextureHandler: Handler = (ctx, params) => {
  const uuid = params.uuid as string;
  const name = params.name as string;

  // Find texture by traversing materials
  let texture: any = null;
  ctx.scene.traverse((obj: any) => {
    if (texture) return;
    if (!obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      const slots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap',
        'emissiveMap', 'displacementMap', 'alphaMap', 'envMap', 'lightMap',
        'bumpMap', 'specularMap', 'gradientMap'];
      for (const slot of slots) {
        const tex = mat[slot];
        if (tex && ((uuid && tex.uuid === uuid) || (name && tex.name === name))) {
          texture = tex;
          return;
        }
      }
      // Check uniforms
      if (mat.uniforms) {
        for (const u of Object.values(mat.uniforms)) {
          const tex = (u as any).value;
          if (tex?.isTexture && ((uuid && tex.uuid === uuid) || (name && tex.name === name))) {
            texture = tex;
            return;
          }
        }
      }
    }
  });

  if (!texture) throw new Error(`Texture not found: ${name || uuid}`);

  // Apply mutations
  if (params.wrapS !== undefined) texture.wrapS = params.wrapS as number;
  if (params.wrapT !== undefined) texture.wrapT = params.wrapT as number;
  if (params.minFilter !== undefined) texture.minFilter = params.minFilter as number;
  if (params.magFilter !== undefined) texture.magFilter = params.magFilter as number;
  if (params.anisotropy !== undefined) texture.anisotropy = params.anisotropy as number;
  if (params.flipY !== undefined) texture.flipY = !!params.flipY;
  if (params.colorSpace !== undefined) texture.colorSpace = params.colorSpace as string;

  if (params.repeat !== undefined) {
    const r = params.repeat as number[];
    if (Array.isArray(r) && r.length === 2) texture.repeat.set(r[0], r[1]);
  }
  if (params.offset !== undefined) {
    const o = params.offset as number[];
    if (Array.isArray(o) && o.length === 2) texture.offset.set(o[0], o[1]);
  }
  if (params.rotation !== undefined) texture.rotation = params.rotation as number;

  texture.needsUpdate = true;

  return {
    success: true,
    uuid: texture.uuid,
    name: texture.name || '',
    wrapS: texture.wrapS,
    wrapT: texture.wrapT,
    minFilter: texture.minFilter,
    magFilter: texture.magFilter,
    anisotropy: texture.anisotropy,
    flipY: texture.flipY,
    colorSpace: texture.colorSpace,
    repeat: [texture.repeat.x, texture.repeat.y],
    offset: [texture.offset.x, texture.offset.y],
    rotation: texture.rotation,
  };
};
