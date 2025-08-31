# UI & 3D Scene Improvements Todo List

## Control Panel Reorganization

### 1. Unified Render Mode Controls
- [ ] Integrate 2D/3D/Orbit mode selector into main Controls component
- [ ] Make Planet3D controls collapsible
- [ ] Consolidate all render mode controls into single panel

### 2. Biome Controls Enhancement
- [ ] Move biome types (hidden/natural/highlight) into biome controls section
- [ ] Add boundaries toggle with options:
  - [ ] Off
  - [ ] Natural 
  - [ ] Highlight
- [ ] Separate boundaries from biome controls visually
- [ ] Add compact labels for all biome-related controls

### 3. Sidebar Improvements
- [ ] Make "Simulation Setup" sidebar collapsible
  - [ ] Add collapse/expand button
  - [ ] Persist collapsed state in local storage
  - [ ] Smooth animation transition
- [ ] Make "Simulation Stats" sidebar collapsible
  - [ ] Add collapse/expand button
  - [ ] Show key metrics when collapsed
  - [ ] Full stats when expanded

## Scene3DPlanetCanvas Enhancements

### 4. Orbital Mechanics Controls
- [ ] Add orbital speed slider (in addition to pause)
  - [ ] Range: 0.1x to 10x normal speed
  - [ ] Default: 1x
  - [ ] Show current multiplier value
- [ ] Add camera mode toggle:
  - [ ] Geostationary (locked to Earth rotation)
  - [ ] Free orbit (current behavior)
  - [ ] Smooth transition between modes

### 4c. Cinematic Zoom Controls
- [ ] Add dramatic zoom buttons for 3D planet view
  - [ ] "Zoom to Surface" button - smooth punch-in to max zoom
  - [ ] "View System" button - smooth punch-out to min zoom
  - [ ] Dramatic easing curves for cinematic feel
  - [ ] Could be used as intro sequence
- [ ] Implementation details:
  - [ ] Use GSAP or custom easing for smooth animation
  - [ ] Duration: 2-3 seconds for full transition
  - [ ] Ease-in-out-power3 or similar dramatic curve
  - [ ] Camera looks at Earth center during transition
  - [ ] Optional: Add slight rotation during zoom for extra drama
  - [ ] Buttons positioned in orbit controls panel
  - [ ] Keyboard shortcuts: 'I' for zoom in, 'O' for zoom out
- [ ] Visual polish:
  - [ ] Disable user controls during animation
  - [ ] Smooth FOV adjustment for dramatic effect
  - [ ] Consider adding motion blur post-process (optional)
  - [ ] Sound effects support (future enhancement)

### 4b. ✅ Stylized Earth-Moon-Sun System (Completed)
- [x] Adjust Moon distance for visual appeal
  - [x] Reality: Moon is ~60 Earth radii away
  - [x] Implemented: 5 Earth radii (stylized for better composition)
  - [x] Update MOON_ORBIT_RADIUS in planetUtils.ts (final: 5)
- [x] Scale Moon size appropriately
  - [x] Reality: Moon radius is 0.27x Earth radius
  - [x] Implemented: 0.25x (slightly smaller for visual balance)
- [x] Adjust orbital speeds for better visual experience
  - [x] Earth rotation: 0.05 (slower day/night)
  - [x] Moon orbit: 0.15 (faster for visual interest)
  - [x] Earth orbit: 0.02 (very slow, comfortable viewing)
- [x] Stylize Sun for visual impact
  - [x] Sun radius: 2.0 (larger for dramatic effect)
  - [x] Multiple halo layers for impressive glow
  - [x] Brighter point light (0.8 intensity)
- [x] Fine-tune overall system
  - [x] Earth orbit: 10 units from sun
  - [x] Camera distances optimized for composition
  - [ ] Consider adding speed multiplier controls for each rotation/orbit independently

### 5. Moon Visual Improvements
- [ ] Add crater texture to moon
  - [ ] Source realistic moon texture map
  - [ ] Implement bump mapping for 3D crater depth
  - [ ] Add normal map for surface detail
  - [ ] Optional: Use actual NASA moon texture data
- [ ] Adjust moon material properties:
  - [ ] Roughness for realistic surface
  - [ ] Metalness adjustments
  - [ ] Proper shadow receiving

### 6. Cloud Rendering Fixes
- [ ] Fix UV mapping issues causing seams
  - [ ] Review sphere geometry UV coordinates
  - [ ] Ensure proper texture wrapping
  - [ ] Fix stretching at poles
- [ ] Improve cloud shader:
  - [ ] Seamless tiling
  - [ ] Better blending at edges
  - [ ] Fix any visible seams in texture mapping

## Implementation Priority

### Phase 1 (UI Organization)
1. Collapsible sidebars
2. Unified render mode controls
3. Reorganized biome/boundary controls

### Phase 2 (Visual Polish)
1. Moon textures and materials
2. Cloud UV fixing
3. Orbital mechanics controls

### Phase 3 (Fine-tuning)
1. Camera modes
2. Control labels and layout
3. Performance optimizations
4. Lighting enhancements
5. Starfield implementation

## Additional Visual Enhancements

### 7. Lighting & Atmosphere Improvements
- [ ] Increase day/night terminator band width
  - [ ] Adjust atmosphere scattering parameters
  - [ ] Widen the twilight zone for more gradual transition
  - [ ] Fine-tune sunset/sunrise colors in terminator region
  - [ ] Add atmospheric glow intensity control

### 8. Bloom & Post-processing Effects
- [ ] Add optional bloom effect for orbit mode
  - [ ] Toggle in orbit controls
  - [ ] Adjustable bloom intensity slider
  - [ ] Bloom threshold control
  - [ ] Performance-aware (disable on low-end devices)
- [ ] Additional lighting effects:
  - [ ] Lens flare options for sun
  - [ ] God rays/volumetric lighting (optional)
  - [ ] HDR tone mapping adjustments
  - [ ] Exposure control for different viewing angles

### 9. Starfield/Skybox System
- [ ] Create hyper-efficient configurable star skybox
  - [ ] Procedural star generation with LOD system
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

## Simulation Fixes

### 10. Food Regrowth System Fix
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
- Consider using THREE.SphereGeometry with higher segment count
- Ensure texture.wrapS and texture.wrapT are set to THREE.RepeatWrapping

### Lighting Implementation Notes
- Terminator band: Modify atmosphere shader's scattering calculation
- Bloom: Use THREE.UnrealBloomPass from postprocessing examples
- Consider EffectComposer for managing multiple post-processing passes

### Starfield Implementation Strategy
```javascript
// Pseudo-code for efficient starfield
class StarField {
  - Use THREE.Points with BufferGeometry
  - Store positions in Float32Array
  - Use custom vertex/fragment shaders
  - Implement LOD: fewer stars when zoomed in on planet
  - Static stars, no physics simulation needed
}
```

## Testing Checklist
- [ ] All controls function correctly in each render mode
- [ ] Collapsible panels save state between sessions
- [ ] No performance degradation with new textures
- [ ] Cloud rendering has no visible seams
- [ ] Orbital mechanics speed control is smooth
- [ ] Camera modes transition smoothly
- [ ] Mobile responsive (if applicable)
- [ ] Terminator band appears natural and wide enough
- [ ] Bloom effect doesn't impact performance significantly
- [ ] Starfield renders efficiently even at 100k stars
- [ ] Post-processing effects can be toggled without issues
- [ ] Lighting adjustments work across all viewing angles