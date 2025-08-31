# Planet Rendering Mode - Implementation Plan

## Overview

Add an optional 3D spherical planet rendering mode that transforms the existing 2D simulation into a globe visualization, maintaining all existing simulation logic while providing a more immersive visual experience.

## Core Concept

- **Keep simulation logic unchanged** - All calculations remain 2D (x,y coordinates)
- **Transform rendering only** - Map 2D coordinates to 3D sphere surface
- **Toggle between modes** - Switch between flat 2D and spherical 3D views
- **Maintain performance** - Target 60 FPS with 100k+ entities

## Architecture Design

### 1. Coordinate Transformation Layer

#### Mapping Strategy

```typescript
// Convert 2D world coordinates to sphere surface (lat/lon)
function worldToSphere(x: number, y: number, worldWidth: number, worldHeight: number) {
  const lon = (x / worldWidth) * Math.PI * 2 - Math.PI; // -π to π
  const lat = (y / worldHeight) * Math.PI - Math.PI/2;  // -π/2 to π/2
  
  // Convert to 3D sphere coordinates
  const radius = PLANET_RADIUS;
  return {
    x: radius * Math.cos(lat) * Math.cos(lon),
    y: radius * Math.sin(lat),
    z: radius * Math.cos(lat) * Math.sin(lon)
  };
}
```

#### Edge Wrapping

- Horizontal edges connect (x=0 connects to x=worldWidth)
- Vertical edges create poles (special handling for y=0 and y=worldHeight)
- Entities naturally wrap around the sphere

### 2. Scene Structure

```typescript
interface SceneMode {
  type: '2D' | 'PLANET';
}

// New component hierarchy
<Scene3D>  // New planet mode scene
  <PerspectiveCamera />
  <OrbitControls />  // Google Earth-style navigation
  <PlanetSphere>
    <BiomeLayer />       // Base terrain with biomes
    <FoodLayer3D />      // Vegetation/trees
    <EntityLayer3D />    // Entities on surface
    <AtmosphereLayer />  // Atmospheric effects
    <CloudLayer />       // Animated clouds
  </PlanetSphere>
</Scene3D>
```

### 3. Biome System

#### Biome Types

```typescript
enum BiomeType {
  OCEAN = 'ocean',          // Non-traversable water
  MOUNTAIN = 'mountain',    // Non-traversable peaks
  FOREST = 'forest',        // Dense vegetation
  GRASSLAND = 'grassland',  // Open plains
  DESERT = 'desert',        // Low food availability
  TUNDRA = 'tundra',        // Cold/snowy regions
  SAVANNA = 'savanna'       // Mixed grass/trees
}

interface Biome {
  type: BiomeType;
  traversable: boolean;
  foodMultiplier: number;  // Affects food spawn rate
  color: THREE.Color;
  elevation: number;        // Height above sphere surface
  vegetationType: 'trees' | 'grass' | 'sparse' | 'none';
}
```

#### Biome Generation

- Use noise functions to generate natural-looking biome distributions
- Create height maps for elevation variation
- Generate moisture maps to determine vegetation density
- Ensure biome transitions are smooth and realistic

### 4. Vegetation Rendering

#### Food as Vegetation

```typescript
interface VegetationConfig {
  biome: BiomeType;
  density: number;  // From food value
  models: {
    tree: THREE.InstancedMesh;     // For forests
    grass: THREE.InstancedMesh;    // For grasslands
    bush: THREE.InstancedMesh;     // For savanna
    cactus: THREE.InstancedMesh;   // For desert
  };
}
```

#### LOD System

- High detail: Individual trees/plants when zoomed in
- Medium detail: Billboards with tree/grass textures
- Low detail: Color variation on sphere surface

### 5. Atmosphere & Clouds

#### Atmosphere Shader

```glsl
// Fragment shader for atmosphere glow
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 viewDirection = normalize(cameraPosition - vPosition);
  float rim = 1.0 - max(dot(viewDirection, vNormal), 0.0);
  float atmosphere = pow(rim, 2.0);
  
  vec3 atmosphereColor = mix(
    vec3(0.3, 0.5, 0.9),  // Sky blue
    vec3(1.0, 0.8, 0.6),  // Sunset orange
    rim
  );
  
  gl_FragColor = vec4(atmosphereColor, atmosphere * 0.6);
}
```

#### Cloud System

- Minecraft-inspired blocky/voxel clouds
- Animate using perlin noise for natural movement
- Multiple layers at different heights
- Semi-transparent with soft shadows on planet surface

### 6. Camera & Controls

#### Navigation Modes

