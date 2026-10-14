import type { Handler } from '../types.js';
import { collectTextures } from '../traversal.js';

/** 'webgpu' for WebGPURenderer on a WebGPU device, 'webgl' otherwise (incl. WebGPURenderer's WebGL2 fallback) */
export function rendererBackend(r: any): 'webgpu' | 'webgl' {
  if (r?.backend?.isWebGPUBackend) return 'webgpu';
  return 'webgl';
}

/** Draw calls for the last frame — WebGLRenderer reports `calls`, WebGPURenderer `drawCalls` */
export function drawCalls(r: any): number {
  return r.info?.render?.calls ?? r.info?.render?.drawCalls ?? 0;
}

export const rendererInfoHandler: Handler = (ctx) => {
  const r = ctx.renderer;
  const info = r.info;

  return {
    renderer: r.isWebGPURenderer ? 'WebGPURenderer' : 'WebGLRenderer',
    backend: rendererBackend(r),
    render: {
      calls: drawCalls(r), triangles: info.render?.triangles || 0,
      points: info.render?.points || 0, lines: info.render?.lines || 0,
      frame: info.render?.frame || 0,
    },
    memory: { geometries: info.memory?.geometries || 0, textures: info.memory?.textures || 0 },
    programs: info.programs?.length || 0,
    canvas: { width: r.domElement?.width || 0, height: r.domElement?.height || 0 },
    pixelRatio: r.getPixelRatio?.() || 1,
    capabilities: r.capabilities ? {
      maxTextures: r.capabilities.maxTextures || 0,
      maxVertexTextures: r.capabilities.maxVertexTextures || 0,
      maxTextureSize: r.capabilities.maxTextureSize || 0,
      maxCubemapSize: r.capabilities.maxCubemapSize || 0,
      precision: r.capabilities.precision || '',
    } : undefined,
    outputColorSpace: r.outputColorSpace || '',
    toneMapping: r.toneMapping || 0,
    shadowMap: { enabled: r.shadowMap?.enabled || false, type: r.shadowMap?.type || 0 },
  };
};

// ── web_audit ────────────────────────────────────────────

type Severity = 'high' | 'medium' | 'low';
interface Finding { severity: Severity; area: string; issue: string; fix: string }

/** Count renderer.render() calls over a short window to see whether the page renders while idle */
function sampleFrameRate(r: any, ms: number): Promise<number> {
  const start = r.info?.render?.frame ?? 0;
  return new Promise(resolve => setTimeout(() => {
    resolve(Math.round(((r.info?.render?.frame ?? 0) - start) * 1000 / ms));
  }, ms));
}

/**
 * Website-oriented checks: things that make a Three.js page blurry, slow,
 * battery-hungry or heavy to download. Each finding carries a concrete fix.
 */
