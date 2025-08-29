# Gene-Sim: High-Performance Genetic Evolution Simulator

A real-time genetic evolution simulator supporting 100,000+ entities with complex emergent behaviors, built with React, Three.js, and WebWorkers.

## Features

- **Massive Scale**: Simulates 100,000+ entities at 60 FPS
- **Genetic Evolution**: 9 genes per entity affecting behavior and survival
- **Emergent Behaviors**: Pack hunting, grazing herds, territorial control, migration patterns
- **Diet Specialization**: Carnivores, herbivores, and omnivores with realistic energy dynamics
- **Real-Time Visualization**: GPU-accelerated rendering with Three.js
- **Zero-Copy Performance**: SharedArrayBuffer for efficient worker communication

## Quick Start

```bash
# Install dependencies
yarn

# Start development server
yarn dev

# Build for production
yarn build

# Preview production build
yarn preview
```

## Documentation

- **[Behavior System Documentation](./BEHAVIOR_SYSTEM.md)** - Comprehensive guide to all behavioral mechanics
- **[Interactive Behavior Graph](./behavior-graph.html)** - Visual network of behavior interactions
- **[Claude.md](./CLAUDE.md)** - Technical implementation details

## Genetic Traits

Each entity has 9 genes that determine their behavior:

1. **Speed** (0-100) - Movement velocity
2. **Vision** (20-150) - Detection range
3. **Metabolism** (0.05-0.30) - Energy consumption rate
4. **Reproduction** (0.01-0.20) - Breeding probability
5. **Aggression** (0.0-1.0) - Combat likelihood
6. **Cohesion** (0.0-1.0) - Flocking strength
7. **Food Standards** (0.0-1.0) - Pickiness about food areas
8. **Diet** (-1.0 to 1.0) - Carnivore/Herbivore spectrum
9. **View Angle** (60-180°) - Field of vision

## Key Behaviors

### Diet-Based Strategies

**Carnivores** (Diet > 0):
- Lower movement energy costs (50% reduction)
- Lower base metabolism (30% reduction)
- Hunt when energy < 95% (scaled by carnivore level)
- Gain energy only from kills
- Extended vision when hungry
- Pack hunting with high cohesion

**Herbivores** (Diet < 0):
- Higher base metabolism (50% increase)
- Continuous grazing requirement
- Gain energy from plant food
- Form protective herds
- Migrate based on food standards

### Emergent Behaviors

- **Pack Hunting**: Coordinated attacks with damage bonuses
- **Grazing Herds**: Synchronized movement to food sources
- **Territorial Control**: Aggressive tribes dominate areas
- **Nomadic Carnivores**: Long-range exploration for prey
- **Border Avoidance**: Intelligent edge detection and turning

## Performance

### Optimization Techniques

- **Spatial Hashing**: O(1) neighbor lookups
- **Staggered Updates**: Food checks every 3rd frame
- **View Angle Culling**: Skip entities outside FOV
- **SharedArrayBuffer**: Zero-copy data transfer
- **GPU Rendering**: Custom WebGL shaders

### System Requirements

- Modern browser with SharedArrayBuffer support
- Secure context (HTTPS or localhost)
- WebGL 2.0 for optimal performance
- 4GB+ RAM recommended for 100k+ entities

## Architecture

```
WebWorker (60Hz simulation)
    ↓ SharedArrayBuffer
React App (60 FPS rendering)
    ↓ Three.js
GPU (WebGL point shader)
```

## Configuration

Key parameters can be adjusted in the simulation:

- **World Size**: 2000x2000 default
- **Max Entities**: 100,000 capacity
- **Food Grid**: 40x40 cells
- **Timestep**: Fixed 16.67ms (60Hz)
- **Tribes**: Multiple with unique colors

## Development

Built with:
- **Vite 7.1.2** - Build tool
- **React 19.1.1** - UI framework
- **TypeScript 5.8** - Type safety
- **Three.js 0.179** - 3D rendering
- **@react-three/fiber 9.3** - React Three.js renderer

## Browser Compatibility

Requires:
- Chrome 68+ / Firefox 79+ / Safari 15.2+
- SharedArrayBuffer support
- Cross-Origin-Opener-Policy headers
- Cross-Origin-Embedder-Policy headers

## License

MIT