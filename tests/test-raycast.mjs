/**
 * Test: raycasting.
 */
import { ok, toolOk } from './test-runner.mjs';

export async function testRaycast(client) {
  // Raycast from center of screen
  const resp = await client.callTool('raycast', {
    x: 0,
    y: 0,
  });
  const data = toolOk('raycast (center)', resp);
  if (!data) return;

  ok('has hits', Array.isArray(data.hits), `${data.hits?.length || 0} hits`);

  if (data.hits.length > 0) {
    const hit = data.hits[0];
    ok('hit has object', typeof hit.object === 'string' || typeof hit.objectUuid === 'string');
    ok('hit has distance', typeof hit.distance === 'number', `${hit.distance}`);
    ok('hit has point', Array.isArray(hit.point) && hit.point.length === 3,
      JSON.stringify(hit.point));
  }

  // Raycast from corner (likely hitting sky/nothing or ground)
  const cornerResp = await client.callTool('raycast', { x: -0.9, y: -0.9 });
  const cornerData = toolOk('raycast (corner)', cornerResp);
  if (cornerData) {
    ok('corner raycast works', Array.isArray(cornerData.hits));
  }
}
