# WASM + Multi-Worker Implementation TODO

## Phase 1: WASM Core Module Setup

### Setup & Infrastructure
- [ ] Install Rust toolchain (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- [ ] Install wasm-pack (`curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh`)
- [ ] Create `/wasm` directory structure
- [ ] Set up Cargo.toml with wasm-bindgen dependencies
- [ ] Configure package.json scripts for WASM building
- [ ] Set up TypeScript types generation from Rust

### Core Data Structures (Rust)
- [ ] Define SimData struct with SoA layout for SIMD
- [ ] Implement SpatialHash in Rust (port from TypeScript)
- [ ] Create EntityView struct for zero-copy SAB access
- [ ] Define Gene struct with packed layout
- [ ] Implement movement result types

### Movement System (Priority: Critical)
- [ ] Port movement vector calculations to Rust
- [ ] Implement steering behaviors (separation, alignment, cohesion)
- [ ] Add food-seeking behavior
- [ ] Implement hunting/fleeing logic
- [ ] Add view cone calculations
- [ ] Optimize with SIMD intrinsics where possible
- [ ] Benchmark: Compare with JS implementation

### Spatial Hash (Priority: High)
- [ ] Port grid-based spatial hash to Rust
- [ ] Implement efficient rebuild method
- [ ] Add neighbor query with early exit
- [ ] Implement ghost zone awareness
- [ ] Add range query optimizations
- [ ] Test spatial hash correctness
- [ ] Benchmark: Grid rebuild and queries

### Physics Integration (Priority: Medium)
- [ ] Implement velocity clamping in Rust
- [ ] Add position integration
- [ ] Implement toroidal world wrapping
- [ ] Batch process physics updates
- [ ] Add collision detection helpers

### WASM Bindings
- [ ] Create wasm-bindgen interfaces
- [ ] Export SimCore class to JavaScript
- [ ] Add memory management utilities
- [ ] Implement SharedArrayBuffer views
- [ ] Create TypeScript declaration files
- [ ] Test WASM module loading

## Phase 2: Worker Pool Architecture

### Coordinator Worker
- [ ] Create `coordinator.worker.ts`
- [ ] Implement worker pool spawning
- [ ] Add worker lifecycle management
- [ ] Create message routing system
- [ ] Implement work distribution algorithm
- [ ] Add worker health monitoring
- [ ] Handle worker crashes/restarts

### Worker Communication
- [ ] Define message protocol types
- [ ] Implement SharedArrayBuffer allocation
- [ ] Create inter-worker message channels
- [ ] Add synchronization barriers
- [ ] Implement migration queue
- [ ] Add combat event queue
- [ ] Test message passing performance

### Entity Partitioning
- [ ] Implement spatial region division
- [ ] Create entity-to-worker assignment
- [ ] Add dynamic load balancing
- [ ] Implement entity migration logic
- [ ] Handle boundary entities
- [ ] Test partitioning efficiency

### Simulation Workers
- [ ] Create `sim.worker.wasm.ts` template
- [ ] Load WASM module per worker
- [ ] Implement local entity processing
- [ ] Add ghost zone management
- [ ] Handle incoming migrations
- [ ] Process combat events
- [ ] Sync with coordinator

## Phase 3: Ghost Zones & Synchronization

### Ghost Zone System
- [ ] Define ghost zone boundaries (100 units)
- [ ] Implement entity replication logic
- [ ] Create ghost entity updates
- [ ] Add read-only ghost cache
- [ ] Optimize ghost zone queries
- [ ] Test boundary interactions

### Cross-Worker Interactions
- [ ] Handle cross-boundary movement
- [ ] Implement distributed combat resolution
- [ ] Add cross-boundary reproduction
- [ ] Manage food consumption conflicts
- [ ] Resolve entity collisions
- [ ] Test interaction correctness

### Synchronization Protocol
- [ ] Implement frame synchronization
- [ ] Add barrier synchronization
- [ ] Create update phases (compute/sync/commit)
- [ ] Handle async worker operations
- [ ] Add deadlock detection
- [ ] Test synchronization performance

## Phase 4: Integration & Optimization

### Main Thread Integration
- [ ] Update SimClient to use coordinator
- [ ] Modify SharedArrayBuffer setup
- [ ] Update rendering to handle partitioned data
- [ ] Add worker pool status UI
- [ ] Implement graceful degradation
- [ ] Test full pipeline

### Performance Optimization
- [ ] Profile WASM hot paths
- [ ] Optimize memory access patterns
- [ ] Reduce inter-worker communication
- [ ] Implement batch updates
- [ ] Add frame skipping for slow devices
- [ ] Tune worker count based on cores

### Memory Management
- [ ] Implement WASM memory pooling
- [ ] Add SharedArrayBuffer recycling
- [ ] Optimize message passing size
- [ ] Reduce allocations in hot paths
- [ ] Monitor memory usage
- [ ] Add memory pressure handling

## Phase 5: Testing & Benchmarking

### Correctness Testing
- [ ] Port existing simulation tests
- [ ] Add WASM unit tests in Rust
- [ ] Test worker communication
- [ ] Verify determinism with seeds
- [ ] Test entity migration
- [ ] Validate ghost zone updates

### Performance Benchmarks
- [ ] Benchmark 10k entities (baseline)
- [ ] Benchmark 25k entities (WASM goal)
- [ ] Benchmark 50k entities (multi-worker goal)
- [ ] Benchmark 100k entities (stretch goal)
- [ ] Measure frame time distribution
- [ ] Profile memory usage

### Stress Testing
- [ ] Find maximum entity count
- [ ] Test worker failure recovery
- [ ] Measure sync overhead vs workers
- [ ] Test different partitioning strategies
- [ ] Benchmark on various devices
- [ ] Document performance limits

## Phase 6: Polish & Documentation

### Error Handling
- [ ] Add WASM panic handling
- [ ] Implement worker error recovery
- [ ] Add fallback to JS implementation
- [ ] Handle SharedArrayBuffer unavailable
- [ ] Add diagnostic logging
- [ ] Create error reporting

### Documentation
- [ ] Document WASM build process
- [ ] Create worker architecture guide
- [ ] Add performance tuning guide
- [ ] Document message protocols
- [ ] Create troubleshooting guide
- [ ] Add inline code documentation

### Developer Experience
- [ ] Add hot reload for WASM
- [ ] Create debug visualizations
- [ ] Add performance overlay
- [ ] Implement worker inspection tools
- [ ] Add automated benchmarks
- [ ] Create CI/CD pipeline

## Milestones & Success Criteria

### Milestone 1: WASM Movement (Week 1)
- Movement calculations 2.5x faster
- Single worker handles 25k entities at 60 FPS
- All tests passing

### Milestone 2: Worker Pool (Week 2)
- 4 workers running in parallel
- Entity partitioning working
- Inter-worker communication < 3ms

### Milestone 3: Full Integration (Week 3)
- Ghost zones functioning
- 50k entities at 60 FPS with 4 workers
- Deterministic simulation maintained

### Milestone 4: Optimization (Week 4)
- 100k entities at 60 FPS with 8 workers
- Memory usage < 100MB
- Graceful degradation working

## Implementation Order

1. **Start Here**: Set up Rust/WASM toolchain
2. Port movement calculations to Rust
3. Get single WASM worker running
4. Benchmark and validate improvements
5. Add worker pool management
6. Implement partitioning
7. Add ghost zones
8. Scale to 4+ workers
9. Optimize and tune
10. Document and polish

## Risk Mitigation

- **Risk**: WASM doesn't provide expected speedup
  - **Mitigation**: Focus on multi-worker approach instead

- **Risk**: Synchronization overhead too high
  - **Mitigation**: Increase partition size, reduce sync frequency

- **Risk**: Browser compatibility issues
  - **Mitigation**: Implement fallback paths

- **Risk**: Determinism broken
  - **Mitigation**: Extensive testing, fixed entity assignments

## Current Status

**Date Started**: 2024-12-30
**Current Phase**: Phase 2 - TypeScript Integration Complete
**Blockers**: Rust toolchain not installed on development machine
**Next Action**: Install Rust toolchain and build WASM module

## Completed Items

### Phase 1: WASM Core Module ✅
- [x] Create `/wasm` directory structure
- [x] Set up Cargo.toml with wasm-bindgen dependencies
- [x] Configure package.json scripts for WASM building
- [x] Define SimData struct with SoA layout for SIMD
- [x] Implement SpatialHash in Rust
- [x] Port movement calculations to Rust
- [x] Implement steering behaviors
- [x] Add hunting/fleeing logic
- [x] Implement physics integration
- [x] Create wasm-bindgen interfaces

### Phase 2: TypeScript Integration ✅
- [x] Create WASM loader module
- [x] Implement hybrid worker (WASM + JS fallback)
- [x] Create coordinator worker for multi-worker mode
- [x] Design message protocol types
- [x] Implement mode detection logic
- [x] Create UI mode selector component
- [x] Document JS/WASM synchronization requirements

## Next Steps

1. **Install Rust Toolchain**:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
rustup target add wasm32-unknown-unknown
```

2. **Build WASM Module**:
```bash
cd wasm
wasm-pack build --target web --out-dir pkg --release
```

3. **Test Integration**:
- Verify WASM module loads correctly
- Test single WASM worker mode
- Benchmark against JS implementation

4. **Complete Multi-Worker Implementation**:
- Finish entity partitioning logic
- Implement ghost zones
- Add cross-worker synchronization