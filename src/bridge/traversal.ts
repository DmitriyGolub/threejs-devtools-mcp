const MAP_SLOTS = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap',
  'emissiveMap', 'displacementMap', 'alphaMap', 'envMap', 'lightMap',
  'bumpMap', 'specularMap', 'gradientMap',
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
