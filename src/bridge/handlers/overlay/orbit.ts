/** Attach orbit controls + live rendering to a preview canvas. */

let _cleanup: (() => void) | null = null;

export function attachOrbit(
  r: any, scene: any, cam: any,
  center: { x: number; y: number; z: number }, radius: number,
): void {
  // Remove previous orbit listeners
  if (_cleanup) { _cleanup(); _cleanup = null; }

  const cv = r.domElement;
  let theta = 0.8, phi = 1.0, rad = radius;
  const minRad = radius * 0.1, maxRad = radius * 20;
  let dragging = false, lx = 0, ly = 0;

  function update() {
    cam.position.set(
      center.x + rad * Math.sin(phi) * Math.cos(theta),
      center.y + rad * Math.cos(phi),
      center.z + rad * Math.sin(phi) * Math.sin(theta));
    cam.lookAt(center.x, center.y, center.z);
    cam.far = Math.max(rad * 10, 1000);
    cam.updateProjectionMatrix();
    try { r.render(scene, cam); } catch { /* shader/WebGL error */ }
  }

  const onDown = (e: MouseEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; e.preventDefault(); };
  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    theta -= (e.clientX - lx) * 0.015;
    phi = Math.max(0.15, Math.min(2.95, phi + (e.clientY - ly) * 0.015));
    lx = e.clientX; ly = e.clientY; update();
  };
  const onUp = () => { dragging = false; };
  const onWheel = (e: WheelEvent) => {
    rad = Math.max(minRad, Math.min(maxRad, rad * (e.deltaY > 0 ? 1.15 : 0.87)));
    e.preventDefault(); update();
  };

  cv.addEventListener('mousedown', onDown);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  cv.addEventListener('wheel', onWheel, { passive: false });

  _cleanup = () => {
    cv.removeEventListener('mousedown', onDown);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    cv.removeEventListener('wheel', onWheel);
  };

  update();
}
