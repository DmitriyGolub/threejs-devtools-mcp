/** Reusable zod fragments for tool input schemas */
import { z } from 'zod';

export const vec3 = (what = '[x, y, z]') => z.array(z.number()).length(3).optional().describe(what);
export const vec2 = (what = '[x, y]') => z.array(z.number()).length(2).optional().describe(what);

/** Target an object/material/texture by name or uuid */
export const byName = (kind: string) => ({
  name: z.string().optional().describe(`${kind} name`),
  uuid: z.string().optional().describe(`${kind} UUID`),
});

export const scalar = z.union([z.string(), z.number(), z.boolean()]);

/** Anything a uniform / effect parameter can be set to from JSON */
export const paramValue = z.union([
  z.string(), z.number(), z.boolean(),
  z.array(z.number()),
  z.object({ x: z.number(), y: z.number(), z: z.number().optional(), w: z.number().optional() }),
]);

export const size = {
  width: z.number().optional().describe('Width in pixels (default: canvas width)'),
  height: z.number().optional().describe('Height in pixels (default: canvas height)'),
};
