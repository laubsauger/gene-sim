# Hybrid WASM + Multi-Worker Architecture

## Overview

Combining WebAssembly for computational efficiency with multiple WebWorkers for parallelization to achieve 100k+ entities at 60 FPS.

## Architecture Design

### 1. Core Components

```
Main Thread (React/Three.js)
    ↓
Coordinator Worker (orchestrates simulation)
    ↓
Worker Pool (4-8 simulation workers)
    ↓
WASM Module (shared by all workers)
```

### 2. WASM Module (`sim_core`)

**Language**: Rust → WebAssembly
**Responsibilities**: Hot path computations

- Movement calculations (vector math, steering behaviors)
- Spatial hash operations (rebuild, queries)
- Physics integration (velocity, position updates)
- Distance calculations and collision detection

**Data Layout**: Structure of Arrays (SoA) for SIMD optimization

```rust
pub struct SimData {
    // Position components
    pos_x: Vec<f32>,
    pos_y: Vec<f32>,
    
    // Velocity components  
    vel_x: Vec<f32>,
    vel_y: Vec<f32>,
    
    // Entity properties
    energy: Vec<f32>,
    tribe_id: Vec<u16>,
    alive: Vec<u8>,
    
    // Genes packed for cache efficiency
    genes: Vec<f32>, // 9 floats per entity
}
```

### 3. Worker Pool Architecture

#### Coordinator Worker

- Manages worker pool lifecycle
- Distributes entities across workers
- Synchronizes cross-worker interactions
- Aggregates statistics

#### Simulation Workers (4-8 instances)

Each worker handles a partition of entities:

- Worker 0: entities 0-2999
- Worker 1: entities 3000-5999
- Worker 2: entities 6000-8999
- Worker 3: entities 9000-11999

**Per-Worker Data**:

- Local spatial hash for owned entities
- WASM instance for computations
- Ghost zone cache for boundary entities

### 4. Entity Partitioning Strategy

#### Spatial Partitioning

Divide world into regions, assign workers to regions:

```
+--------+--------+
|   W0   |   W1   |
+--------+--------+
|   W2   |   W3   |
+--------+--------+
```

**Advantages**:

- Better cache locality
- Reduced cross-worker communication
- Natural load balancing as entities migrate

**Ghost Zones**:

- Each worker maintains ~100 unit border overlap
- Entities in ghost zones are replicated (read-only)
- Updates propagated at end of frame

### 5. Inter-Worker Communication

#### Message Types

```typescript
type WorkerMessage = 
  | { type: 'entity_migration', from: number, to: number, entityData: EntityData }
  | { type: 'ghost_update', entities: GhostEntity[] }
  | { type: 'combat_event', attacker: number, victim: number, workerA: number, workerB: number }
  | { type: 'sync_complete', workerId: number, stats: LocalStats }
```

#### Synchronization Protocol

1. **Compute Phase** (parallel)
   - Each worker processes local entities
   - WASM functions handle heavy computation

2. **Communication Phase** (synchronized)
   - Exchange ghost zone updates
   - Handle entity migrations
   - Resolve cross-boundary interactions

3. **Commit Phase** (parallel)
   - Apply received updates
   - Update SharedArrayBuffers for rendering

### 6. WASM Interface

```rust
// Core WASM exports
#[wasm_bindgen]
pub struct SimCore {
    spatial_hash: SpatialHash,
    entity_data: SimData,
}

#[wasm_bindgen]
impl SimCore {
    // Batch process movement for entity range
    pub fn process_movement(
        &mut self,
        start_idx: usize,
        end_idx: usize,
        dt: f32
    ) -> MovementResult {
        // Vectorized movement calculations
        // Uses SIMD where available
    }
    
    // Rebuild spatial hash for entity range
    pub fn rebuild_spatial_hash(
        &mut self,
        start_idx: usize,
        end_idx: usize
    ) {
        // Optimized grid insertion
    }
    
    // Query neighbors with early exit
    pub fn query_neighbors(
        &self,
        x: f32,
        y: f32,
        radius: f32,
        max_results: usize
    ) -> Vec<u32> {
        // Fast neighbor lookup
    }
    
    // Batch physics integration
    pub fn integrate_physics(
        &mut self,
        start_idx: usize,
        end_idx: usize,
        dt: f32
    ) {
        // Position += velocity * dt
        // Handle world wrapping
    }
}
```

