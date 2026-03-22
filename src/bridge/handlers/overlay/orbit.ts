/** Attach orbit controls + live rendering to a preview canvas. */
export function attachOrbit(
  r: any, scene: any, cam: any,
  center: { x: number; y: number; z: number }, radius: number,
): void {
  const cv = r.domElement;
  let theta = 0.8, phi = 1.0, rad = radius;
  let dragging = false, lx = 0, ly = 0;

  function update() {
    cam.position.set(
      center.x + rad * Math.sin(phi) * Math.cos(theta),
      center.y + rad * Math.cos(phi),
      center.z + rad * Math.sin(phi) * Math.sin(theta));
    cam.lookAt(center.x, center.y, center.z);
    r.render(scene, cam);
  }

  cv.addEventListener('mousedown', (e: MouseEvent) => {
    dragging = true; lx = e.clientX; ly = e.clientY; e.preventDefault();
  });
  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!dragging) return;
    theta -= (e.clientX - lx) * 0.015;
    phi = Math.max(0.15, Math.min(2.95, phi + (e.clientY - ly) * 0.015));
    lx = e.clientX; ly = e.clientY; update();
  });
  document.addEventListener('mouseup', () => { dragging = false; });
  cv.addEventListener('wheel', (e: WheelEvent) => {
    rad *= e.deltaY > 0 ? 1.12 : 0.88; e.preventDefault(); update();
  }, { passive: false });

  update();
}
