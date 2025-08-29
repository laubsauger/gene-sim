# Performance Refactoring TODO List - REVISED

After thorough analysis and reconsideration, here are the ACTUAL performance bottlenecks and valid improvements that maintain simulation fidelity.

## Understanding the Architecture

The system uses SharedArrayBuffers for zero-copy data sharing between WebWorker (simulation) and main thread (rendering). The worker writes directly to SABs, and Three.js reads from the same memory. This is already highly optimized.

## Real Performance Issues

### 1. **needsUpdate Always True - Wasted GPU Bandwidth** 🔴 HIGH PRIORITY
**Location:** `src/render/EntityPoints.tsx:134-138`
```javascript
posAttr.needsUpdate = true;  // Every frame!
colAttr.needsUpdate = true;  // Color rarely changes
aliveAttr.needsUpdate = true; // Only changes on birth/death
ageAttr.needsUpdate = true;  // Changes slowly
```
**Problem:** We're telling Three.js to re-upload ALL buffers to GPU every frame, even when data hasn't changed
**Solution:** Since we're using SharedArrayBuffers, the worker could set flags when data actually changes:
- Position: always needs update (entities move)
- Color: only on mutation events
- Alive: only on birth/death
- Age: could update every second instead of 60fps

**TODO:** Add dirty flags in SharedArrayBuffer to signal which attributes actually changed

### 2. **Transparent Rendering Without Alpha** 🔴 HIGH PRIORITY
**Location:** `src/render/EntityPoints.tsx:27`
```javascript
transparent: true,  // But fragment shader always outputs alpha=1.0!
```
**Problem:** Transparent materials trigger expensive alpha sorting in Three.js, but we're not using transparency
**Solution:** Set `transparent: false` since all entities are opaque
**Impact:** Avoids per-frame depth sorting of 100k+ points

### 3. **Food Texture Time Uniform Update** 🟡 MEDIUM PRIORITY
**Location:** `src/render/FoodTexture.tsx:90`
```javascript
materialRef.current.uniforms.time.value = state.clock.elapsedTime; // Every frame for subtle animation
```
**Problem:** Updating shader uniforms every frame for barely visible effect
**Solution:** Either remove the animation or update less frequently (every 10 frames)

### 4. **Stats UI Re-rendering Complex Tables** 🟡 MEDIUM PRIORITY
**Location:** `src/ui/StatsPanel.tsx:185-261`
- The entire tribe comparison table re-renders on every stats update (2Hz)
- Each row creates new JSX elements even for unchanged data
**Solution:** 
- Memoize individual tribe rows with React.memo
- Use keys properly to prevent re-mounting
- Consider virtual scrolling for many tribes

### 5. **Population Graph Full Redraw** 🟡 MEDIUM PRIORITY
**Location:** `src/ui/PopulationGraph.tsx:50-188`
```javascript
// Clear canvas with darker background
ctx.fillStyle = '#0a0a0a';
ctx.fillRect(0, 0, width, height); // Full clear every update
```
**Problem:** Entire graph redrawn from scratch every second
**Solution:** Use incremental drawing:
- Keep previous frame
- Shift pixels left for new time
- Draw only the new data point

### 6. **Unnecessary Frustum Culling Disabled** 🟢 LOW PRIORITY
**Location:** `src/render/EntityPoints.tsx:154`
```javascript
<points frustumCulled={false}>
```
**Problem:** Frustum culling disabled means all points processed even when off-screen
**Solution:** Enable frustum culling - Three.js can efficiently cull point clouds
**Note:** May not help much since we typically view the whole world

### 7. **Scene2D Grid Lines Recreation** 🟢 LOW PRIORITY
**Location:** `src/render/Scene2D.tsx:256-283`
- Grid lines are static but recreated in JSX on every render
**Solution:** Memoize the grid group or create once and reuse

## What's Already Optimized (Don't Touch)

1. **Shader calculations** - GPU parallel processing is faster than CPU-GPU transfer
2. **SharedArrayBuffer usage** - Zero-copy is optimal
3. **Stats frequency** - Already throttled to 2Hz (500ms)
4. **Food texture updates** - Already frame-skipped to 15fps
5. **Worker simulation** - Completely isolated from rendering

## Invalid Optimizations I Initially Suggested

❌ Moving age calculations from shader to CPU - Would increase data transfer
❌ Reducing buffer update frequency arbitrarily - SABs need consistent updates
❌ Changing data structures - Current layout is cache-friendly
❌ Worker message batching - Already minimal at 2Hz

## Implementation Priority

### Phase 1 - Quick Wins (1 hour)
- [ ] Remove `transparent: true` from EntityPoints material
- [ ] Remove or throttle food texture time animation
- [ ] Enable frustum culling on points

### Phase 2 - Smart Updates (2-4 hours)
- [ ] Implement dirty flags for buffer attributes
- [ ] Only update changed attributes to GPU
- [ ] Memoize React components properly

### Phase 3 - UI Optimizations (2-4 hours) 
- [ ] Incremental canvas drawing for graphs
- [ ] Virtual scrolling for large tribe lists
- [ ] Static geometry caching

## Expected Impact

Based on your performance logs showing 38ms frame time with 14k entities:

- **Removing transparency**: 10-20% reduction in GPU overhead
- **Dirty flag buffer updates**: 15-25% reduction in GPU bandwidth usage
- **UI optimizations**: Smoother interaction, less main thread blocking

**Realistic target: 25-40% overall performance improvement without touching simulation logic**

## Key Insight

The main bottleneck isn't the simulation (which is already well-optimized with spatial hashing, etc.) but rather the **rendering pipeline constantly re-uploading unchanged data** and **unnecessary GPU features enabled** (transparency, constant uniform updates).

The focus should be on:
1. Reducing GPU memory bandwidth usage
2. Eliminating unnecessary WebGL state changes
3. Optimizing React re-renders in the UI