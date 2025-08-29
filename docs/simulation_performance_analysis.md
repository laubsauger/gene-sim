# Simulation Performance Analysis

## Current Bottlenecks (68ms movement out of 76ms total)

### Primary Issues in spatialBehaviors.ts

1. **Multiple Spatial Hash Queries Per Entity**
   - Main neighbor search: up to 40 checks
   - Pack hunting check: up to 10 additional checks  
   - Conservation check: up to 15 additional checks
   - Best prey search: up to 40 additional checks
   - **Total: Up to 105 neighbor checks per entity!**

2. **Redundant Distance Calculations**
   - `Math.sqrt()` called multiple times for same pairs
   - Distance squared calculated, then sqrt, then squared again
   - View angle calculations using expensive `Math.atan2()`

3. **Memory Access Patterns**
   - Random access to genes array (cache misses)
   - Jumping between different typed arrays
   - Poor locality when checking neighbors

## Optimization Strategy (No Behavior Changes)

### Phase 1: Consolidate Neighbor Searches
- **Single pass neighbor collection** - gather all neighbor data once
- Cache neighbor information: distance, distSq, tribe, energy
- Reuse cached data for all behavior decisions

### Phase 2: Optimize Math Operations
- **Eliminate redundant sqrt()** - work with squared distances where possible
- **Pre-calculate view angle checks** - use dot product instead of atan2
- **Lookup tables** for common calculations

### Phase 3: Memory Optimization  
- **Pack related data** - improve cache locality
- **Pre-fetch gene data** before neighbor loop
- **Batch similar operations** together

## Expected Performance Gains

Based on profiling:
- Consolidating neighbor searches: **40-50% reduction** in movement time
- Math optimizations: **10-15% reduction**  
- Memory optimizations: **5-10% reduction**

**Target: Reduce movement from 68ms to ~30-35ms for 15k entities**

## Implementation Plan

### Step 1: Create Neighbor Cache Structure
```typescript
interface NeighborInfo {
  index: number;
  distSq: number;
  dx: number;
  dy: number;
  tribe: number;
  energy: number;
  isAlly: boolean;
  inViewAngle: boolean;
}
```

### Step 2: Single-Pass Neighbor Collection
- Collect ALL neighbors within vision once
- Store in reusable array
- Sort by distance if needed

### Step 3: Refactor Behavior Logic
- Use cached neighbor data
- Eliminate redundant calculations
- Maintain exact same behavior logic

## Critical Constraints

1. **Must maintain deterministic behavior** - same seed = same results
2. **No changes to behavior logic** - only optimize calculations
3. **No changes to gene effects** - all traits work identically
4. **No simplifications** - keep all complex interactions

## Specific Optimizations

### Current (Inefficient):
```typescript
// Multiple passes
grid.forNeighborsWithLimit(px, py, vision, 40, (j) => { /* main */ });
grid.forNeighborsWithLimit(px, py, vision, 10, (j) => { /* pack hunt */ });
grid.forNeighborsWithLimit(px, py, vision, 15, (j) => { /* conservation */ });
grid.forNeighborsWithLimit(px, py, huntVision, 40, (j) => { /* prey search */ });
```

### Optimized:
```typescript
// Single pass with caching
const neighbors: NeighborInfo[] = [];
grid.forNeighborsWithLimit(px, py, maxVision, 50, (j) => {
  // Calculate once, cache everything
  neighbors.push(cachedInfo);
});
// Reuse neighbors array for all logic
```

### Math Optimization Example:
```typescript
// Current: expensive angle calculation
const angleToTarget = Math.atan2(dy, dx);
let angleDiff = angleToTarget - myOrientation;

// Optimized: use dot product
const viewDirX = Math.cos(myOrientation);
const viewDirY = Math.sin(myOrientation);
const dot = (dx * viewDirX + dy * viewDirY) / dist;
const inView = dot > Math.cos(viewAngle / 2);
```