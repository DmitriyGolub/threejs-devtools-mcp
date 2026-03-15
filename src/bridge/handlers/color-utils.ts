/**
 * Color conversion helpers shared between mutation and scene-env handlers.
 *
 * Input is sRGB (like CSS: #ff0000). Three.js Color stores linear internally.
 * `color.setStyle()` handles the sRGB→linear conversion automatically.
 */

/** Set a Three.js Color from a hex string or number. */
export function setColorFromHex(color: any, hex: unknown): void {
  if (typeof hex === 'string') color.setStyle(hex);
  else if (typeof hex === 'number') color.setHex(hex);
}

/**
 * Read a Three.js Color back as sRGB hex string.
 * Without SRGBColorSpace, getHexString returns linear values which look wrong.
 */
export function readColorHex(color: any): string {
  try { return '#' + color.getHexString('srgb'); }
  catch { return '#' + color.getHexString(); }
}
