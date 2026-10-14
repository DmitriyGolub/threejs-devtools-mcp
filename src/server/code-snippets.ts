/**
 * Turn change-journal entries (see src/bridge/changes.ts) into code the agent can
 * paste into the project — vanilla Three.js and React Three Fiber flavours.
 */

export interface ChangeTarget {
  kind: 'object' | 'light' | 'material' | 'camera' | 'fog' | 'renderer' | 'texture' | 'animation' | 'postprocessing';
  name: string;
  uuid?: string;
  type?: string;
  path?: string;
}

export interface Change {
  id: number;
  tool: string;
  target: ChangeTarget;
  key: string;
  before: unknown;
  after: unknown;
}

export type SnippetStyle = 'vanilla' | 'r3f' | 'both';

// ── THREE constant names ─────────────────────────────────

const CONSTANTS: Record<string, Record<string, string>> = {
  toneMapping: {
    0: 'NoToneMapping', 1: 'LinearToneMapping', 2: 'ReinhardToneMapping', 3: 'CineonToneMapping',
    4: 'ACESFilmicToneMapping', 5: 'CustomToneMapping', 6: 'AgXToneMapping', 7: 'NeutralToneMapping',
  },
  shadowMapType: { 0: 'BasicShadowMap', 1: 'PCFShadowMap', 2: 'PCFSoftShadowMap', 3: 'VSMShadowMap' },
  wrap: { 1000: 'RepeatWrapping', 1001: 'ClampToEdgeWrapping', 1002: 'MirroredRepeatWrapping' },
  filter: {
    1003: 'NearestFilter', 1004: 'NearestMipmapNearestFilter', 1005: 'NearestMipmapLinearFilter',
    1006: 'LinearFilter', 1007: 'LinearMipmapNearestFilter', 1008: 'LinearMipmapLinearFilter',
  },
  side: { 0: 'FrontSide', 1: 'BackSide', 2: 'DoubleSide' },
  colorSpace: { 'srgb': 'SRGBColorSpace', 'srgb-linear': 'LinearSRGBColorSpace', '': 'NoColorSpace' },
};

const CONSTANT_KEYS: Record<string, string> = {
  toneMapping: 'toneMapping', shadowMapType: 'shadowMapType', side: 'side',
  wrapS: 'wrap', wrapT: 'wrap', minFilter: 'filter', magFilter: 'filter',
  colorSpace: 'colorSpace', outputColorSpace: 'colorSpace',
};

/** R3F <Canvas shadows="..."> values per shadow map type */
const R3F_SHADOW_TYPES: Record<number, string> = { 0: '"basic"', 1: '"percentage"', 2: '"soft"', 3: '"variance"' };

// ── Literals ─────────────────────────────────────────────

const isColor = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

