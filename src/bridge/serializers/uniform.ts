export function serializeUniformValue(value: any): any {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return value;

  if (value.isColor) {
    try { return '#' + value.getHexString('srgb'); }
    catch { return '#' + value.getHexString(); }
  }
  if (value.isVector2) return { x: value.x, y: value.y };
  if (value.isVector3) return { x: value.x, y: value.y, z: value.z };
  if (value.isVector4) return { x: value.x, y: value.y, z: value.z, w: value.w };
  if (value.isMatrix3 || value.isMatrix4) return value.elements ? Array.from(value.elements) : '[Matrix]';
  if (value.isTexture) return `[Texture: ${value.name || value.uuid}]`;

  if (Array.isArray(value)) {
    if (value.length > 20) return `[Array(${value.length})]`;
    return value.map(serializeUniformValue);
  }

  return '[Object]';
}
