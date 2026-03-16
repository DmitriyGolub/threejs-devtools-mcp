/**
 * Diagnostic handlers — find_objects, memory_stats, dispose_check,
 * toggle_wireframe, bounding_boxes, env_map_details, scene_diff.
 */
import type { Handler } from '../types.js';
import { serializeVector3 } from '../serializers/vector.js';
import { collectMaterials, collectTextures } from '../traversal.js';
import { readColorHex } from './color-utils.js';
import { getThreeModule } from '../discovery.js';

// ── find_objects ─────────────────────────────────────────

export const findObjectsHandler: Handler = (ctx, params) => {
  const typeFilter = params.type as string | undefined;
  const materialFilter = params.material as string | undefined;
  const visibleFilter = params.visible as boolean | undefined;
  const namePattern = params.namePattern as string | undefined;
  const property = params.property as string | undefined;
  const value = params.value as unknown;
  const minChildren = params.minChildren as number | undefined;
  const hasGeometry = params.hasGeometry as boolean | undefined;
  const limit = Math.min((params.limit as number) || 50, 200);

  let regex: RegExp | null = null;
  if (namePattern) {
    try { regex = new RegExp(namePattern, 'i'); } catch { /* ignore invalid regex */ }
  }

  const results: any[] = [];

  ctx.scene.traverse((obj: any) => {
    if (results.length >= limit) return;

    // Type filter
    if (typeFilter && obj.type !== typeFilter && obj.constructor?.name !== typeFilter) return;

    // Visibility filter
    if (visibleFilter !== undefined && obj.visible !== visibleFilter) return;

    // Name pattern
    if (regex && !regex.test(obj.name || '')) return;

    // Material name filter
    if (materialFilter) {
      if (!obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      const match = mats.some((m: any) =>
        m.name === materialFilter || m.type === materialFilter || m.constructor?.name === materialFilter
      );
      if (!match) return;
    }

    // Min children filter
    if (minChildren !== undefined && (obj.children?.length || 0) < minChildren) return;

    // Has geometry filter
    if (hasGeometry !== undefined) {
      if (hasGeometry && !obj.geometry) return;
      if (!hasGeometry && obj.geometry) return;
    }

    // Property/value filter
    if (property !== undefined) {
      const objValue = obj[property];
      if (value !== undefined) {
        // Loose comparison for numbers/strings/booleans
        if (objValue !== value && String(objValue) !== String(value)) return;
      } else {
        // Just check property exists and is truthy
        if (!objValue) return;
      }
    }

    const entry: any = {
      name: obj.name || '',
      type: obj.type,
      uuid: obj.uuid,
      visible: obj.visible,
      position: serializeVector3(obj.position),
    };

    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      entry.materials = mats.map((m: any) => m.name || m.type || m.constructor?.name);
    }

    if (obj.geometry) {
      entry.vertices = obj.geometry.attributes?.position?.count || 0;
    }

    if (obj.isInstancedMesh) {
      entry.instances = obj.count;
    }

    if (obj.children?.length > 0) {
      entry.children = obj.children.length;
    }

    results.push(entry);
  });

  return { count: results.length, objects: results };
};

// ── memory_stats ─────────────────────────────────────────

