export function serializeVector3(v: any): [number, number, number] {
  return [
    Math.round(v.x * 1000) / 1000,
    Math.round(v.y * 1000) / 1000,
    Math.round(v.z * 1000) / 1000,
  ];
}

export function serializeEuler(e: any): [number, number, number] {
  return [
    Math.round(e.x * 1000) / 1000,
    Math.round(e.y * 1000) / 1000,
    Math.round(e.z * 1000) / 1000,
  ];
}