export const webAuditHandler: Handler = async (ctx) => {
  const r = ctx.renderer;
  const canvas = r.domElement as HTMLCanvasElement;
  const findings: Finding[] = [];
  const add = (severity: Severity, area: string, issue: string, fix: string) =>
    findings.push({ severity, area, issue, fix });

  // Pixel ratio
  const dpr = window.devicePixelRatio || 1;
  const pixelRatio = r.getPixelRatio?.() || 1;
  if (pixelRatio > 2) {
    add('high', 'pixelRatio', `Pixel ratio ${pixelRatio} renders ${(pixelRatio ** 2 / 4).toFixed(1)}× the pixels of a 2× cap`,
      'renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))  // R3F: <Canvas dpr={[1, 2]}>');
  } else if (pixelRatio < Math.min(dpr, 2)) {
    add('medium', 'pixelRatio', `Pixel ratio ${pixelRatio} on a ${dpr}× screen — scene looks blurry`,
      'renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))');
  }

  // Canvas size vs layout size (missing resize handling)
  const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
  const expectedW = Math.floor(cssW * pixelRatio), expectedH = Math.floor(cssH * pixelRatio);
  if (cssW > 0 && (Math.abs(canvas.width - expectedW) > 2 || Math.abs(canvas.height - expectedH) > 2)) {
    add('high', 'resize', `Canvas buffer ${canvas.width}×${canvas.height} does not match layout ${cssW}×${cssH} at ${pixelRatio}× — stretched or blurry`,
      'On resize: renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix()  (R3F handles this automatically)');
  }

  // Context attributes (WebGL only)
  const attrs = rendererBackend(r) === 'webgl' ? r.getContext?.()?.getContextAttributes?.() : null;
  if (attrs) {
    if (attrs.antialias && pixelRatio >= 2) {
      add('low', 'antialias', 'MSAA is on at ≥2× pixel ratio, where it adds cost with little visible gain',
        'new WebGLRenderer({ antialias: window.devicePixelRatio < 2 })');
    }
    if (attrs.preserveDrawingBuffer) {
      add('medium', 'context', 'preserveDrawingBuffer: true disables a GPU fast path on every frame',
        'Remove it; capture screenshots right after render() instead');
    }
    if (attrs.powerPreference !== 'high-performance') {
      add('low', 'context', `powerPreference is "${attrs.powerPreference}" — laptops may use the integrated GPU`,
        "new WebGLRenderer({ powerPreference: 'high-performance' })  — only for heavy scenes");
    }
  }

  // Idle rendering & offscreen canvas
  const fps = await sampleFrameRate(r, 1000);
  const rect = canvas.getBoundingClientRect();
  const offscreen = rect.bottom < 0 || rect.top > window.innerHeight || rect.width === 0;
  if (offscreen && fps > 0) {
    add('high', 'render loop', `Canvas is off-screen but still renders ~${fps} fps`,
      'Pause the loop with an IntersectionObserver (R3F: frameloop="demand" + invalidate(), or toggle frameloop="never")');
  } else if (fps >= 50) {
    add('low', 'render loop', `Renders every frame (~${fps} fps). Fine for animated scenes; for mostly static ones it drains battery`,
      'Render on change: R3F <Canvas frameloop="demand"> + invalidate(); vanilla: call render() from controls "change" events');
  }

  // Textures: size and compression
  const textures = [...collectTextures(ctx.scene).values()];
  const maxSize = r.capabilities?.maxTextureSize || 4096;
  let uncompressedBytes = 0;
  const large: string[] = [];
  for (const tex of textures) {
    const img = tex.image;
    const w = img?.width || 0, h = img?.height || 0;
    if (!tex.isCompressedTexture) uncompressedBytes += w * h * 4 * (tex.generateMipmaps ? 1.33 : 1);
    if (Math.max(w, h) > 2048) large.push(`${tex.name || tex.uuid.slice(0, 8)} (${w}×${h})`);
  }
  if (large.length > 0) {
    add('medium', 'textures', `${large.length} texture(s) larger than 2048px: ${large.slice(0, 5).join(', ')}${large.length > 5 ? '…' : ''} (device max ${maxSize})`,
      'Downscale to 2048 or less for the web; mobile GPUs often cap at 4096');
  }
  const compressed = textures.filter(t => t.isCompressedTexture).length;
  if (uncompressedBytes > 64 * 1024 * 1024 && compressed === 0) {
    add('medium', 'textures', `~${Math.round(uncompressedBytes / 1048576)} MB of uncompressed texture VRAM`,
      'Ship KTX2/Basis textures (KTX2Loader) — ~4-8× less VRAM, faster upload');
  }

  // Shadows
  let bigShadowMaps = 0, shadowLights = 0;
  ctx.scene.traverse((obj: any) => {
    if (obj.isLight && obj.castShadow) {
      shadowLights++;
      if ((obj.shadow?.mapSize?.x || 0) > 2048) bigShadowMaps++;
    }
  });
  if (shadowLights > 2) {
    add('medium', 'shadows', `${shadowLights} shadow-casting lights — each one re-renders the scene`,
      'Keep one shadow-casting light; bake the rest (AccumulativeShadows / baked lightmaps)');
  }
  if (bigShadowMaps > 0) {
    add('low', 'shadows', `${bigShadowMaps} shadow map(s) above 2048px`, 'shadow.mapSize.set(1024, 1024) is usually enough on the web');
  }

  // Color management
  if (r.outputColorSpace && r.outputColorSpace !== 'srgb') {
    add('medium', 'color', `outputColorSpace is "${r.outputColorSpace}" — colors look washed out or too dark`,
      "renderer.outputColorSpace = THREE.SRGBColorSpace  (default since r152)");
  }

  // Draw calls
  const calls = drawCalls(r);
  if (calls > 300) {
    add('high', 'draw calls', `${calls} draw calls per frame — too many for mid-range phones`,
      'Merge static meshes, use InstancedMesh/BatchedMesh, share materials; see draw_call_breakdown');
  } else if (calls > 100) {
    add('low', 'draw calls', `${calls} draw calls per frame`, 'Fine on desktop; check draw_call_breakdown for easy merges');
  }

  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    backend: rendererBackend(r),
    viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: dpr },
    canvas: { buffer: [canvas.width, canvas.height], css: [cssW, cssH], pixelRatio, visible: !offscreen },
    idleFps: fps,
    drawCalls: calls,
    textures: { count: textures.length, compressed },
    findings,
    ...(findings.length === 0 ? { summary: 'No website-specific issues found.' } : {}),
  };
};