export const memoryStatsHandler: Handler = (ctx) => {
  const r = ctx.renderer;
  const info = r.info;

  // Collect all geometries and estimate buffer sizes
  const geometries = new Map<string, any>();
  const materials = collectMaterials(ctx.scene);
  const textures = collectTextures(ctx.scene);

  let totalGeometryBytes = 0;
  let totalInstanceBytes = 0;

  ctx.scene.traverse((obj: any) => {
    if (obj.geometry && !geometries.has(obj.geometry.uuid)) {
      const geo = obj.geometry;
      geometries.set(geo.uuid, geo);

      // Estimate buffer size from attributes
      if (geo.attributes) {
        for (const attr of Object.values(geo.attributes)) {
          const a = attr as any;
          if (a.array) totalGeometryBytes += a.array.byteLength || 0;
        }
      }
      if (geo.index?.array) {
        totalGeometryBytes += geo.index.array.byteLength || 0;
      }
    }

    // Instance buffers
    if (obj.isInstancedMesh) {
      if (obj.instanceMatrix?.array) totalInstanceBytes += obj.instanceMatrix.array.byteLength || 0;
      if (obj.instanceColor?.array) totalInstanceBytes += obj.instanceColor.array.byteLength || 0;
    }
  });

  // Estimate texture VRAM
  let totalTextureBytes = 0;
  const textureDetails: any[] = [];

  for (const tex of textures.values()) {
    let bytes = 0;
    const img = tex.image;
    if (img) {
      const w = img.width || img.videoWidth || 0;
      const h = img.height || img.videoHeight || 0;
      // Approximate: 4 bytes per pixel (RGBA), with mipmaps ≈ ×1.33
      bytes = w * h * 4;
      if (tex.generateMipmaps !== false) bytes = Math.round(bytes * 1.33);
    }
    totalTextureBytes += bytes;

    textureDetails.push({
      name: tex.name || '',
      uuid: tex.uuid,
      size: img ? `${img.width || 0}x${img.height || 0}` : 'unknown',
      format: tex.format,
      type: tex.type,
      estimatedBytes: bytes,
    });
  }

  // Sort textures by size, largest first
  textureDetails.sort((a: any, b: any) => b.estimatedBytes - a.estimatedBytes);

  const formatBytes = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  return {
    summary: {
      geometries: geometries.size,
      materials: materials.size,
      textures: textures.size,
      geometryMemory: formatBytes(totalGeometryBytes),
      textureMemory: formatBytes(totalTextureBytes),
      instanceMemory: formatBytes(totalInstanceBytes),
      totalEstimated: formatBytes(totalGeometryBytes + totalTextureBytes + totalInstanceBytes),
    },
    rendererInfo: {
      geometries: info.memory?.geometries || 0,
      textures: info.memory?.textures || 0,
      programs: info.programs?.length || 0,
    },
    topTextures: textureDetails.slice(0, 10).map((t: any) => ({
      ...t,
      estimatedBytes: formatBytes(t.estimatedBytes),
    })),
  };
};

// ── dispose_check ────────────────────────────────────────

export const disposeCheckHandler: Handler = (ctx) => {
  const r = ctx.renderer;
  const info = r.info;

  // Collect what's actually in the scene
  const sceneGeometries = new Set<string>();
  const sceneMaterials = new Set<string>();
  const sceneTextures = new Set<string>();

  ctx.scene.traverse((obj: any) => {
    if (obj.geometry) sceneGeometries.add(obj.geometry.uuid);
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        sceneMaterials.add(mat.uuid);
        // Check texture slots
        const slots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap',
          'emissiveMap', 'displacementMap', 'alphaMap', 'envMap', 'lightMap',
          'bumpMap', 'specularMap', 'gradientMap'];
        for (const slot of slots) {
          if (mat[slot]?.isTexture) sceneTextures.add(mat[slot].uuid);
        }
        // Shader uniforms
        if (mat.uniforms) {
          for (const u of Object.values(mat.uniforms)) {
            const tex = (u as any).value;
            if (tex?.isTexture) sceneTextures.add(tex.uuid);
          }
        }
      }
    }
  });

  // Scene environment/background textures
  if (ctx.scene.environment?.isTexture) sceneTextures.add(ctx.scene.environment.uuid);
  if (ctx.scene.background?.isTexture) sceneTextures.add(ctx.scene.background.uuid);

  // Compare with renderer tracked counts
  const rendererGeometries = info.memory?.geometries || 0;
  const rendererTextures = info.memory?.textures || 0;

  const orphanedGeometries = Math.max(0, rendererGeometries - sceneGeometries.size);
  const orphanedTextures = Math.max(0, rendererTextures - sceneTextures.size);

  // Find invisible objects that still have geometry (potential waste)
  const hiddenWithGeometry: any[] = [];
  ctx.scene.traverse((obj: any) => {
    if (!obj.visible && obj.geometry && hiddenWithGeometry.length < 20) {
      hiddenWithGeometry.push({
        name: obj.name || '',
        uuid: obj.uuid,
        type: obj.type,
        vertices: obj.geometry.attributes?.position?.count || 0,
      });
    }
  });

  return {
    inScene: {
      geometries: sceneGeometries.size,
      materials: sceneMaterials.size,
      textures: sceneTextures.size,
    },
    inRenderer: {
      geometries: rendererGeometries,
      textures: rendererTextures,
    },
    potentialLeaks: {
      orphanedGeometries,
      orphanedTextures,
      note: orphanedGeometries > 0 || orphanedTextures > 0
        ? 'Renderer tracks more resources than scene uses. These may be leaked (not disposed after removal).'
        : 'No obvious leaks detected.',
    },
    hiddenWithGeometry: hiddenWithGeometry.length > 0
      ? { count: hiddenWithGeometry.length, objects: hiddenWithGeometry }
      : null,
  };
};

// ── toggle_wireframe ─────────────────────────────────────

const wireframeBackup = new Map<string, boolean>();

