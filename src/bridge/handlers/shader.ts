import type { Handler } from '../types.js';
import { serializeUniformValue } from '../serializers/uniform.js';
import { findMaterial } from '../traversal.js';

export const shaderSourceHandler: Handler = (ctx, params) => {
  const mat = findMaterial(ctx.scene, params.materialName as string, params.materialUuid as string);
  if (!mat) throw new Error(`Material not found: ${params.materialName || params.materialUuid}`);

  if (mat.isShaderMaterial || mat.isRawShaderMaterial) {
    return {
      materialName: mat.name, materialUuid: mat.uuid,
      materialType: mat.constructor?.name || mat.type,
      vertexShader: mat.vertexShader || '',
      fragmentShader: mat.fragmentShader || '',
      uniforms: Object.fromEntries(
        Object.entries(mat.uniforms || {}).map(([k, u]) => [k, serializeUniformValue((u as any).value)])
      ),
      defines: mat.defines || {},
    };
  }

  const renderer = ctx.renderer;
  if (renderer?.info?.programs) {
    for (const prog of renderer.info.programs) {
      if (prog.cacheKey && prog.usedTimes > 0) {
        const gl = renderer.getContext();
        if (gl && prog.program) {
          try {
            const vs = gl.getShaderSource(gl.getAttachedShaders(prog.program)?.[0]);
            const fs = gl.getShaderSource(gl.getAttachedShaders(prog.program)?.[1]);
            if (vs || fs) {
              return {
                materialName: mat.name, materialUuid: mat.uuid,
                materialType: mat.constructor?.name || mat.type,
                vertexShader: vs || '[unavailable]',
                fragmentShader: fs || '[unavailable]',
                uniforms: {}, defines: mat.defines || {},
                note: 'Compiled shader — may not be exact match for this material.',
              };
            }
          } catch { /* WebGL may restrict access */ }
        }
      }
    }
  }

  return {
    materialName: mat.name, materialUuid: mat.uuid,
    materialType: mat.constructor?.name || mat.type,
    vertexShader: '[not a ShaderMaterial]', fragmentShader: '[not a ShaderMaterial]',
    uniforms: {}, defines: mat.defines || {},
  };
};

export const shaderListHandler: Handler = (ctx) => {
  const renderer = ctx.renderer;
  if (!renderer?.info?.programs) return { programs: [], note: 'No compiled programs found' };

  return {
    programs: renderer.info.programs.map((prog: any) => ({
      id: prog.id, name: prog.name || '',
      cacheKey: prog.cacheKey?.substring(0, 80) || '',
      usedTimes: prog.usedTimes,
    })),
    total: renderer.info.programs.length,
  };
};
