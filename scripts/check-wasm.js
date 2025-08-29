#!/usr/bin/env node

import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const wasmOutputPath = join(projectRoot, 'src', 'wasm', 'gene_sim_core_bg.wasm');

// Check if WASM files already exist
if (existsSync(wasmOutputPath)) {
  console.log('✅ WASM module already built');
  process.exit(0);
}

console.log('📦 WASM module not found, attempting to build...');

// Check if wasm-pack is installed
try {
  execSync('which wasm-pack', { stdio: 'ignore' });
} catch {
  console.log('⚠️  wasm-pack not installed, WASM acceleration will not be available');
  console.log('   To install: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh');
  process.exit(0); // Don't fail, just warn
}

// Try to build WASM
try {
  console.log('🔨 Building WASM module...');
  execSync('yarn build:wasm', { 
    cwd: projectRoot,
    stdio: 'inherit'
  });
  console.log('✅ WASM module built successfully');
} catch (error) {
  console.log('⚠️  WASM build failed, but the app will still work in JS mode');
  process.exit(0); // Don't fail, just warn
}