/**
 * Test: skeleton/bone inspection.
 */
import { ok, toolOk } from './test-runner.mjs';

export async function testSkeletonDetails(client) {
  const resp = await client.callTool('skeleton_details');
  const data = toolOk('skeleton_details', resp);
  if (!data) return;

  ok('has skeletons', Array.isArray(data.skeletons), `${data.skeletons?.length || 0} skeletons`);

  if (data.skeletons.length === 0) {
    ok('no skeletons', true, 'scene has no SkinnedMesh');
    return;
  }

  const skel = data.skeletons[0];
  ok('has meshName', typeof skel.meshName === 'string', skel.meshName);
  ok('has boneCount', typeof skel.boneCount === 'number', `${skel.boneCount} bones`);
  ok('has bones', Array.isArray(skel.bones) && skel.bones.length > 0, `${skel.bones?.length} bones`);

  if (skel.bones.length > 0) {
    const bone = skel.bones[0];
    ok('bone has name', typeof bone.name === 'string', bone.name);
    ok('bone has position', Array.isArray(bone.position));
  }
}
