import type { ToolContext } from '../tool-helper.js';
import { registerSceneTools } from './scene.js';
import { registerMaterialTools } from './materials.js';
import { registerLightingTools } from './lighting.js';
import { registerRenderingTools } from './rendering.js';
import { registerGeometryTools } from './geometry.js';
import { registerPerformanceTools } from './performance.js';
import { registerDebugTools } from './debug.js';
import { registerCaptureTools } from './capture.js';
import { registerCodeTools } from './code.js';
import { registerConnectionTools } from './connection.js';

export function registerTools(ctx: ToolContext): void {
  registerSceneTools(ctx);
  registerMaterialTools(ctx);
  registerLightingTools(ctx);
  registerRenderingTools(ctx);
  registerGeometryTools(ctx);
  registerPerformanceTools(ctx);
  registerDebugTools(ctx);
  registerCaptureTools(ctx);
  registerCodeTools(ctx);
  registerConnectionTools(ctx);
}