export const toggleWireframeHandler: Handler = (ctx, params) => {
  const targetName = params.name as string | undefined;
  const targetUuid = params.uuid as string | undefined;
  const enabled = params.enabled as boolean | undefined;

  let count = 0;
  const affectedMaterials: string[] = [];

  const process = (obj: any) => {
    if (!obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (mat.wireframe === undefined) continue; // not all materials support wireframe
      const key = mat.uuid;

      if (enabled === true) {
        if (!wireframeBackup.has(key)) wireframeBackup.set(key, mat.wireframe);
        mat.wireframe = true;
      } else if (enabled === false) {
        const orig = wireframeBackup.get(key);
        mat.wireframe = orig !== undefined ? orig : false;
        wireframeBackup.delete(key);
      } else {
        // Toggle
        if (!wireframeBackup.has(key)) {
          wireframeBackup.set(key, mat.wireframe);
          mat.wireframe = true;
        } else {
          mat.wireframe = wireframeBackup.get(key) || false;
          wireframeBackup.delete(key);
        }
      }

      mat.needsUpdate = true;
      count++;
      affectedMaterials.push(mat.name || mat.uuid);
    }
  };

  if (targetName || targetUuid) {
    // Specific object
    let target: any = null;
    if (targetUuid) {
      ctx.scene.traverse((obj: any) => { if (!target && obj.uuid === targetUuid) target = obj; });
    } else if (targetName) {
      ctx.scene.traverse((obj: any) => { if (!target && obj.name === targetName) target = obj; });
    }
    if (!target) throw new Error(`Object not found: ${targetName || targetUuid}`);
    target.traverse(process);
  } else {
    // Whole scene
    ctx.scene.traverse(process);
  }

  return {
    success: true,
    materialsAffected: count,
    materials: [...new Set(affectedMaterials)].slice(0, 20),
  };
};

// ── bounding_boxes ───────────────────────────────────────

const activeBoundingBoxes = new Map<string, any>();

export const boundingBoxesHandler: Handler = (ctx, params) => {
  const targetName = params.name as string | undefined;
  const targetUuid = params.uuid as string | undefined;
  const enabled = params.enabled !== false;
  const color = (params.color as number) || 0x00ff00;
  const onlyVisible = params.onlyVisible !== false;

  const THREE = getThreeModule();

  // Remove all existing bounding boxes
  if (!enabled || params.clear) {
    let removed = 0;
    for (const [id, helper] of activeBoundingBoxes) {
      if (helper.parent) helper.parent.remove(helper);
      if (helper.dispose) helper.dispose();
      activeBoundingBoxes.delete(id);
      removed++;
    }
    return { success: true, action: 'removed', count: removed };
  }

  const BoxHelperCtor = THREE?.BoxHelper;
  if (!BoxHelperCtor) {
    throw new Error(
      'THREE.BoxHelper not available. Add to your app: import * as THREE from "three"; window.THREE = THREE;'
    );
  }

  let count = 0;
  const maxBoxes = (params.limit as number) || 50;

  const addBox = (obj: any) => {
    if (count >= maxBoxes) return;
    if (!obj.geometry && !obj.isGroup) return;
    if (onlyVisible && !obj.visible) return;
    if (obj.isHelper || obj.type?.includes('Helper')) return;

    const id = `bbox_${obj.uuid}`;
    if (activeBoundingBoxes.has(id)) return;

    const helper = new BoxHelperCtor(obj, color);
    helper.name = id;
    (helper as any).isHelper = true;
    ctx.scene.add(helper);
    activeBoundingBoxes.set(id, helper);
    count++;
  };

  if (targetName || targetUuid) {
    let target: any = null;
    if (targetUuid) {
      ctx.scene.traverse((obj: any) => { if (!target && obj.uuid === targetUuid) target = obj; });
    } else if (targetName) {
      ctx.scene.traverse((obj: any) => { if (!target && obj.name === targetName) target = obj; });
    }
    if (!target) throw new Error(`Object not found: ${targetName || targetUuid}`);
    addBox(target);
    if (params.recursive) {
      target.traverse((child: any) => addBox(child));
    }
  } else {
    ctx.scene.traverse(addBox);
  }

  return { success: true, action: 'added', count };
};

// ── env_map_details ──────────────────────────────────────

