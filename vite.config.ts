import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Plugin to handle WASM files and provide fallback
function wasmPlugin(): Plugin {
  return {
    name: 'wasm-handler',
    configureServer() {
      // Check if WASM files exist on dev server start
      const wasmPath = path.join(__dirname, 'src/wasm/gene_sim_core_bg.wasm')
      if (!fs.existsSync(wasmPath)) {
        console.warn('\n⚠️  WASM files not found. Run "yarn build:wasm" to enable WASM acceleration.')
        console.warn('   The simulation will run in JavaScript-only mode.\n')
      }
    },
    transform(code, id) {
      // Handle missing WASM imports gracefully
      if (id.includes('sim.worker.wasm') && code.includes('../wasm/gene_sim_core')) {
        const wasmPath = path.join(__dirname, 'src/wasm/gene_sim_core.js')
        if (!fs.existsSync(wasmPath)) {
          // Return code that will fall back to JS mode
          return code.replace(
            /import.*from.*['"]\.\.\/wasm\/gene_sim_core['"].*/g,
            '// WASM import disabled - file not found'
          )
        }
      }
      return null
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), wasmPlugin()],
  base: process.env.NODE_ENV === 'production' ? '/gene-sim/' : '/',
  server: {
    headers: {
      // Required for SharedArrayBuffer support
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  worker: {
    format: 'es'
  },
  build: {
    target: 'esnext'
  },
  optimizeDeps: {
    exclude: ['gene_sim_core']
  }
})
