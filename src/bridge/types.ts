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

export interface ThreeContext {
  scene: any;
  renderer: any;
  camera: any;
  gl: any;
}

export type Handler = (ctx: ThreeContext, params: Record<string, unknown>) => unknown | Promise<unknown>;
