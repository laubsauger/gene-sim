# UI & 3D Scene Improvements Todo List

## Scene3DPlanetCanvas Enhancements

- [x] Add camera mode toggle:
  - [x] Geostationary (locked to Earth rotation)
  - [x] Free orbit (current behavior)
  - [x] Smooth transition between modes

### 4c. Cinematic Zoom Animation Controls / Planet Target resp Camera target change animation

- [x] Visual polish:
  - [x] Disable user controls during animation
  - [ ] Smooth FOV adjustment for dramatic effect
  - [ ] Consider adding motion blur post-process (optional)
  - [ ] Add slight rotation during zoom for extra drama (cinematic in / out zoom only)

### Misc

- [ ] Sound effects support
- [ ] Music support (we will supply our own music)

### 5. Moon Visual Improvements

- [x] Add crater texture to moon
  - [x] Source realistic moon texture map (procedural generation)
  - [x] Implement bump mapping for 3D crater depth
  - [ ] Add normal map for surface detail (optional enhancement)
  - [ ] Optional: Use actual NASA moon texture data
- [x] Adjust moon material properties:
  - [x] Roughness for realistic surface (0.95)
  - [x] Metalness adjustments (0.0 - non-metallic)
  - [x] Proper shadow receiving

### 6. Cloud Rendering Fixes

- [x] Adjust cloud rotation speed
- [x] too slow currently. constant for cloud speed does not seem to work

## Implementation Priority

### Phase 2 (Visual Polish)

1. Moon textures and materials

### Phase 3 (Fine-tuning)

1. Camera modes
2. Performance optimizations
3. Lighting enhancements

## Additional Visual Enhancements

### 7. Lighting & Atmosphere Improvements

- [ ] Increase day/night terminator band width
  - [ ] Adjust atmosphere scattering parameters
  - [ ] Widen the twilight zone for more gradual transition
  - [ ] Fine-tune sunset/sunrise colors in terminator region
  - [ ] Add atmospheric glow intensity control

### 8. Bloom & Post-processing Effects

- [ ] Add optional bloom effect for orbit mode
  - [ ] Toggle in planet 3d controls
  - [ ] Adjustable bloom intensity slider
  - [ ] Bloom threshold control
  - [ ] Performance-aware (disable on low-end devices)
- [ ] Additional lighting effects:
  - [ ] Lens flare options for sun
  - [ ] God rays/volumetric lighting (optional)
  - [ ] HDR tone mapping adjustments
  - [ ] Exposure control for different viewing angles

### 9. Starfield/Skybox System

- [ ] Expand / update hyper-efficient configurable star skybox
  - [ ] Configurable star density (sparse to dense)
  - [ ] Variable star sizes and brightness
  - [ ] Subtle color variation (white, blue, yellow, red stars)
- [ ] Performance optimizations:
  - [ ] Use point sprites or instanced geometry
  - [ ] Frustum culling for off-screen stars
  - [ ] Static batching for distant stars
  - [ ] Optional: Use texture atlas for star varieties
- [ ] Configuration options:
  - [ ] Star count slider (1k to 100k stars)
  - [ ] Twinkle effect toggle
  - [ ] Milky way band toggle
  - [ ] Nebula clouds (subtle, optional)
- [ ] Consider using:
  - [ ] BufferGeometry with custom shaders
  - [ ] GPU-based star positioning
  - [ ] Perlin noise for natural clustering

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
  - [ ] **Particle-based dust simulation**
    - [ ] Sparse particle field (1k-10k particles)
    - [ ] Only visible when lit by sun
    - [ ] Fade in planet shadows
    - [ ] Use additive blending for glow
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
- [ ] Add debug visualization to confirm regrowth in all areas

### 14. Distance-Based Culling System

- [ ] Implement efficient LOD/culling for distant objects
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
- [ ] Specific thresholds:
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
- [ ] Create colorful nebula clouds in deep space
  - [ ] Multi-layer parallax effect
  - [ ] Color gradients (purple, blue, pink, orange)
  - [ ] Subtle animation/movement
  - [ ] Different nebula types (emission, reflection, dark)
- [ ] Implementation:
  - [ ] Large billboard quads with gradient textures
  - [ ] Multiple layers at different distances
  - [ ] Very subtle rotation for movement
  - [ ] Additive blending for glow effect

### 19. Atmospheric Scattering Enhancement
- [ ] Improve atmospheric rendering for sunsets/sunrises
  - [ ] Rayleigh scattering for blue sky
  - [ ] Mie scattering for sun glow (should already be present to a degree)
  - [ ] Orange/red colors at terminator (already present but could be slightly more intense)
  - [ ] Atmospheric fog at horizon
- [ ] Advanced features:
  - [ ] Multiple scattering for realistic sky
  - [ ] Height-based density falloff

## Technical Notes

### Collapsible Components
- Use React state for collapsed/expanded
- CSS transitions for smooth animations
- Consider using a shared hook for collapsible behavior

### Texture Resources
- Moon: Consider NASA's CGI Moon Kit or similar public domain resources
- Ensure textures are optimized for web (compressed, appropriate resolution)

### UV Mapping Fix

- May need to regenerate sphere geometry with better UV layout
- Ensure texture.wrapS and texture.wrapT are set to THREE.RepeatWrapping

### Lighting Implementation Notes
- Terminator band: Modify atmosphere shader's scattering calculation
- Bloom: Use THREE.UnrealBloomPass from postprocessing examples
- Consider EffectComposer for managing multiple post-processing passes

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