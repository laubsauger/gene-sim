# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

High-performance genetic simulation with 100k+ entities using React, Three.js, and WebWorkers. Simulates evolution through reproduction, mutation, and natural selection in a 2D environment.

## Core Stack

- **Build Tool**: Vite 7.1.2
- **Framework**: React 19.1.1 with TypeScript 5.8
- **3D Engine**: Three.js 0.179 + @react-three/fiber 9.3 + @react-three/drei 10.7
- **Package Manager**: Yarn 4.9.1
- **Simulation**: WebWorker with SharedArrayBuffer for zero-copy performance

## Development Commands

```bash
# Install dependencies
yarn

# Start dev server (http://localhost:5173)
yarn dev

# Build for production
yarn build

# Preview production build
yarn preview

# Type checking
yarn tsc --noEmit

# Linting
yarn lint
```

## Architecture

### Data Flow
1. **WebWorker** runs simulation at fixed 60Hz timestep
2. **SharedArrayBuffer** shares position/color/state data (zero-copy)
3. **React** renders via Three.js Points shader (GPU-optimized)
4. **Controls** send messages to worker for speed/pause

### Performance Strategy
- **Target**: 100,000+ entities at 60 FPS
- **Memory**: ~4MB for 100k entities using TypedArrays
- **Rendering**: Custom WebGL shader via THREE.Points (not InstancedMesh)
- **Simulation**: Spatial hashing for O(n) neighbor lookups
- **Determinism**: Seeded RNG (SFC32) for reproducible runs

### Directory Structure
```
/src
  /sim          # WebWorker simulation logic
    types.ts    # Shared type definitions
    random.ts   # Deterministic RNG
    genes.ts    # Genetic traits & mutations
    spatialHash.ts    # Spatial partitioning
    sim.worker.ts     # Main simulation loop
  /client       # Worker communication
    setupSimClient.ts # Worker wrapper
  /render       # 3D visualization
    EntityPoints.tsx  # GPU point renderer
    Scene2D.tsx       # Orthographic setup
  /ui           # Interface components
    Controls.tsx      # Speed/pause controls
    StatsPanel.tsx    # Live statistics
  App.tsx       # Main component
```

## Key Implementation Details

### SharedArrayBuffer Setup
- Requires COOP/COEP headers (configured in vite.config.ts)
- Browser must support SAB (check: `typeof SharedArrayBuffer !== 'undefined'`)
- Views: Float32Array (positions), Uint8Array (colors/alive), Uint16Array (tribeId)

### WebWorker Communication Protocol
```typescript
// Worker receives:
type WorkerMsg = 
  | { type: 'init', payload: SimInit }
  | { type: 'setSpeed', payload: { speedMul: number } }
  | { type: 'pause', payload: { paused: boolean } }

// Main thread receives:
type MainMsg =
  | { type: 'ready', payload: { sab: SharedArrayBuffers } }
  | { type: 'stats', payload: SimStats }
```

### Genetic System
- **Traits**: speed, vision, metabolism, reproChance, colorHue
- **Mutation**: ±5% variation with intensity parameter
- **Storage**: 4 floats per entity in compact array

### Rendering Pipeline
1. BufferGeometry with BufferAttributes wrapping SAB views
2. Mark `needsUpdate = true` each frame (GPU reads latest data)
3. Custom vertex/fragment shaders for point rendering
4. OrthographicCamera for 2D top-down view

## Critical Performance Notes

1. **Never copy arrays** - use SAB views directly
2. **Pre-allocate all memory** - no dynamic arrays in hot loops
3. **Fixed timestep** - accumulate dt, step in fixed increments
4. **Throttle stats** - update UI at 10Hz, not 60Hz
5. **Spatial hash** - rebuild each frame for moving entities
6. **Branchless math** - minimize conditionals in hot path

## Testing Approach

1. Start with 1,000 entities - verify basic behavior
2. Scale to 10,000 - monitor frame rate
3. Push to 100,000+ - identify bottlenecks
4. Test determinism - same seed should produce identical runs

## Browser Requirements

- SharedArrayBuffer support (Chrome 68+, Firefox 79+)
- Secure context (HTTPS or localhost)
- WebGL 2.0 for optimal performance

## Common Issues & Solutions

- **SAB not available**: Check COOP/COEP headers, use HTTPS
- **Low FPS at high entity count**: Reduce point size, throttle updates
- **Worker not responding**: Check message protocol, avoid blocking operations
- **Non-deterministic behavior**: Ensure all randomness uses seeded RNG
- server is running

## WebAssembly Integration

### CRITICAL: JS/WASM Synchronization

**⚠️ IMPORTANT**: The JavaScript and Rust/WASM code must stay synchronized for:
- **Gene count** (currently 9 genes per entity)
- **Gene indices** (speed=0, vision=1, metabolism=2, etc.)
- **Entity data layout** (positions, velocities, etc.)
- **World parameters** (width, height, cell size)

When modifying ANY of these, update BOTH:
- JavaScript: `src/sim/types.ts`, `src/sim/genes.ts`, `src/sim/sim.worker.ts`
- Rust: `wasm/src/lib.rs`, `wasm/src/movement.rs`, `wasm/src/types.rs`

### WASM Build Process

```bash
# Build WASM module
yarn build:wasm

# Build everything (WASM + TypeScript)
yarn build:all
```

### Gene System Constants

**Must be identical in JS and Rust:**
```
Index 0: speed (10-40 units/s)
Index 1: vision (20-100 units radius)
Index 2: metabolism (0.05-0.3)
Index 3: reproChance (0.01-0.1)
Index 4: aggression (0-1)
Index 5: cohesion (0-1)
Index 6: foodStandards (0-1)
Index 7: diet (-1 to 1, herbivore to carnivore)
Index 8: viewAngle (60-180 degrees)
```

### Data Layout (Structure of Arrays)

**Must match between JS TypedArrays and Rust Vec:**
- pos_x, pos_y: Float32Array / Vec<f32>
- vel_x, vel_y: Float32Array / Vec<f32>
- energy: Float32Array / Vec<f32>
- alive: Uint8Array / Vec<u8>
- tribe_id: Uint16Array / Vec<u16>
- genes: Float32Array / Vec<f32> (9 * entity_count)
- do not commit to github and do not set yourself as author in any commit messages