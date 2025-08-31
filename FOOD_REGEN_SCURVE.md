# S-Curve Food Regeneration System

## Overview
Implemented sigmoid (S-curve) regeneration to replace linear growth, providing more realistic food recovery patterns.

## Key Features

### 1. S-Curve Growth Pattern
- **Slow start**: When food is depleted (0-15%), growth is slow
- **Acceleration**: Peak growth occurs around 35% capacity
- **Tapering**: Growth slows as approaching full capacity (80-100%)

### 2. Parameters
```javascript
k = 4        // Steepness factor (wider growth band)
x0 = 0.35    // Midpoint at 35% capacity
baseline = 15% // Minimum growth rate to prevent stagnation
```

### 3. Cooldown System
- Applies when food < 2% of capacity
- Duration: 0.3 seconds (scaled by regen rate)
- Allows small recovery during cooldown

### 4. Biome-Specific Rates
- **Forest**: 1.2x faster regeneration
- **Grassland**: 1.0x (baseline)
- **Savanna**: 0.8x slower
- **Desert**: 0.5x much slower

## Benefits

1. **Prevents Runaway Growth**: High capacity areas don't regenerate too quickly
2. **Supports Recovery**: Low capacity areas can still recover from depletion
3. **Natural Patterns**: Creates realistic ebb and flow of resources
4. **Balanced Gameplay**: Prevents both starvation and overabundance

## Growth Profile

```
Capacity | Growth Rate
---------|------------
0-10%    | Slow (cooldown + low curve)
10-25%   | Increasing
25-45%   | Peak growth
45-70%   | Decreasing
70-90%   | Slowing
90-100%  | Very slow
```

## Tuning
- Adjust `k` for sharper/softer transitions
- Adjust `x0` to move the peak growth point
- Adjust `baseline` to change minimum growth rate
- Cooldown threshold/duration affects recovery delay