### 7. Memory Management

#### SharedArrayBuffer Layout

```
Main SAB (for rendering):
[positions][colors][alive] - Read by main thread, written by workers

Per-Worker SABs:
[local_entities][ghost_entities] - Worker-specific data

Sync SAB:
[migration_queue][combat_queue] - Inter-worker communication
```

#### WASM Memory

- Pre-allocated memory (64MB per worker)
- Zero-copy views into SharedArrayBuffers
- Memory recycling for temporary allocations

### 8. Implementation Phases

#### Phase 1: WASM Core (Week 1)

1. Set up Rust/wasm-pack toolchain
2. Port movement calculations to Rust
3. Port spatial hash to Rust
4. Create TypeScript bindings
5. Benchmark single-worker WASM vs JS

#### Phase 2: Worker Pool (Week 2)

1. Create coordinator worker
2. Implement worker pool management
3. Add entity partitioning logic
4. Set up SharedArrayBuffer communication
5. Test with 2 workers

#### Phase 3: Full Integration (Week 3)

1. Scale to 4-8 workers
2. Implement ghost zones
3. Add entity migration
4. Handle cross-boundary combat
5. Performance tuning

### 9. Expected Performance

#### Baseline (current JS, single worker)

- 12k entities: 29ms/frame (34 FPS)
- Bottleneck: Movement (23ms)

#### With WASM (single worker)

- Movement: 23ms → 8ms (2.8x speedup)
- Total: 29ms → 14ms (71 FPS)
- Can handle: ~25k entities at 60 FPS

#### With WASM + 4 Workers

- Per worker: 3k entities in 3.5ms
- Sync overhead: 2ms
- Total: ~5.5ms per frame (180 FPS)
- Can handle: ~100k entities at 60 FPS

#### With WASM + 8 Workers

- Per worker: 1.5k entities in 1.8ms
- Sync overhead: 3ms (more workers = more sync)
- Total: ~4.8ms per frame (200+ FPS)
- Can handle: ~150k entities at 60 FPS

### 10. Challenges & Solutions

#### Challenge: Cross-boundary interactions

**Solution**: Ghost zones with eventual consistency

#### Challenge: Load balancing

**Solution**: Dynamic region boundaries based on entity density

#### Challenge: Determinism

**Solution**: Fixed worker assignments by entity ID, synchronized RNG

#### Challenge: Memory overhead

**Solution**: Shared WASM module, SAB views

### 11. Development Tooling

#### Build Setup

```bash
# Install Rust and wasm-pack
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Build WASM module
cd wasm && wasm-pack build --target web
```

#### Performance Monitoring

- Per-worker timing breakdowns
- Inter-worker communication metrics
- Memory usage tracking
- Frame time histograms

### 12. Fallback Strategy

If browser doesn't support required features:

1. **Full support**: WASM + Multiple Workers + SAB
2. **No SAB**: WASM + Single Worker (postMessage)
3. **No WASM**: Multiple JS Workers
4. **Minimal**: Single JS Worker (current)

### 13. Testing Strategy

1. **Unit tests**: WASM functions in Rust
2. **Integration tests**: Worker communication
3. **Determinism tests**: Same seed = same results
4. **Performance benchmarks**: At 10k, 50k, 100k entities
5. **Stress tests**: Max entities before frame drops

## Next Steps

1. Create Rust project structure
2. Implement core WASM module
3. Set up worker pool infrastructure
4. Integrate and benchmark