export const envMapDetailsHandler: Handler = (ctx) => {
  const scene = ctx.scene;

  const serializeTexture = (tex: any, label: string) => {
    if (!tex) return null;
    const img = tex.image;
    return {
      label,
      name: tex.name || '',
      uuid: tex.uuid,
      type: tex.constructor?.name || 'Texture',
      mapping: tex.mapping,
      size: img
        ? Array.isArray(img)
          ? `${img[0]?.width || 0}x${img[0]?.height || 0} ×${img.length} faces`
          : `${img.width || 0}x${img.height || 0}`
        : 'unknown',
      format: tex.format,
      colorSpace: tex.colorSpace || '',
      generateMipmaps: tex.generateMipmaps,
    };
  };

  // Scene-level
  const sceneEnv = serializeTexture(scene.environment, 'scene.environment');
  const sceneBg = scene.background?.isTexture
    ? serializeTexture(scene.background, 'scene.background')
    : scene.background?.isColor
      ? { label: 'scene.background', type: 'Color', color: readColorHex(scene.background) }
      : null;

  // Per-material envMaps
  const materialEnvMaps: any[] = [];
  const seen = new Set<string>();
  const materials = collectMaterials(scene);

  for (const mat of materials.values()) {
    if (mat.envMap && !seen.has(mat.envMap.uuid)) {
      seen.add(mat.envMap.uuid);
      materialEnvMaps.push({
        materialName: mat.name || mat.uuid,
        materialType: mat.type || mat.constructor?.name,
        envMapIntensity: mat.envMapIntensity,
        ...serializeTexture(mat.envMap, 'material.envMap'),
      });
    }
  }

  return {
    scene: {
      environment: sceneEnv,
      background: sceneBg,
      backgroundBlurriness: scene.backgroundBlurriness ?? 0,
      backgroundIntensity: scene.backgroundIntensity ?? 1,
      environmentIntensity: scene.environmentIntensity ?? 1,
      environmentRotation: scene.environmentRotation
        ? serializeVector3(scene.environmentRotation)
        : null,
    },
    materialEnvMaps: materialEnvMaps.length > 0 ? materialEnvMaps : null,
  };
};

// ── scene_diff ───────────────────────────────────────────

let savedSnapshot: Map<string, any> | null = null;

function takeSnapshot(scene: any): Map<string, any> {
  const snap = new Map<string, any>();
  scene.traverse((obj: any) => {
    const entry: any = {
      name: obj.name || '',
      type: obj.type,
      visible: obj.visible,
      position: [obj.position.x, obj.position.y, obj.position.z],
      rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    };

    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      entry.materials = mats.map((m: any) => ({
        uuid: m.uuid,
        name: m.name || '',
        color: m.color?.isColor ? readColorHex(m.color) : undefined,
        opacity: m.opacity,
        visible: m.visible,
        wireframe: m.wireframe,
      }));
    }

    if (obj.isLight) {
      entry.intensity = obj.intensity;
      entry.color = obj.color?.isColor ? readColorHex(obj.color) : undefined;
    }

    if (obj.isInstancedMesh) {
      entry.instanceCount = obj.count;
    }

    snap.set(obj.uuid, entry);
  });
  return snap;
}

