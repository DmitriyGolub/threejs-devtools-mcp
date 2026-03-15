// WebSocket protocol between MCP server and browser bridge

export interface BridgeRequest {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

export interface BridgeResponse {
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
}

// Serialized Three.js scene data

export interface SceneNode {
  uuid: string;
  name: string;
  type: string;
  visible: boolean;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  childCount: number;
  children?: SceneNode[];
  geometry?: {
    type: string;
    vertices: number;
    index: number;
  };
  material?: string | string[]; // uuid(s)
}

export interface MaterialInfo {
  uuid: string;
  name: string;
  type: string;
  visible: boolean;
  transparent: boolean;
  opacity: number;
  side: number;
  depthWrite: boolean;
  depthTest: boolean;
  blending: number;
  color?: string;
  emissive?: string;
  roughness?: number;
  metalness?: number;
  wireframe?: boolean;
  maps: string[]; // names of texture slots that are set (map, normalMap, etc.)
  uniforms?: Record<string, unknown>;
  customProgramCacheKey?: string;
  defines?: Record<string, unknown>;
}

export interface TextureInfo {
  uuid: string;
  name: string;
  width: number;
  height: number;
  format: number;
  type: number;
  wrapS: number;
  wrapT: number;
  minFilter: number;
  magFilter: number;
  colorSpace: string;
  sourceUrl?: string;
  flipY: boolean;
  generateMipmaps: boolean;
}

export interface RendererStats {
  render: {
    calls: number;
    triangles: number;
    points: number;
    lines: number;
    frame: number;
  };
  memory: {
    geometries: number;
    textures: number;
  };
  programs: number;
  canvas: {
    width: number;
    height: number;
  };
  pixelRatio: number;
  capabilities: {
    maxTextures: number;
    maxVertexTextures: number;
    maxTextureSize: number;
    maxCubemapSize: number;
    precision: string;
  };
}

export interface ShaderInfo {
  materialName: string;
  materialUuid: string;
  materialType: string;
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, { type: string; value: string }>;
  defines: Record<string, unknown>;
}
