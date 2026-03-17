import type { Handler } from '../types.js';

export const sceneExportHandler: Handler = (ctx, params) => {
  const name = params.name as string | undefined;
  const uuid = params.uuid as string | undefined;
  const binary = params.binary !== false;

  // Find target
  let target = ctx.scene;
  if (name || uuid) {
    let found: any = null;
    ctx.scene.traverse((obj: any) => {
      if (!found && ((name && obj.name === name) || (uuid && obj.uuid === uuid))) found = obj;
    });
    if (!found) throw new Error(`Object "${name || uuid}" not found`);
    target = found;
  }

  // Find GLTFExporter
  const win = window as any;
  const ExporterClass = win.GLTFExporter
    || win.THREE?.GLTFExporter
    || win.__THREEJS_DEVTOOLS_GLTF_EXPORTER__;

  if (!ExporterClass) {
    throw new Error(
      'GLTFExporter not available. Add to your app:\n'
      + '  import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";\n'
      + '  window.GLTFExporter = GLTFExporter;'
    );
  }

  const exporter = new ExporterClass();

  return new Promise((resolve, reject) => {
    const options = { binary };

    const onDone = (result: any) => {
      if (result instanceof ArrayBuffer) {
        const bytes = new Uint8Array(result);
        let binaryStr = '';
        for (let i = 0; i < bytes.length; i += 8192) {
          binaryStr += String.fromCharCode(...bytes.subarray(i, i + 8192));
        }
        resolve({
          format: 'glb',
          base64: btoa(binaryStr),
          sizeBytes: result.byteLength,
          target: target.name || target.uuid,
        });
      } else {
        resolve({
          format: 'gltf',
          json: result,
          target: target.name || target.uuid,
        });
      }
    };

    const onError = (err: any) => reject(new Error(err?.message || 'GLTFExporter failed'));

    // Support both parse(obj, onDone, onError, options) and parseAsync(obj, options)
    if (typeof exporter.parseAsync === 'function') {
      exporter.parseAsync(target, options).then(onDone).catch(onError);
    } else {
      exporter.parse(target, onDone, onError, options);
    }
  });
};