export const sceneDiffHandler: Handler = (ctx, params) => {
  const action = (params.action as string) || 'auto';

  // 'snapshot' — save current state
  if (action === 'snapshot') {
    savedSnapshot = takeSnapshot(ctx.scene);
    return { success: true, action: 'snapshot', objectCount: savedSnapshot.size };
  }

  // 'diff' — compare with saved snapshot
  if (action === 'diff' || (action === 'auto' && savedSnapshot)) {
    if (!savedSnapshot) {
      throw new Error('No snapshot saved. Call scene_diff with action="snapshot" first.');
    }

    const current = takeSnapshot(ctx.scene);
    const changes: any[] = [];

    // Find changed/removed objects
    for (const [uuid, old] of savedSnapshot) {
      const now = current.get(uuid);
      if (!now) {
        changes.push({ uuid, name: old.name, type: old.type, change: 'removed' });
        continue;
      }

      const diffs: Record<string, { from: any; to: any }> = {};

      if (old.visible !== now.visible) diffs.visible = { from: old.visible, to: now.visible };

      // Compare position/rotation/scale (with tolerance)
      for (const prop of ['position', 'rotation', 'scale'] as const) {
        const o = old[prop];
        const n = now[prop];
        if (o && n) {
          const changed = o.some((v: number, i: number) => Math.abs(v - n[i]) > 0.001);
          if (changed) diffs[prop] = { from: o, to: n };
        }
      }

      if (old.intensity !== undefined && now.intensity !== undefined) {
        if (Math.abs(old.intensity - now.intensity) > 0.001) {
          diffs.intensity = { from: old.intensity, to: now.intensity };
        }
      }

      if (old.color !== now.color) diffs.color = { from: old.color, to: now.color };

      if (old.instanceCount !== now.instanceCount) {
        diffs.instanceCount = { from: old.instanceCount, to: now.instanceCount };
      }

      // Material changes
      if (old.materials && now.materials) {
        for (let i = 0; i < Math.max(old.materials.length, now.materials.length); i++) {
          const om = old.materials[i];
          const nm = now.materials[i];
          if (!om || !nm) continue;
          if (om.color !== nm.color) diffs[`material[${i}].color`] = { from: om.color, to: nm.color };
          if (om.opacity !== nm.opacity) diffs[`material[${i}].opacity`] = { from: om.opacity, to: nm.opacity };
          if (om.wireframe !== nm.wireframe) diffs[`material[${i}].wireframe`] = { from: om.wireframe, to: nm.wireframe };
        }
      }

      if (Object.keys(diffs).length > 0) {
        changes.push({ uuid, name: now.name, type: now.type, change: 'modified', diffs });
      }
    }

    // Find added objects
    for (const [uuid, now] of current) {
      if (!savedSnapshot.has(uuid)) {
        changes.push({ uuid, name: now.name, type: now.type, change: 'added' });
      }
    }

    return {
      action: 'diff',
      snapshotObjects: savedSnapshot.size,
      currentObjects: current.size,
      totalChanges: changes.length,
      changes: changes.slice(0, 100),
    };
  }

  // 'auto' with no snapshot — take one
  savedSnapshot = takeSnapshot(ctx.scene);
  return {
    success: true,
    action: 'snapshot',
    objectCount: savedSnapshot.size,
    hint: 'Snapshot saved. Call scene_diff again to see changes.',
  };
};

// ── postprocessing_list ──────────────────────────────────

export const postprocessingListHandler: Handler = (ctx) => {
  const results: any[] = [];

  // Strategy 1: Check R3F postprocessing (drei/react-postprocessing stores effects on scene)
  const canvases = document.querySelectorAll('canvas');
  for (const canvas of canvases) {
    const r3f = (canvas as any).__r3f;
    if (!r3f) continue;

    const root = r3f.store?.getState?.() || r3f.root?.getState?.();
    if (!root) continue;

    // react-postprocessing attaches EffectComposer to the R3F state
    if (root.gl?.userData?.effectComposer) {
      const composer = root.gl.userData.effectComposer;
      results.push(serializeComposer(composer, 'r3f.gl.userData'));
    }
  }

  // Strategy 2: Check common globals
  const globalNames = ['__effectComposer', '__postprocessing', 'effectComposer'];
  for (const name of globalNames) {
    const composer = (window as any)[name];
    if (composer?.passes) {
      results.push(serializeComposer(composer, `window.${name}`));
    }
  }

  // Strategy 3: Traverse scene userData
  ctx.scene.traverse((obj: any) => {
    if (obj.userData?.effectComposer?.passes) {
      results.push(serializeComposer(obj.userData.effectComposer, `${obj.name || obj.uuid}.userData`));
    }
  });

  // Strategy 4: Check renderer userData
  if (ctx.renderer.userData?.effectComposer?.passes) {
    results.push(serializeComposer(ctx.renderer.userData.effectComposer, 'renderer.userData'));
  }

  if (results.length === 0) {
    return {
      found: false,
      message: 'No EffectComposer found. Post-processing may not be in use, or the composer is stored in an unexpected location. Use run_js to inspect manually.',
    };
  }

  return { found: true, composers: results };
};

function serializeComposer(composer: any, source: string): any {
  const passes = (composer.passes || []).map((pass: any, i: number) => {
    const info: any = {
      index: i,
      type: pass.constructor?.name || 'unknown',
      name: pass.name || '',
      enabled: pass.enabled,
      needsSwap: pass.needsSwap,
      renderToScreen: pass.renderToScreen,
    };

    // EffectPass from postprocessing library
    if (pass.effects) {
      info.effects = pass.effects.map((effect: any) => ({
        type: effect.constructor?.name || 'unknown',
        name: effect.name || '',
        blendMode: effect.blendMode?.blendFunction,
      }));
    }

    // ShaderPass
    if (pass.material?.uniforms) {
      info.uniforms = Object.keys(pass.material.uniforms);
    }

    // RenderPass
    if (pass.scene) {
      info.hasScene = true;
    }

    return info;
  });

  return {
    source,
    passCount: passes.length,
    renderTarget: composer.renderTarget1
      ? { width: composer.renderTarget1.width, height: composer.renderTarget1.height }
      : null,
    passes,
  };
}
