/** Every material property that can hold a texture (incl. MeshPhysicalMaterial maps) */
export const MAP_SLOTS = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap',
  'emissiveMap', 'displacementMap', 'alphaMap', 'envMap', 'lightMap',
  'bumpMap', 'specularMap', 'gradientMap', 'matcap',
  'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap',
  'transmissionMap', 'thicknessMap', 'sheenColorMap', 'sheenRoughnessMap',
  'iridescenceMap', 'iridescenceThicknessMap', 'anisotropyMap',
  'specularIntensityMap', 'specularColorMap',
];

export function collectMaterials(scene: any): Map<string, any> {
  const materials = new Map<string, any>();
  scene.traverse((obj: any) => {
    if (!obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!materials.has(mat.uuid)) materials.set(mat.uuid, mat);
    }
  });
  return materials;
}

export function collectTextures(scene: any): Map<string, any> {
  const textures = new Map<string, any>();
  const materials = collectMaterials(scene);

  for (const mat of materials.values()) {
    for (const slot of MAP_SLOTS) {
      const tex = mat[slot];
      if (tex && !textures.has(tex.uuid)) textures.set(tex.uuid, tex);
    }
    if (mat.uniforms) {
      for (const u of Object.values(mat.uniforms)) {
        const tex = (u as any).value;
        if (tex?.isTexture && !textures.has(tex.uuid)) textures.set(tex.uuid, tex);
      }
    }
  }
  return textures;
}

export function findObjectByName(scene: any, name: string): any {
  let found: any = null;
  scene.traverse((obj: any) => { if (!found && obj.name === name) found = obj; });
  return found;
}

export function findObjectByUuid(scene: any, uuid: string): any {
  let found: any = null;
  scene.traverse((obj: any) => { if (!found && obj.uuid === uuid) found = obj; });
  return found;
}

export function findObjectByPath(scene: any, dotPath: string): any {
  const parts = dotPath.split('.');
  let current = scene;
  let startIdx = (parts[0] === scene.name || parts[0] === 'Scene') ? 1 : 0;
  for (let i = startIdx; i < parts.length; i++) {
    if (!current.children) return null;
    const child = current.children.find((c: any) => c.name === parts[i]);
    if (!child) return null;
    current = child;
  }
  return current;
}

export function findMaterial(scene: any, name?: string, uuid?: string): any {
  const materials = collectMaterials(scene);
  if (uuid) return materials.get(uuid) || null;
  if (name) {
    for (const mat of materials.values()) {
      if (mat.name === name) return mat;
    }
  }
  return null;
}

export function findTexture(scene: any, name?: string, uuid?: string): any {
  for (const tex of collectTextures(scene).values()) {
    if ((uuid && tex.uuid === uuid) || (name && tex.name === name)) return tex;
  }
  return null;
}

/** Dot path from the scene root, e.g. "Scene.Car.Body" — used to locate objects in source code */
export function objectPath(obj: any): string {
  const parts: string[] = [];
  for (let o = obj; o; o = o.parent) parts.unshift(o.name || o.type);
  return parts.join('.');
}

/** First object in the scene that uses this material */
export function findMaterialOwner(scene: any, mat: any): any {
  let owner: any = null;
  scene.traverse((obj: any) => {
    if (owner || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    if (mats.includes(mat)) owner = obj;
  });
  return owner;
}
