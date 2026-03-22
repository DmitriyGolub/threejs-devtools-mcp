import type { Handler } from '../types.js';
import { getThreeModule } from '../discovery/index.js';

export const clickInspectHandler: Handler = (ctx, params) => {
  const timeout = Math.min(Math.max((params.timeout as number) || 15, 1), 60);
  const canvas = ctx.renderer.domElement as HTMLCanvasElement;

  return new Promise((resolve, reject) => {
    const origCursor = canvas.style.cursor;
    canvas.style.cursor = 'crosshair';

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Click timeout — user did not click on the scene'));
    }, timeout * 1000);

    function cleanup() {
      clearTimeout(timer);
      canvas.removeEventListener('click', onClick, true);
      canvas.style.cursor = origCursor;
    }

    function onClick(event: MouseEvent) {
      event.stopPropagation();
      event.preventDefault();
      cleanup();

      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const ctors = getThreeModule();
      if (!ctors?.Raycaster || !ctors?.Vector2) {
        resolve({ hit: false, error: 'Raycaster not available' });
        return;
      }

      const raycaster = new ctors.Raycaster();
      const pointer = new ctors.Vector2(x, y);
      raycaster.setFromCamera(pointer, ctx.camera);

      const hits = raycaster.intersectObjects(ctx.scene.children, true);
      if (hits.length === 0) {
        resolve({ hit: false, ndc: { x: +x.toFixed(3), y: +y.toFixed(3) } });
        return;
      }

      const first = hits[0];
      const obj = first.object;
      const mat = obj.material;

      resolve({
        hit: true,
        object: {
          name: obj.name || '',
          uuid: obj.uuid,
          type: obj.type,
          position: [+obj.position.x.toFixed(3), +obj.position.y.toFixed(3), +obj.position.z.toFixed(3)],
          parent: obj.parent?.name || '',
          material: mat ? {
            name: mat.name || '',
            uuid: mat.uuid,
            type: mat.type,
            color: mat.color ? '#' + mat.color.getHexString() : undefined,
          } : null,
        },
        point: [+first.point.x.toFixed(3), +first.point.y.toFixed(3), +first.point.z.toFixed(3)],
        distance: +first.distance.toFixed(3),
        faceIndex: first.faceIndex,
        allHits: hits.slice(0, 5).map(h => ({
          name: h.object.name || h.object.uuid.slice(0, 8),
          type: h.object.type,
          distance: +h.distance.toFixed(3),
        })),
      });
    }

    canvas.addEventListener('click', onClick, { capture: true, once: true } as any);
  });
};
