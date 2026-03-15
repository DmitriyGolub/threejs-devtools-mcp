/**
 * Advanced inspection handlers: animation, skeleton, geometry, morph targets, raycasting, helpers.
 */
import type { Handler } from '../types.js';
import { serializeVector3 } from '../serializers/vector.js';
import { findObjectByName, findObjectByUuid } from '../traversal.js';
import { resolveObject } from './mutate.js';

// ── animation_details ────────────────────────────────────

export const animationDetailsHandler: Handler = (ctx) => {
  const mixers: any[] = [];

  // Three.js doesn't expose a global mixer list. We search for __r3f or common patterns.
  // Strategy 1: Check R3F fiber store for animations
  // Strategy 2: Traverse scene for objects with animation-related userData
  // Strategy 3: Look for AnimationMixer instances on __r3f roots

  // Find all canvases with __r3f store
  const canvases = document.querySelectorAll('canvas');
  for (const canvas of canvases) {
    const r3f = (canvas as any).__r3f;
    if (!r3f) continue;

    // R3F stores root state
    const root = r3f.store?.getState?.() || r3f.root?.getState?.();
    if (!root) continue;

    // Look for animation mixers in the R3F internal state
    // They're usually attached to objects via useAnimations
    break;
  }

  // Fallback: traverse scene for objects with animation data
  const animatedObjects: any[] = [];
  ctx.scene.traverse((obj: any) => {
    // Check for AnimationMixer stored on the object
    if (obj.userData?.__mixer || obj.__mixer) {
      const mixer = obj.userData.__mixer || obj.__mixer;
      animatedObjects.push({ obj, mixer });
    }
  });

  // Also check for global AnimationMixer via window
  const globalMixers = (window as any).__THREE_ANIMATION_MIXERS__;
  if (Array.isArray(globalMixers)) {
    for (const mixer of globalMixers) {
      const actions = mixer._actions || [];
      mixers.push({
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
      });
    }
  }

  // If no global registry, try to find mixers by traversing prototype chains
  // This is a best-effort approach since Three.js doesn't have a mixer registry
  if (mixers.length === 0 && animatedObjects.length > 0) {
    for (const { mixer } of animatedObjects) {
      const actions = mixer._actions || [];
      mixers.push({
        time: mixer.time,
        timeScale: mixer.timeScale,
        root: mixer._root?.name || mixer._root?.uuid || 'unknown',
        actions: actions.map((a: any) => ({
          clipName: a._clip?.name || 'unnamed',
          clipDuration: a._clip?.duration || 0,
          isRunning: a.isRunning?.() ?? false,
          paused: a.paused,
          weight: a.weight,
          timeScale: a.timeScale,
          time: a.time,
        })),
      });
    }
  }

  return { mixers };
};

// ── set_animation ────────────────────────────────────────

export const setAnimationHandler: Handler = (ctx, params) => {
  const mixerIndex = (params.mixerIndex as number) || 0;

  // Try to find the mixer
  const globalMixers = (window as any).__THREE_ANIMATION_MIXERS__;
  let mixer: any = null;

  if (Array.isArray(globalMixers) && globalMixers[mixerIndex]) {
    mixer = globalMixers[mixerIndex];
  } else {
    // Traverse scene for mixer
    ctx.scene.traverse((obj: any) => {
      if (!mixer && (obj.userData?.__mixer || obj.__mixer)) {
        mixer = obj.userData.__mixer || obj.__mixer;
      }
    });
  }

  if (!mixer) throw new Error('No AnimationMixer found. Expose mixers via window.__THREE_ANIMATION_MIXERS__ = [mixer]');

  if (params.timeScale !== undefined) mixer.timeScale = params.timeScale as number;
  if (params.time !== undefined) mixer.time = params.time as number;

  // Control specific action by clip name
  if (params.clipName !== undefined) {
    const actions = mixer._actions || [];
    const action = actions.find((a: any) => a._clip?.name === params.clipName);
    if (!action) throw new Error(`Action with clip "${params.clipName}" not found`);

    if (params.actionWeight !== undefined) action.weight = params.actionWeight as number;
    if (params.actionTimeScale !== undefined) action.timeScale = params.actionTimeScale as number;
    if (params.actionPaused !== undefined) action.paused = !!params.actionPaused;
    if (params.play) action.play();
    if (params.stop) action.stop();
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

  // Create raycaster — we need THREE classes from the scene context
  // Since we're in browser, we can use constructors from existing objects
  const camera = ctx.camera;
  const scene = ctx.scene;

  // Get Three.js constructors from existing objects
  const Vector2Ctor = camera.position.constructor.prototype.constructor;
  const RaycasterCtor = (window as any).THREE?.Raycaster;

  if (!RaycasterCtor) {
    // Fallback: construct manually by finding Raycaster in Three.js module
    // The scene must have THREE accessible
    throw new Error('THREE.Raycaster not found. Ensure THREE is accessible on window.THREE');
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

  // We need THREE constructors — try to get them
  const THREE = (window as any).THREE;

  let helper: any;
  const helperId = `helper_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  if (helperType === 'box') {
    if (THREE?.BoxHelper) {
      helper = new THREE.BoxHelper(target, color);
    } else {
      // Manual bounding box visualization using line segments
      throw new Error('THREE.BoxHelper not available on window.THREE');
    }
  } else if (helperType === 'axes') {
    if (THREE?.AxesHelper) {
      helper = new THREE.AxesHelper(size);
      target.add(helper);
    } else {
      throw new Error('THREE.AxesHelper not available on window.THREE');
    }
  } else if (helperType === 'skeleton') {
    if (THREE?.SkeletonHelper) {
      helper = new THREE.SkeletonHelper(target);
      ctx.scene.add(helper);
    } else {
      throw new Error('THREE.SkeletonHelper not available on window.THREE');
    }
  } else {
    throw new Error(`Unknown helper type: "${helperType}". Supported: box, axes, skeleton`);
  }

  if (helperType === 'box') {
    ctx.scene.add(helper);
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