/** JS expression for a value; THREE constants are named when the key is known */
function js(value: unknown, key = ''): string {
  const constantGroup = CONSTANT_KEYS[key];
  const name = constantGroup && CONSTANTS[constantGroup][String(value)];
  if (name) return `THREE.${name}`;
  if (typeof value === 'string') return `'${value}'`;
  if (Array.isArray(value)) return `[${value.map(v => js(v)).join(', ')}]`;
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function args(value: unknown): string {
  return Array.isArray(value) ? value.map(v => js(v)).join(', ') : js(value);
}

/** JSX attribute: strings in quotes, everything else in braces */
function attr(name: string, value: unknown, key = name): string {
  if (value === true) return name;
  if (typeof value === 'string' && !CONSTANT_KEYS[key]) return `${name}="${value}"`;
  return `${name}={${js(value, key)}}`;
}

const jsxTag = (type = 'mesh') => type[0].toLowerCase() + type.slice(1);

function planesExpr(planes: unknown): string {
  if (!Array.isArray(planes)) return 'null';
  return `[${planes.map((p: any) =>
    `new THREE.Plane(new THREE.Vector3(${p.normal.join(', ')}), ${p.constant})`).join(', ')}]`;
}

// ── Per-kind variable and lookup line ────────────────────

/** How to get hold of the target in vanilla code — printed once per group */
export function lookup(t: ChangeTarget): string {
  const byName = (name: string) => `scene.getObjectByName('${name}')`;
  switch (t.kind) {
    case 'object':
    case 'light':
      return t.name ? `const obj = ${byName(t.name)};` : `// object ${t.uuid} has no name — give it one to find it in code`;
    case 'material': {
      const owner = t.path?.split('.').pop();
      return owner ? `const material = ${byName(owner)}.material;` : '// material: find where it is created';
    }
    case 'camera': return '// camera: where the camera is created';
    case 'fog': return '// scene.fog';
    case 'renderer': return '// where the renderer / <Canvas> is created';
    case 'texture': return `// texture "${t.name || t.uuid}": where it is loaded`;
    case 'animation': return `const action = mixer.clipAction(clip); // clip "${t.name}"`;
    case 'postprocessing': return `// pass ${t.type ?? t.name} in your EffectComposer`;
  }
}

// ── Vanilla ──────────────────────────────────────────────

function vanilla(c: Change): string {
  const { key, after: v, target: t } = c;
  const set = (expr: string) => (Array.isArray(v) ? `${expr}.set(${args(v)})` : `${expr} = ${js(v, key)}`);

  switch (c.tool) {
    case 'set_material_property':
      return isColor(v) ? `material.${key}.set('${v}');` : `material.${key} = ${js(v, key)}; material.needsUpdate = true;`;
    case 'set_uniform':
      if (isColor(v)) return `material.uniforms.${key}.value.set('${v}');`;
      if (v && typeof v === 'object') return `material.uniforms.${key}.value.set(${Object.values(v).join(', ')});`;
      return `material.uniforms.${key}.value = ${js(v)};`;
    case 'set_object_transform':
    case 'set_light':
    case 'set_instanced_mesh':
      return isColor(v) ? `obj.${key}.set('${v}');` : `${set(`obj.${key}`)};`;
    case 'set_shadow': {
      if (key === 'castShadow' || key === 'receiveShadow') return `obj.${key} = ${v};`;
      const cam = key.match(/^camera(\w+)$/);
      if (cam) return `obj.shadow.camera.${cam[1].toLowerCase()} = ${v}; obj.shadow.camera.updateProjectionMatrix();`;
      return `${set(`obj.shadow.${key}`)};`;
    }
    case 'set_camera':
      return `${set(`camera.${key}`)};${['position', 'rotation'].includes(key) ? '' : ' camera.updateProjectionMatrix();'}`;
    case 'set_fog':
      if (key === 'background') return `scene.background = new THREE.Color('${v}');`;
      return isColor(v) ? `scene.fog.color.set('${v}');` : `scene.fog.${key} = ${v};`;
    case 'set_renderer':
      if (key === 'pixelRatio') return `renderer.setPixelRatio(${v});`;
      if (key === 'shadowMapEnabled') return `renderer.shadowMap.enabled = ${v};`;
      if (key === 'shadowMapType') return `renderer.shadowMap.type = ${js(v, key)};`;
      return `renderer.${key} = ${js(v, key)};`;
    case 'set_layers':
      return `${t.kind === 'camera' ? 'camera' : 'obj'}.layers.mask = ${v};`;
    case 'set_morph_target':
      return `obj.${key} = ${v};`;
    case 'set_texture':
      return `${set(`texture.${key}`)}; texture.needsUpdate = true;`;
    case 'set_clipping': {
      const owner = t.kind === 'material' ? 'material' : 'renderer';
      return key === 'planes' ? `${owner}.clippingPlanes = ${planesExpr(v)};` : `${owner}.${key} = ${v};`;
    }
    case 'set_animation':
      if (key === 'timeScale') return `mixer.timeScale = ${v};`;
      if (key === 'playing') return v ? 'action.reset().fadeIn(0.3).play();' : 'action.fadeOut(0.3);';
      return `action.${({ actionWeight: 'weight', actionTimeScale: 'timeScale', actionPaused: 'paused' } as Record<string, string>)[key] ?? key} = ${v};`;
    case 'set_postprocessing': {
      const [group, name] = key.split('.');
      if (group === 'uniforms') return `pass.uniforms.${name}.value = ${js(v)};`;
      if (group === 'effectParams') return `effect.${name} = ${js(v)};`;
      return `pass.${key} = ${js(v)};`;
    }
  }
  return `// ${key} = ${js(v)}`;
}

// ── React Three Fiber ────────────────────────────────────

function r3f(c: Change): string {
  const { key, after: v, target: t } = c;
  const el = (props: string) => `<${jsxTag(t.type)}${t.name && t.kind !== 'material' ? ` name="${t.name}"` : ''} ${props} />`;

  switch (c.tool) {
    case 'set_material_property':
      return `<${jsxTag(t.type ?? 'meshStandardMaterial')} ${attr(key, v)} />`;
    case 'set_uniform':
      return `<${jsxTag(t.type ?? 'shaderMaterial')} uniforms-${key}-value={${isColor(v) ? `new THREE.Color('${v}')` : js(v)}} />`;
    case 'set_object_transform':
    case 'set_light':
    case 'set_instanced_mesh':
      return el(attr(key, v));
    case 'set_shadow': {
      if (key === 'castShadow' || key === 'receiveShadow') return el(attr(key, v));
      const cam = key.match(/^camera(\w+)$/);
      return el(attr(cam ? `shadow-camera-${cam[1].toLowerCase()}` : `shadow-${key}`, v, key));
    }
    case 'set_camera':
      return `<Canvas camera={{ ${key}: ${js(v)} }}>  // or <PerspectiveCamera makeDefault ${attr(key, v)} />`;
    case 'set_fog':
      if (key === 'background') return `<color attach="background" args={['${v}']} />`;
      return `<${t.type === 'FogExp2' ? 'fogExp2' : 'fog'} attach="fog" ${attr(key, v)} />`;
    case 'set_renderer':
      if (key === 'pixelRatio') return `<Canvas dpr={${v}}>`;
      if (key === 'shadowMapEnabled') return v ? '<Canvas shadows>' : '<Canvas shadows={false}>';
      if (key === 'shadowMapType') return `<Canvas shadows=${R3F_SHADOW_TYPES[v as number] ?? `{${v}}`}>`;
      return `<Canvas gl={{ ${key}: ${js(v, key)} }}>`;
    case 'set_layers':
      return t.kind === 'camera' ? `<Canvas camera={{ 'layers-mask': ${v} }}>` : el(`layers-mask={${v}}`);
    case 'set_morph_target':
      return el(`${key.replace(/\[(\d+)\]/, '-$1')}={${v}}`);
    case 'set_clipping':
      if (t.kind === 'material') {
        return `<${jsxTag(t.type ?? 'meshStandardMaterial')} ${key === 'planes' ? `clippingPlanes={${planesExpr(v)}}` : attr(key, v)} />`;
      }
      return key === 'planes'
        ? `<Canvas gl={{ localClippingEnabled: true }} onCreated={({ gl }) => { gl.clippingPlanes = ${planesExpr(v)}; }}>`
        : `<Canvas gl={{ ${key}: ${v} }}>`;
    case 'set_animation':
      if (key === 'playing') return v ? `actions['${t.name}']?.reset().fadeIn(0.3).play()` : `actions['${t.name}']?.fadeOut(0.3)`;
      if (key === 'timeScale') return `mixer.timeScale = ${v}  // from useAnimations()`;
      return `actions['${t.name}'].${({ actionWeight: 'weight', actionTimeScale: 'timeScale', actionPaused: 'paused' } as Record<string, string>)[key] ?? key} = ${v}`;
    case 'set_postprocessing': {
      const [group, name] = key.split('.');
      // @react-three/postprocessing effects take their params as props
      if (group === 'effectParams') return `<${(t.type ?? 'Effect').replace(/Effect$/, '')} ${attr(name, v)} />`;
      return `${vanilla(c)}  // no JSX equivalent`;
    }
  }
  return vanilla(c); // texture and others: same code in R3F (e.g. after useTexture)
}

// ── Formatting ───────────────────────────────────────────

function targetTitle(t: ChangeTarget): string {
  const label = t.kind[0].toUpperCase() + t.kind.slice(1);
  const name = t.name ? ` "${t.name}"` : '';
  const type = t.type ? ` (${t.type})` : '';
  const where = t.path ? ` — ${t.kind === 'material' ? 'used by' : 'at'} ${t.path}` : '';
  return `${label}${name}${type}${where}`;
}

const show = (v: unknown) => (v === undefined || v === null ? '—' : JSON.stringify(v));

/** Markdown report: changes grouped by target, each with before → after and code */
export function formatChanges(changes: Change[], style: SnippetStyle): string {
  if (changes.length === 0) {
    return 'No pending changes. Live-preview tools (set_*) record what they change here.';
  }

  const groups = new Map<string, Change[]>();
  for (const c of changes) {
    const id = `${c.target.kind}:${c.target.uuid ?? c.target.name}`;
    groups.set(id, [...(groups.get(id) ?? []), c]);
  }

  const out: string[] = [
    `# ${changes.length} pending change(s) — live preview only, not in code yet`,
    '',
    'To persist: find each target in the source (search by name / path below), apply the code, then call pending_changes with clear=true.',
  ];

  for (const group of groups.values()) {
    const t = group[0].target;
    out.push('', `## ${targetTitle(t)}`);
    if (style !== 'r3f') out.push('```js', lookup(t), ...group.map(vanilla), '```');
    if (style !== 'vanilla') out.push('```jsx', ...group.map(r3f), '```');
    out.push(...group.map(c => `- #${c.id} ${c.key}: ${show(c.before)} → ${show(c.after)}`));
  }

  return out.join('\n');
}
