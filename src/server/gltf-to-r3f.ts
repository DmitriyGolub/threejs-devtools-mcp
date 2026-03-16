/**
 * gltf_to_r3f — Server-side tool that converts a GLTF/GLB file to a React Three Fiber component.
 *
 * Parses the GLB/GLTF binary to extract the scene graph, then generates a JSX component
 * using @react-three/drei's useGLTF hook. Similar to gltfjsx but as an MCP tool.
 */
import { readFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

// ── GLB/GLTF binary parser ──────────────────────────────

interface GltfNode {
  name?: string;
  mesh?: number;
  skin?: number;
  camera?: number;
  children?: number[];
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  extras?: Record<string, unknown>;
}

interface GltfMesh {
  name?: string;
  primitives: Array<{
    attributes: Record<string, number>;
    material?: number;
    mode?: number;
    targets?: Array<Record<string, number>>;
  }>;
}

interface GltfMaterial {
  name?: string;
  pbrMetallicRoughness?: {
    baseColorFactor?: [number, number, number, number];
    metallicFactor?: number;
    roughnessFactor?: number;
    baseColorTexture?: { index: number };
    metallicRoughnessTexture?: { index: number };
  };
  normalTexture?: { index: number };
  occlusionTexture?: { index: number };
  emissiveTexture?: { index: number };
  emissiveFactor?: [number, number, number];
  alphaMode?: string;
  doubleSided?: boolean;
}

interface GltfAnimation {
  name?: string;
  channels: any[];
  samplers: any[];
}

interface GltfJson {
  scene?: number;
  scenes?: Array<{ nodes?: number[] }>;
  nodes?: GltfNode[];
  meshes?: GltfMesh[];
  materials?: GltfMaterial[];
  animations?: GltfAnimation[];
  skins?: any[];
  cameras?: any[];
}

async function parseGltfJson(filePath: string): Promise<GltfJson> {
  const buf = await readFile(filePath);
  const ext = extname(filePath).toLowerCase();

  if (ext === '.glb') {
    // GLB binary format: 12-byte header + chunks
    // Header: magic(4) + version(4) + length(4)
    // Chunk: length(4) + type(4) + data(length)
    const magic = buf.readUInt32LE(0);
    if (magic !== 0x46546C67) throw new Error('Not a valid GLB file (bad magic)');

    const chunkLength = buf.readUInt32LE(12);
    const chunkType = buf.readUInt32LE(16);
    if (chunkType !== 0x4E4F534A) throw new Error('First GLB chunk is not JSON');

    const jsonStr = buf.subarray(20, 20 + chunkLength).toString('utf8');
    return JSON.parse(jsonStr);
  } else {
    // .gltf is just JSON
    return JSON.parse(buf.toString('utf8'));
  }
}

// ── Component name generation ───────────────────────────

function toComponentName(filePath: string): string {
  const base = basename(filePath, extname(filePath));
  // PascalCase: "my-cool_model" → "MyCoolModel"
  return base
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
}

function sanitizeName(name: string): string {
  // Make a valid JS identifier from node name
  return name
    .replace(/[^a-zA-Z0-9_$]/g, '_')
    .replace(/^(\d)/, '_$1');
}

// ── JSX generation ──────────────────────────────────────

interface GenerateOptions {
  filePath: string;
  typescript: boolean;
  dreiImport: boolean;
  preload: boolean;
}

function generateComponent(gltf: GltfJson, opts: GenerateOptions): string {
  const componentName = toComponentName(opts.filePath);
  const ext = opts.typescript ? 'tsx' : 'jsx';
  const typeAnnotation = opts.typescript ? ': JSX.IntrinsicElements["group"]' : '';
  const hasAnimations = (gltf.animations?.length ?? 0) > 0;
  const hasSkins = (gltf.skins?.length ?? 0) > 0;

  // Collect unique names from nodes
  const nodeNames = new Map<number, string>();
  const usedNames = new Set<string>();

  if (gltf.nodes) {
    for (let i = 0; i < gltf.nodes.length; i++) {
      const node = gltf.nodes[i];
      let name = node?.name ? sanitizeName(node.name) : `node_${i}`;
      // Ensure uniqueness
      let candidate = name;
      let counter = 1;
      while (usedNames.has(candidate)) {
        candidate = `${name}_${counter++}`;
      }
      usedNames.add(candidate);
      nodeNames.set(i, candidate);
    }
  }

  // Collect material names
  const materialNames: string[] = [];
  if (gltf.materials) {
    for (const mat of gltf.materials) {
      materialNames.push(mat.name || 'unnamed');
    }
  }

  // Build the GLTF result type
  const gltfTypeParts: string[] = ['nodes: Record<string, THREE.Mesh>'];
  if (materialNames.length > 0) {
    gltfTypeParts.push('materials: Record<string, THREE.Material>');
  }

  // Determine what to destructure from useGLTF
  const destructured: string[] = ['nodes'];
  if (materialNames.length > 0) destructured.push('materials');
  if (hasAnimations) destructured.push('animations');

  // Build imports
  const lines: string[] = [];
  lines.push(`import { useRef } from 'react'`);
  lines.push(`import { useGLTF${hasAnimations ? ', useAnimations' : ''} } from '@react-three/drei'`);
  if (opts.typescript) {
    lines.push(`import * as THREE from 'three'`);
    if (hasAnimations) lines.push(`import type { GLTF } from 'three-stdlib'`);
  }

  // File path constant
  const modelPath = opts.filePath.replace(/\\/g, '/');
  lines.push('');
  lines.push(`const MODEL_PATH = '${modelPath}'`);

  // Type for GLTF result
  if (opts.typescript && hasAnimations) {
    lines.push('');
    lines.push(`type GLTFResult = GLTF & {`);
    lines.push(`  ${gltfTypeParts.join('; ')}`);
    lines.push(`}`);
  }

  // Component
  lines.push('');
  lines.push(`export function ${componentName}(props${typeAnnotation}) {`);

  // Refs
  lines.push(`  const groupRef = useRef${opts.typescript ? '<THREE.Group>' : ''}(null)`);

  // useGLTF
  const castSuffix = opts.typescript && hasAnimations ? ' as GLTFResult' : '';
  lines.push(`  const { ${destructured.join(', ')} } = useGLTF(MODEL_PATH)${castSuffix}`);

  // useAnimations
  if (hasAnimations) {
    lines.push(`  const { actions } = useAnimations(animations, groupRef)`);
  }

  // Build JSX tree
  lines.push('');
  lines.push('  return (');
  lines.push('    <group ref={groupRef} {...props} dispose={null}>');

  // Render scene graph
  const sceneIndex = gltf.scene ?? 0;
  const scene = gltf.scenes?.[sceneIndex];
  const rootNodes = scene?.nodes ?? [];

  for (const nodeIdx of rootNodes) {
    renderNode(gltf, nodeIdx, nodeNames, materialNames, lines, 6);
  }

  lines.push('    </group>');
  lines.push('  )');
  lines.push('}');

  // Preload
  if (opts.preload) {
    lines.push('');
    lines.push(`useGLTF.preload(MODEL_PATH)`);
  }

  return lines.join('\n') + '\n';
}

function renderNode(
  gltf: GltfJson,
  nodeIdx: number,
  nodeNames: Map<number, string>,
  materialNames: string[],
  lines: string[],
  indent: number,
): void {
  const node = gltf.nodes?.[nodeIdx];
  if (!node) return;

  const pad = ' '.repeat(indent);
  const name = nodeNames.get(nodeIdx) || `node_${nodeIdx}`;
  const children = node.children ?? [];
  const hasMesh = node.mesh !== undefined;
  const hasSkin = node.skin !== undefined;
  const mesh = hasMesh ? gltf.meshes?.[node.mesh!] : undefined;
  const meshName = node.name || name;

  // Build props
  const props: string[] = [];
  if (node.name) props.push(`name="${node.name}"`);

  // Transform props (only if non-default)
  if (node.translation && (node.translation[0] !== 0 || node.translation[1] !== 0 || node.translation[2] !== 0)) {
    props.push(`position={[${node.translation.join(', ')}]}`);
  }
  if (node.rotation && (node.rotation[0] !== 0 || node.rotation[1] !== 0 || node.rotation[2] !== 0 || node.rotation[3] !== 1)) {
    props.push(`quaternion={[${node.rotation.join(', ')}]}`);
  }
  if (node.scale && (node.scale[0] !== 1 || node.scale[1] !== 1 || node.scale[2] !== 1)) {
    props.push(`scale={[${node.scale.join(', ')}]}`);
  }

  if (hasMesh && mesh) {
    // Render each primitive
    const primitives = mesh.primitives || [];

    if (primitives.length === 1) {
      // Single primitive — render directly as mesh
      const prim = primitives[0];
      const matIdx = prim?.material;
      const matName = matIdx !== undefined ? materialNames[matIdx] : undefined;
      const hasMorphTargets = (prim?.targets?.length ?? 0) > 0;

      const tag = hasSkin ? 'skinnedMesh' : 'mesh';
      const geoProp = `geometry={nodes["${meshName}"]?.geometry}`;
      const matProp = matName ? ` material={materials["${matName}"]}` : '';
      const morphProp = hasMorphTargets ? ' morphTargetDictionary={nodes["' + meshName + '"]?.morphTargetDictionary} morphTargetInfluences={nodes["' + meshName + '"]?.morphTargetInfluences}' : '';
      const skeletonProp = hasSkin ? ` skeleton={nodes["${meshName}"]?.skeleton}` : '';

      if (children.length === 0) {
        lines.push(`${pad}<${tag} ${geoProp}${matProp}${morphProp}${skeletonProp} ${props.join(' ')} />`);
      } else {
        lines.push(`${pad}<${tag} ${geoProp}${matProp}${morphProp}${skeletonProp} ${props.join(' ')}>`);
        for (const childIdx of children) {
          renderNode(gltf, childIdx, nodeNames, materialNames, lines, indent + 2);
        }
        lines.push(`${pad}</${tag}>`);
      }
    } else {
      // Multiple primitives — wrap in group
      lines.push(`${pad}<group ${props.join(' ')}>`);
      for (let pi = 0; pi < primitives.length; pi++) {
        const prim = primitives[pi];
        const matIdx = prim?.material;
        const matName = matIdx !== undefined ? materialNames[matIdx] : undefined;
        const primName = `${meshName}_${pi}`;
        const tag = hasSkin ? 'skinnedMesh' : 'mesh';

        lines.push(`${pad}  <${tag} geometry={nodes["${primName}"]?.geometry}${matName ? ` material={materials["${matName}"]}` : ''} />`);
      }
      for (const childIdx of children) {
        renderNode(gltf, childIdx, nodeNames, materialNames, lines, indent + 2);
      }
      lines.push(`${pad}</group>`);
    }
  } else if (children.length > 0) {
    // Group node
    lines.push(`${pad}<group ${props.join(' ')}>`);
    for (const childIdx of children) {
      renderNode(gltf, childIdx, nodeNames, materialNames, lines, indent + 2);
    }
    lines.push(`${pad}</group>`);
  } else {
    // Empty node (bone, camera, etc.)
    lines.push(`${pad}<group ${props.join(' ')} />`);
  }
}

// ── Public API for tool registration ────────────────────

export async function gltfToR3f(params: {
  filePath: string;
  typescript?: boolean;
  preload?: boolean;
}): Promise<{ component: string; info: any }> {
  const filePath = resolve(params.filePath);
  const gltf = await parseGltfJson(filePath);

  const component = generateComponent(gltf, {
    filePath: params.filePath,
    typescript: params.typescript !== false,
    dreiImport: true,
    preload: params.preload !== false,
  });

  const info = {
    componentName: toComponentName(filePath),
    nodes: gltf.nodes?.length ?? 0,
    meshes: gltf.meshes?.length ?? 0,
    materials: gltf.materials?.length ?? 0,
    animations: gltf.animations?.length ?? 0,
    animationNames: gltf.animations?.map((a) => a.name || 'unnamed') ?? [],
    materialNames: gltf.materials?.map((m) => m.name || 'unnamed') ?? [],
    meshNames: gltf.meshes?.map((m) => m.name || 'unnamed') ?? [],
    hasSkins: (gltf.skins?.length ?? 0) > 0,
  };

  return { component, info };
}
