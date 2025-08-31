// WASM module loader and wrapper
import type { SimCore, BiomeCollisionMap } from '../../wasm/pkg/gene_sim_core';

export interface WasmModule {
  SimCore: typeof SimCore;
  BiomeCollisionMap: typeof BiomeCollisionMap;
  memory: WebAssembly.Memory;
}

let wasmModule: WasmModule | null = null;
let loadPromise: Promise<WasmModule> | null = null;

/**
 * Load the WASM module (singleton pattern to avoid multiple loads)
 */
export async function loadWasmModule(): Promise<WasmModule> {
  // Return existing module if already loaded
  if (wasmModule) {
    return wasmModule;
  }
  
  // Return existing promise if currently loading
  if (loadPromise) {
    return loadPromise;
  }
  
  // Start loading
  loadPromise = loadWasmModuleInternal();
  return loadPromise;
}

async function loadWasmModuleInternal(): Promise<WasmModule> {
  try {
    console.log('[WASM] Loading module...');
    
    // Try dynamic import of the WASM module
    // This will fail gracefully if the files don't exist
    const wasm = await import('../../wasm/pkg/gene_sim_core.js').catch(() => {
      console.warn('[WASM] Module files not found, WASM may not be built');
      return null;
    });
    
    if (!wasm) {
      throw new Error('WASM module not available - files not built');
    }
    
    // Initialize the WASM module
    await wasm.default();
    
    // Get the memory object (may not exist if not exported)
    const memory = (wasm as any).memory || new WebAssembly.Memory({ initial: 256, maximum: 16384 });
    
    console.log('[WASM] Module loaded successfully');
    
    wasmModule = {
      SimCore: wasm.SimCore,
      BiomeCollisionMap: wasm.BiomeCollisionMap,
      memory,
    };
    
    return wasmModule;
  } catch (error) {
    console.error('[WASM] Failed to load module:', error);
    console.log('[WASM] Simulation will fall back to JavaScript implementation');
    loadPromise = null; // Reset so we can retry
    throw error;
  }
}

/**
 * Check if WASM is supported in the current environment
 */
export function isWasmSupported(): boolean {
  try {
    // Check for WebAssembly support
    if (typeof WebAssembly === 'undefined') {
      return false;
    }
    
    // Check for SharedArrayBuffer support (required for our architecture)
    if (typeof SharedArrayBuffer === 'undefined') {
      return false;
    }
    
    // Try to compile a minimal WASM module
    const testModule = new WebAssembly.Module(
      new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])
    );
    
    return testModule !== null;
  } catch {
    return false;
  }
}

/**
 * Check if WASM module is built and available
 */
export async function isWasmAvailable(): Promise<boolean> {
  if (!isWasmSupported()) {
    return false;
  }
  
  try {
    // Try to check if the module exists without actually loading it
    const response = await fetch(new URL('../../wasm/pkg/gene_sim_core_bg.wasm', import.meta.url).href, {
      method: 'HEAD'
    }).catch(() => null);
    
    return response?.ok === true;
  } catch {
    return false;
  }
}

/**
 * Create typed array views into WASM memory
 */
export function createWasmMemoryViews(memory: WebAssembly.Memory, offset: number, count: number) {
  const buffer = memory.buffer;
  const floatSize = Float32Array.BYTES_PER_ELEMENT;
  const byteSize = Uint8Array.BYTES_PER_ELEMENT;
  const shortSize = Uint16Array.BYTES_PER_ELEMENT;
  
  return {
    posX: new Float32Array(buffer, offset, count),
    posY: new Float32Array(buffer, offset + count * floatSize, count),
    velX: new Float32Array(buffer, offset + count * floatSize * 2, count),
    velY: new Float32Array(buffer, offset + count * floatSize * 3, count),
    energy: new Float32Array(buffer, offset + count * floatSize * 4, count),
    alive: new Uint8Array(buffer, offset + count * floatSize * 5, count),
    tribeId: new Uint16Array(buffer, offset + count * floatSize * 5 + count * byteSize, count),
    genes: new Float32Array(buffer, offset + count * floatSize * 5 + count * byteSize + count * shortSize, count * 9),
  };
}