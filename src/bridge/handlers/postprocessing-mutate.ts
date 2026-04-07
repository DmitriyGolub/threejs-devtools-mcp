/**
 * Post-processing modification handler — enable/disable passes, change parameters.
 */
import type { Handler } from '../types.js';

export const setPostprocessingHandler: Handler = (ctx, params) => {
  const composer = findComposer(ctx);
  if (!composer) {
    throw new Error('No EffectComposer found. Post-processing may not be in use.');
  }

  const passIndex = params.passIndex as number | undefined;
  const passName = params.passName as string | undefined;
  const enabled = params.enabled as boolean | undefined;
  const uniforms = params.uniforms as Record<string, unknown> | undefined;

  // Find the target pass
  let pass: any = null;
  if (passIndex !== undefined) {
    if (passIndex < 0 || passIndex >= composer.passes.length) {
      throw new Error(`Pass index ${passIndex} out of range (0-${composer.passes.length - 1})`);
    }
    pass = composer.passes[passIndex];
  } else if (passName) {
    pass = composer.passes.find((p: any) =>
      p.name === passName ||
      p.constructor?.name === passName
    );
    if (!pass) {
      const available = composer.passes.map((p: any, i: number) =>
        `${i}: ${p.constructor?.name || 'unknown'}${p.name ? ` (${p.name})` : ''}`
      );
      throw new Error(`Pass "${passName}" not found. Available:\n${available.join('\n')}`);
    }
  }

  // If no pass specified, operate on the composer itself
  if (!pass) {
    // List all passes with their current state
    return {
      success: true,
      passes: composer.passes.map((p: any, i: number) => ({
        index: i,
        type: p.constructor?.name || 'unknown',
        name: p.name || '',
        enabled: p.enabled,
      })),
    };
  }

  // Enable/disable
  if (enabled !== undefined) {
    pass.enabled = enabled;
  }

  // Set uniforms on the pass material
  if (uniforms && typeof uniforms === 'object') {
    const target = pass.uniforms
      ? pass.uniforms
      : (pass.material?.uniforms || pass.fsQuad?.material?.uniforms);

    if (target) {
      for (const [key, value] of Object.entries(uniforms)) {
        if (target[key] !== undefined) {
          if (typeof target[key] === 'object' && 'value' in target[key]) {
            target[key].value = value;
          } else {
            target[key] = value;
          }
        }
      }
    }

    const mat = pass.material || pass.fsQuad?.material;
    if (mat?.needsUpdate !== undefined) {
      mat.needsUpdate = true;
    }
  }

  // Set effect parameters (postprocessing library EffectPass)
  if (params.effectIndex !== undefined && pass.effects) {
    const effectIdx = params.effectIndex as number;
    const effect = pass.effects[effectIdx];
    if (!effect) {
      throw new Error(`Effect index ${effectIdx} out of range (0-${pass.effects.length - 1})`);
    }

    const effectParams = params.effectParams as Record<string, unknown> | undefined;
    if (effectParams) {
      for (const [key, value] of Object.entries(effectParams)) {
        // Try setter-style first (e.g., effect.intensity = value)
        if (key in effect) {
          (effect as any)[key] = value;
        }
        // Try uniforms
        else if (effect.uniforms?.has?.(key)) {
          effect.uniforms.get(key).value = value;
        }
      }
    }

    return {
      success: true,
      pass: {
        index: composer.passes.indexOf(pass),
        type: pass.constructor?.name,
        enabled: pass.enabled,
      },
      effect: {
        index: effectIdx,
        type: effect.constructor?.name,
      },
    };
  }

  // Return current pass state
  const result: Record<string, unknown> = {
    success: true,
    pass: {
      index: composer.passes.indexOf(pass),
      type: pass.constructor?.name || 'unknown',
      name: pass.name || '',
      enabled: pass.enabled,
    },
  };

  // Only include uniforms/effects when no mutation was performed (query mode)
  const didMutate = enabled !== undefined || uniforms;
  if (!didMutate) {
    const passUniforms = pass.uniforms || pass.material?.uniforms;
    if (passUniforms) {
      result.availableUniforms = Object.keys(passUniforms);
    }
    if (pass.effects) {
      result.effects = pass.effects.map((e: any, i: number) => ({
        index: i,
        type: e.constructor?.name || 'unknown',
        name: e.name || '',
      }));
    }
  }

  return result;
};

function findComposer(ctx: any): any {
  // Strategy 1: R3F effectComposer
  const canvases = document.querySelectorAll('canvas');
  for (const canvas of canvases) {
    const r3f = (canvas as any).__r3f;
    if (!r3f) continue;
    const root = r3f.store?.getState?.() || r3f.root?.getState?.();
    if (root?.gl?.userData?.effectComposer) return root.gl.userData.effectComposer;
  }

  // Strategy 2: Globals
  const globalNames = ['__effectComposer', '__postprocessing', 'effectComposer'];
  for (const name of globalNames) {
    const composer = (window as any)[name];
    if (composer?.passes) return composer;
  }

  // Strategy 3: Scene userData
  let found: any = null;
  ctx.scene.traverse((obj: any) => {
    if (!found && obj.userData?.effectComposer?.passes) {
      found = obj.userData.effectComposer;
    }
  });
  if (found) return found;

  // Strategy 4: Renderer userData
  if (ctx.renderer.userData?.effectComposer?.passes) {
    return ctx.renderer.userData.effectComposer;
  }

  return null;
}
