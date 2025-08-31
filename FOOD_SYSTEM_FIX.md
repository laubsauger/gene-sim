# Food System Fixes - Summary

## Issues Fixed

### 1. Boundary Overlay Alignment
- **Problem**: Boundary lines were misaligned with traversable/non-traversable edges
- **Solution**: Removed inset offset and positioned lines exactly at cell boundaries
- Lines now 8px thick (down from 12px) and fully opaque

### 2. Biome Regen Multipliers Not Applied
- **Problem**: Food regeneration ignored biome-specific multipliers (forest should be 1.2x faster, desert 0.5x slower)
- **Solution**: Added `foodBiomeRegenRate` array to store per-cell multipliers, applied during regen calculation

### 3. Floating Point Precision Issues
- **Problem**: Small food values (0-7 range) caused precision issues with small regen increments
- **Solution**: Scaled food capacity from 7 to 100 (10x increase) for better precision
- This allows finer increments without rounding to zero

### 4. Incorrect Default Values
- **Problem**: Food scarcity defaulted to 0.55 (too scarce), regen formula was complex
- **Solution**: 
  - Scarcity now defaults to 0.25 (more abundant)
  - Regen rate 0.89 = ~1.1 seconds to full (forest faster, desert slower)

## New Food System Math

### Capacity by Biome (at default capacity=100)
- **Forest**: 150 max (1.5x multiplier)
- **Grassland**: 100 max (1.0x multiplier)  
- **Savanna**: 70 max (0.7x multiplier)
- **Desert**: 30 max (0.3x multiplier)
- **Ocean/Mountain**: 0 (non-traversable)

### Regeneration Times (at regen=0.89)
- **Forest**: ~0.94s to full (1.2x faster)
- **Grassland**: ~1.12s to full (baseline)
- **Savanna**: ~1.40s to full (0.8x speed)
- **Desert**: ~2.25s to full (0.5x speed)

### Formula
```
effectiveRegen = baseRegen * biomeRegenMultiplier
timeToFull = 1 / effectiveRegen (in seconds)
growthPerSecond = maxCapacity * effectiveRegen
```

## Testing
Run `node src/sim/core/foodSystemAnalysis.js` to see detailed analysis of regen rates and precision.