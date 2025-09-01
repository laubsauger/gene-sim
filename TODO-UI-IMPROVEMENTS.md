# UI & 3D Scene Improvements Todo List

### 4c. Cinematic Zoom Animation Controls / Planet Target resp Camera target change animation

- [ ] Visual polish:
  - [ ] Consider adding motion blur post-process (optional)

### 5. Moon Visual Improvements

- [ ] Moon: Add normal map for surface detail (optional enhancement)

### 8. Bloom & Post-processing Effects

- [ ] Additional lighting effects:
  - [ ] HDR tone mapping adjustments
  - [ ] Exposure control for different viewing angles

### 9. Starfield/Skybox System

- [ ] improve milky way clustering (currently a not really visible). dont make it a too sharp edge though

### 10. Volumetric Lighting & Space Dust Effects

- [ ] Investigate efficient volumetric lighting simulation
  - [ ] Light shaft effects cast by planetary shadows
  - [ ] Space dust particles catching sunlight
  - [ ] Crepuscular rays around planet edges
- [ ] Implementation approaches to investigate:
  - [ ] **Screen-space volumetric scattering**
    - [ ] Post-process effect using depth buffer
    - [ ] Radial blur from sun position
    - [ ] Mask by planet depth/shadow
  - [ ] **Billboard quad technique**
    - [ ] Large transparent quads with gradient textures
    - [ ] Position between sun and camera
    - [ ] Mask with planet shadow map
    - [ ] Very efficient, good for mobile
  - [ ] **Hybrid approach**
    - [ ] Combine billboard cones for main shafts
    - [ ] Add particle dust for detail
    - [ ] Screen-space post-process for polish
- [ ] Performance considerations:
  - [ ] LOD system - reduce quality at distance
  - [ ] Toggle for low-end devices
  - [ ] Frame rate adaptive quality
  - [ ] Limit to specific viewing angles
- [ ] Visual targets:
  - [ ] Subtle god rays during eclipses
  - [ ] Dust motes visible in sunlight
  - [ ] Atmospheric light scattering
  - [ ] Shadow volume visualization

## Simulation Fixes

### 11. Food Regrowth System Fix

- [ ] Fix food regrowth to work in all areas (not just high-capacity zones)
  - [ ] BUG: Some sort of feedback effect happening where if set regen to below 1 everything starts to fade out. set to 1 we see high capaity grow stronger then stop, low capacity areas still dont regrow ever
  - [ ] Investigate current regrowth logic in foodSystem.ts
  - [ ] Ensure regrowth rate is based on rolled maximum capacity per cell
  - [ ] Each cell should regrow toward its own max capacity
  - [ ] Low-capacity areas should still get some regrowth
- [ ] Implementation approach:
  - [ ] Store max capacity per food cell (if not already)
  - [ ] Apply regrowth formula: `current += (maxCapacity - current) * regenRate * dt`
  - [ ] Ensure even cells with capacity of 1-2 can regrow
  - [ ] Test across different biome types with varying capacities
- [ ] Verify biome multipliers affect capacity but not regrowth prevention
- [ ] Improve debug visualization overlay to confirm regrowth in all areas and show potential for food / thepretica;l capacity ata given spot bsased on bionme in addition to current food distribution

### 14. Distance-Based Culling System

- [x] Implement efficient LOD/culling for distant objects - IF WERE NOT ALREADY DOING THAt. i cam see some saort of LOD happening lready so planet atmosphere is already disappearing at a certain zoom. not sure if thats the coorrect way so investigae bevfore duplicating / getting anything n3q
  - [ ] Core principle: Cull objects that would be < 1 pixel on screen
  - [ ] Calculate screen-space size based on:
    - [ ] Object world size
    - [ ] Distance from camera
    - [ ] Camera FOV and viewport dimensions
  - [ ] Apply to all scene elements:
    - [ ] Entities (already small, high priority for culling)
    - [ ] Clouds (transparent layer, expensive to render)
    - [ ] Atmosphere (transparent, can be culled at distance)
    - [ ] Planet surface details (textures can be reduced)
    - [ ] Moon (when very distant)