1. **Orbit Mode** (Default)
   - Click and drag to rotate planet
   - Scroll to zoom in/out
   - Double-click to focus on location
   - Smooth inertia for natural feel

2. **Follow Mode**
   - Track specific entity
   - Auto-rotate to keep entity in view
   - Smooth camera transitions

3. **Free Cam Mode**
   - WASD movement
   - Mouse look
   - Fly around planet surface

#### Zoom Levels

- **Global View**: See entire planet with atmosphere
- **Regional View**: See biome details and cloud shadows
- **Local View**: See individual entities and vegetation
- **Entity View**: Close-up following specific creatures

### 7. Performance Optimizations

#### Instanced Rendering

- All vegetation uses instanced meshes
- Entities grouped by tribe for instanced rendering
- Single draw call per vegetation type

#### Frustum Culling

- Only render visible hemisphere + margin
- Cull vegetation outside view
- LOD switching based on distance

#### Shader Optimizations

- Vertex shader for sphere transformation
- GPU-based animation for clouds
- Minimal fragment shader complexity

### 8. Implementation Phases

#### Phase 1: Basic Sphere Rendering

- [ ] Create Scene3D component
- [ ] Implement coordinate transformation
- [ ] Render entities on sphere surface
- [ ] Add basic camera controls

#### Phase 2: Biome System

- [ ] Generate biome map
- [ ] Create biome textures/materials
- [ ] Implement traversability checks
- [ ] Add elevation variation

#### Phase 3: Vegetation & Food

- [ ] Convert food to vegetation models
- [ ] Implement LOD system
- [ ] Add biome-specific vegetation
- [ ] Optimize with instancing

#### Phase 4: Atmosphere & Effects

- [ ] Add atmosphere shader
- [ ] Implement cloud system
- [ ] Add day/night cycle (optional)
- [ ] Add weather effects (optional)

#### Phase 5: Polish & Optimization

- [ ] Smooth camera transitions
- [ ] Add UI for mode switching
- [ ] Performance profiling
- [ ] Fine-tune visual parameters

## Technical Considerations

### SharedArrayBuffer Compatibility

- Coordinate transformation happens in render thread only
- No changes to worker simulation logic
- SAB views remain unchanged

### Mode Switching

```typescript
interface RenderConfig {
  mode: 'flat' | 'planet';
  planetConfig?: {
    radius: number;
    biomeMap: Uint8Array;
    showAtmosphere: boolean;
    showClouds: boolean;
    vegetationLOD: 'high' | 'medium' | 'low';
  };
}
```

### Memory Requirements

- Additional ~10MB for biome/height maps
- ~5MB for vegetation instance data
- ~2MB for cloud volume texture
- Total overhead: ~20MB for planet mode

## Visual References

### Inspiration Sources

- **Google Earth**: Navigation and zoom behavior
- **Civilization VI**: Stylized planet view with clear biomes
- **No Man's Sky**: Atmospheric effects and cloud rendering
- **Minecraft**: Blocky cloud aesthetic and biome transitions
- **Spore**: Creature visualization on planet surface

### Art Direction

- Semi-realistic with stylized elements
- Clear biome boundaries with smooth transitions
- Vibrant colors to distinguish entity tribes
- Atmospheric perspective for depth
- Soft shadows and ambient occlusion

## Fallback Strategy

If performance issues arise:

1. Disable clouds and atmosphere on low-end devices
2. Reduce vegetation density
3. Simplify biome textures
4. Lower entity render distance
5. Provide quality presets (Low/Medium/High/Ultra)

## Future Enhancements

### Potential Extensions

- Weather systems affecting entity behavior
- Seasonal changes in biomes
- Multiple planet presets (Earth-like, Mars-like, etc.)
- Planet statistics overlay (heat maps for population, food, etc.)

## Testing Plan

1. **Performance Testing**
   - Maintain 60 FPS with 100k entities
   - Memory usage under 500MB
   - Smooth camera movement at all zoom levels

2. **Visual Testing**
   - Biome transitions look natural
   - Entities visible at appropriate zoom levels
   - No z-fighting or rendering artifacts

3. **Functionality Testing**
   - Mode switching preserves simulation state
   - Edge wrapping works correctly
   - Camera controls intuitive
   - All biomes render correctly

## Conclusion

This planet rendering mode will provide a dramatic visual upgrade while maintaining the core simulation's simplicity and performance. By keeping all logic in 2D and only transforming the rendering, we ensure compatibility with existing code and future WASM optimizations. The modular design allows for incremental implementation and easy toggling between visualization modes.
