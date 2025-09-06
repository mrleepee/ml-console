/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PipelineType } from '@huggingface/transformers';

// Dynamic import to avoid bundling when unused
let hf: typeof import('@huggingface/transformers') | null = null;
let initialized = false;

async function ensureHF() {
  if (!hf) {
    hf = await import('@huggingface/transformers');
  }
  if (!initialized && hf) {
    const modelsDir = (window as any).__MODELS_DIR__ as string;
    const wasmDir = (window as any).__WASM_DIR__ as string;
    hf.env.allowRemoteModels = false;
    hf.env.localModelPath = modelsDir;
    hf.env.backends.onnx.wasm.wasmPaths = wasmDir;
    initialized = true;
  }
  return hf!;
}

export async function detectBackend(): Promise<'webgpu' | 'wasm'> {
  await ensureHF();
  // Prefer WebGPU; fall back to WASM
  const hasWebGPU = typeof (navigator as any).gpu !== 'undefined';
  return hasWebGPU ? 'webgpu' : 'wasm';
}

export async function getPipeline<T extends PipelineType>(type: T, model: string, options: any = {}) {
  const lib = await ensureHF();
  const backend = await detectBackend();
  const device = backend === 'webgpu' ? 'webgpu' : 'wasm';
  const pipeline = await lib.pipeline(type, model, { device, ...options });
  window.electronAPI?.llm.update?.({ backend, updatedAt: Date.now() });
  return pipeline as any;
}

export function getEnv() {
  return {
    modelsDir: (window as any).__MODELS_DIR__ as string,
    wasmDir: (window as any).__WASM_DIR__ as string,
  };
}