- [ ] Implementation approach:
  - [ ] Use THREE.LOD for multiple detail levels
  - [ ] Custom frustum culling with size threshold
  - [ ] visible = false when below pixel threshold
  - [ ] Consider bounding sphere checks for efficiency
- [ ] Performance targets:
  - [ ] Maintain 60 FPS at max zoom out
  - [ ] Simulation continues regardless of rendering
  - [ ] Smooth transitions when objects appear/disappear
  - [ ] No popping artifacts
- [ ] Specific thresholds:x
  - [ ] Entities: Cull when < 0.5 pixels
  - [ ] Clouds: Reduce quality or cull when < 10 pixels
  - [ ] Atmosphere: Cull when planet < 20 pixels
  - [ ] Fine details: Switch to low-res when planet < 100 pixels

## Advanced Visual Effects

### 13. Weather Systems and Storm Patterns

- [ ] Create dynamic weather systems that move across the planet
  - [ ] Storm clouds with different opacity/density
  - [ ] Lightning effects in storm systems
  - [ ] Hurricane/cyclone spiral patterns
  - [ ] Seasonal weather variations
- [ ] Implementation approach:
  - [ ] Use noise-based movement patterns
  - [ ] Shader-based storm cloud rendering

### 15. Ocean Effects and Water Rendering

- [ ] Implement realistic ocean rendering
  - [ ] Wave displacement using vertex shader
  - [ ] Specular reflections from sun
  - [ ] Foam at coastlines
- [ ] Water shader features:
  - [ ] Fresnel effect for realistic water appearance
  - [ ] Normal mapping for wave details
  - [ ] Depth-based color variation

### 16. Meteor and Shooting Star Effects

- [ ] Add occasional shooting stars in the background
  - [ ] Random spawn timing (every 10-30 seconds)
  - [ ] Fast-moving particle trails
  - [ ] Bright head with fading tail
  - [ ] Various colors (white, yellow, blue)
- [ ] Implementation:
  - [ ] Particle system with trail renderer
  - [ ] Random trajectories across sky
  - [ ] Brief lifespan (1-2 seconds)
  - [ ] Optional: Meteor showers during special events

### 17. Comet System

- [ ] Add a comet with dynamic tail
  - [ ] Elliptical orbit around sun
  - [ ] Tail always points away from sun
  - [ ] Brightness varies with distance from sun
  - [ ] Two-part tail (dust and ion)
- [ ] Technical details:
  - [ ] Particle system for tail
  - [ ] Billboard quad for coma (head)
  - [ ] Dynamic tail length based on sun distance
  - [ ] Orbital mechanics simulation

### 18. Nebula Background

- [ ] Different nebula types (emission, reflection, dark)

### 19. Atmospheric Scattering Enhancement

- [ ] Atmospheric fog at horizon
- [ ] Advanced features:
  - [ ] Height-based density falloff

### Texture Resources

- Moon: Consider NASA's CGI Moon Kit or similar public domain resources
- Ensure textures are optimized for web (compressed, appropriate resolution)

### UV Mapping Fix

- May need to regenerate sphere geometry with better UV layout
- Ensure texture.wrapS and texture.wrapT are set to THREE.RepeatWrapping

### Lighting Implementation Notes

- [ ] Consider EffectComposer for managing multiple post-processing passes

## Testing Checklist

- [ ] All controls function correctly in each render mode
- [ ] Collapsible panels save state between sessions
- [ ] No performance degradation with new textures
- [ ] Cloud rendering has no visible seams
- [ ] Orbital mechanics speed control is smooth
- [ ] Terminator band appears natural and wide enough
- [ ] Bloom effect doesn't impact performance significantly
- [ ] Starfield renders efficiently even at 100k stars
- [ ] Post-processing effects can be toggled without issues
- [ ] Lighting adjustments work across all viewing angles
