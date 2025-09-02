import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { SimClient } from '../../client/setupSimClientHybrid';
import type { MainMsg } from '../../sim/types';
import { DevControlsPlanet3D } from '../../ui/DevControlsPlanet3D';
import { usePlanet3DStore } from '../../stores/usePlanet3DStore';
import { useUIStore } from '../../stores/useUIStore';

// FPS tracking component (reused from Scene3D)
function FPSTracker({ client }: { client: SimClient }) {
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  const trackFrame = () => {
    frameCount.current++;
    const now = performance.now();
    const delta = now - lastTime.current;

    if (delta >= 250) { // Update 4 times per second
      const fps = Math.round((frameCount.current * 1000) / delta);
      client.sendRenderFps(fps);
      frameCount.current = 0;
      lastTime.current = now;
    }
  };

  return { trackFrame };
}
import { makePlanet } from './PlanetFactory';
import { BiomeGenerator } from '../../sim/biomes';
import { createMultiLayerClouds } from './MultiLayerClouds';
import { updateEntitiesFromBuffers, makeGroundEntities } from './EntityRenderer';
import { batchWorldToSphere } from '../utils/coordinateTransform';
import { createFoodOverlay3D } from './FoodOverlay3D';
import { makeMoon } from './MoonComponent';
import { makeVenus } from './VenusComponent';
import { makeMars } from './MarsComponent';
import { createSpaceDust, createPlanetaryDustRing } from './SpaceDust';
import { createVolumetricDust } from './VolumetricLight';
import { createEnhancedStarfield, createNebulaClouds } from './EnhancedStarfield';
import { LensFlareSystem } from './LensFlareVanilla';
import { createAuroraEffect } from './AuroraEffect';
import {
  PLANET_RADIUS,
  ATMOSPHERE_THICKNESS,
  EARTH_ORBIT_RADIUS,
  EARTH_ORBIT_SPEED,
  EARTH_ROTATION_SPEED,
  MOON_ORBIT_RADIUS,
  MOON_ORBIT_SPEED,
  MOON_RADIUS,
  CLOUD_ROTATION_SPEED,
  AXIAL_TILT,
  MOON_ORBITAL_INCLINATION,
  CAMERA_CONFIG,
  SUN_RADIUS,
  VENUS_ORBIT_RADIUS,
  VENUS_ORBIT_SPEED,
  VENUS_ROTATION_SPEED,
  VENUS_RADIUS,
  MARS_ORBIT_RADIUS,
  MARS_ORBIT_SPEED,
  MARS_ROTATION_SPEED,
  MARS_RADIUS
} from './planetUtils';

export interface Scene3DPlanetCanvasProps {
  client: SimClient;
  world: { width: number; height: number };
  entitySize: number;
  seed?: number;
  biomeMode?: 'hidden' | 'natural' | 'highlight';
  showBoundaries?: boolean;
}

export function Scene3DPlanetCanvas({
  client,
  world,
  entitySize,
  seed = 1234,
  biomeMode = 'natural',
  showBoundaries = false // Keep as prop for backwards compatibility but use store
}: Scene3DPlanetCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(true);
  const biomeGeneratorRef = useRef<BiomeGenerator | null>(null);
  const earthRef = useRef<any>(null); // Store earth object reference
  const prevBiomeModeRef = useRef<string | null>(null);
  const fpsTracker = FPSTracker({ client });
  const cinematicAnimationRef = useRef<{
    startTime: number;
    duration: number;
    from: number;
    to: number;
    fromFov: number;
    toFov: number;
    startRotation: number;
    rotationAmount: number;
    active: boolean
  } | null>(null);
  const cameraTransitionRef = useRef<{
    startTime: number;
    duration: number;
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    active: boolean;
  } | null>(null);
  const statsRef = useRef<Stats | null>(null);
  const { controlsHidden, setupSidebarCollapsed, statsSidebarCollapsed } = useUIStore();
  const geostationaryOffsetRef = useRef<{ angle: number; height: number; distance: number; target: string } | null>(null);

  // Store reference for animation loop - we'll use getState() inside the loop
  // to always get the current state values
  const storeRef = useRef(usePlanet3DStore);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    composer: any; // EffectComposer type
    bloomPass: any; // UnrealBloomPass type
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    earth: any;
    venus?: ReturnType<typeof makeVenus>;
    mars?: ReturnType<typeof makeMars>;
    entities: THREE.InstancedMesh | null;
    clouds: THREE.Mesh;
    cloudSystem?: ReturnType<typeof createMultiLayerClouds>;
    moon: THREE.Mesh;
    sun: THREE.DirectionalLight;
    clock: THREE.Clock;
    axisHelper?: THREE.AxesHelper;
    testSphere?: THREE.Mesh;
    atmoDepth?: THREE.Mesh;
    spaceDust?: ReturnType<typeof createSpaceDust>;
    dustRing?: ReturnType<typeof createPlanetaryDustRing>;
    starfield?: ReturnType<typeof createEnhancedStarfield>;
    lensFlareSystem?: LensFlareSystem;
    nebulae?: ReturnType<typeof createNebulaClouds>;
    volumetricDust?: ReturnType<typeof createVolumetricDust>;
    aurora?: ReturnType<typeof createAuroraEffect>;
    northPoleArrow?: THREE.ArrowHelper;
    southPoleArrow?: THREE.ArrowHelper;
    northPoleCylinder?: THREE.Mesh;
    southPoleCylinder?: THREE.Mesh;
    boundaries?: THREE.Group;
    foodOverlay?: ReturnType<typeof createFoodOverlay3D>;
  } | null>(null);

  // Listen for pause state from simulation
  useEffect(() => {
    const unsubscribe = client.onMessage((msg: MainMsg) => {
      // pauseState is not in the MainMsg type, but it's sent from the worker
      if ((msg as any).type === 'pauseState') {
        const pauseMsg = msg as any;
        setIsPaused(pauseMsg.payload?.paused ?? true);
      }
    });
    return unsubscribe;
  }, [client]);

  // Function to create biome boundaries using actual traversability data
  const createBiomeBoundaries = (biomeGenerator: BiomeGenerator, worldWidth: number, worldHeight: number): THREE.Group => {
    const group = new THREE.Group();
    const elevationOffset = PLANET_RADIUS * 1.002; // Slightly above surface

    const traversabilityMap = biomeGenerator.getTraversabilityMap();
    const { width: gridWidth, height: gridHeight } = biomeGenerator.getGridDimensions();
    const cellSize = biomeGenerator.getCellSize();

    // Extract boundary edges similar to BoundaryOverlay
    const edges: { points: THREE.Vector3[] }[] = [];

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const idx = y * gridWidth + x;
        const isTraversable = traversabilityMap[idx] === 1;

        if (!isTraversable) continue; // Only care about edges of traversable areas

        // Check each neighbor for boundaries
        // Right edge
        if (x < gridWidth - 1) {
          const rightIdx = y * gridWidth + (x + 1);
          if (traversabilityMap[rightIdx] === 0) {
            const worldX = (x + 1) * cellSize;
            // Flip Y coordinate to match 2D boundary overlay
            const points2D = new Float32Array([
              worldX, worldHeight - y * cellSize,
              worldX, worldHeight - (y + 1) * cellSize
            ]);
            const points3D = batchWorldToSphere(points2D, worldWidth, worldHeight, elevationOffset);
            edges.push({
              points: [
                new THREE.Vector3(points3D[0], points3D[1], points3D[2]),
                new THREE.Vector3(points3D[3], points3D[4], points3D[5])
              ]
            });
          }
        }

        // Left edge
        if (x > 0) {
          const leftIdx = y * gridWidth + (x - 1);
          if (traversabilityMap[leftIdx] === 0) {
            const worldX = x * cellSize;
            // Flip Y coordinate to match 2D boundary overlay
            const points2D = new Float32Array([
              worldX, worldHeight - y * cellSize,
              worldX, worldHeight - (y + 1) * cellSize
            ]);
            const points3D = batchWorldToSphere(points2D, worldWidth, worldHeight, elevationOffset);
            edges.push({
              points: [
                new THREE.Vector3(points3D[0], points3D[1], points3D[2]),
                new THREE.Vector3(points3D[3], points3D[4], points3D[5])
              ]
            });
          }
        }

        // Top edge (in grid coordinates, which is bottom in world space due to flip)
        if (y < gridHeight - 1) {
          const topIdx = (y + 1) * gridWidth + x;
          if (traversabilityMap[topIdx] === 0) {
            // Flip Y coordinate to match 2D boundary overlay
            const worldY = worldHeight - (y + 1) * cellSize;
            const points2D = new Float32Array([
              x * cellSize, worldY,
              (x + 1) * cellSize, worldY
            ]);
            const points3D = batchWorldToSphere(points2D, worldWidth, worldHeight, elevationOffset);
            edges.push({
              points: [
                new THREE.Vector3(points3D[0], points3D[1], points3D[2]),
                new THREE.Vector3(points3D[3], points3D[4], points3D[5])
              ]
            });
          }
        }

        // Bottom edge (in grid coordinates, which is top in world space due to flip)
        if (y > 0) {
          const bottomIdx = (y - 1) * gridWidth + x;
          if (traversabilityMap[bottomIdx] === 0) {
            // Flip Y coordinate to match 2D boundary overlay
            const worldY = worldHeight - y * cellSize;
            const points2D = new Float32Array([
              x * cellSize, worldY,
              (x + 1) * cellSize, worldY
            ]);
            const points3D = batchWorldToSphere(points2D, worldWidth, worldHeight, elevationOffset);
            edges.push({
              points: [
                new THREE.Vector3(points3D[0], points3D[1], points3D[2]),
                new THREE.Vector3(points3D[3], points3D[4], points3D[5])
              ]
            });
          }
        }
      }
    }

    // Collect all line segments into a single geometry for better performance
    const allPoints: THREE.Vector3[] = [];
    edges.forEach((edge) => {
      allPoints.push(edge.points[0], edge.points[1]);
    });
    
    if (allPoints.length > 0) {
      const geometry = new THREE.BufferGeometry().setFromPoints(allPoints);
      const material = new THREE.LineBasicMaterial({
        color: 0xff6b35,  // Alert orange like in 2D
        opacity: 1.0,  // Full opacity for better visibility
        transparent: false
      });
      const lines = new THREE.LineSegments(geometry, material);
      lines.renderOrder = 15;
      group.add(lines);
      
      // Also add a thicker, semi-transparent version for better visibility
      const glowMaterial = new THREE.LineBasicMaterial({
        color: 0xff6b35,
        opacity: 0.3,
        transparent: true
      });
      const glowLines = new THREE.LineSegments(geometry, glowMaterial);
      glowLines.scale.multiplyScalar(1.01); // Slightly larger for glow effect
      glowLines.renderOrder = 14;
      group.add(glowLines);
    }

    return group;
  };

  // Initialize Three.js scene
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Get actual dimensions
    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;

    // Renderer with logarithmic depth buffer per checklist
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      logarithmicDepthBuffer: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      stencil: false,
      depth: true,
      alpha: false,  // Opaque canvas for better performance
      premultipliedAlpha: true  // Correct alpha blending
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.sortObjects = true; // CRITICAL: Keep default sorting so opaque → transparent ordering is respected
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // Add Stats panel - position at bottom right
    const stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb
    stats.dom.style.position = 'absolute';
    stats.dom.style.bottom = '16px';
    stats.dom.style.right = '16px';
    stats.dom.style.left = 'auto'; // Ensure it's on right, not left
    stats.dom.style.top = 'auto'; // Override default
    mount.appendChild(stats.dom);
    statsRef.current = stats;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02060d);

    // Camera matching Scene3D configuration
    const camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.fov,
      width / height,
      CAMERA_CONFIG.near,
      CAMERA_CONFIG.far
    );
    // Set default camera position from saved view
    camera.position.set(47.77627964409322, 1.1502508893442907, 7.314353845821846);
    camera.rotation.set(-0.35978222754560024, -0.5585316946306087, -0.19676065388331593);

    // Controls with saved target position
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = CAMERA_CONFIG.minDistance;
    controls.maxDistance = CAMERA_CONFIG.maxDistance * 3; // Allow more zoom out for orbital view
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 1.0;
    controls.target.set(49.81791285506853, 0, 4.256430394671956); // Saved target position

    // Create EffectComposer for post-processing
    const composer = new EffectComposer(renderer);

    // Add render pass (renders the scene)
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Add bloom pass (optional, controlled by state)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.45,  // intensity (reduced from 1.5)
      0.4,   // radius
      0.175  // threshold (reduced from 0.85)
    );
    bloomPass.enabled = true; // Start enabled with lower intensity
    composer.addPass(bloomPass);

    // Add output pass for proper color space conversion
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    // Add ambient light for debugging
    const ambientLight = new THREE.AmbientLight(0x404040, 0.1); // Reduced for better shadows
    scene.add(ambientLight);

    // Add axis helper for orientation
    const axisHelper = new THREE.AxesHelper(5);
    axisHelper.visible = storeRef.current.getState().showDebug;
    scene.add(axisHelper);

    // ---------- SUN (Directional Light) - Position at origin ----------
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    // Directional light position represents where light comes FROM
    // We'll update this dynamically to always shine from sun (origin) to Earth
    sun.position.set(100, 100, 100); // Initial position (will be updated per frame)
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096); // Higher resolution for better shadows
    // Expanded shadow camera for orbital mechanics and moon orbit with new scale
    const shadowSize = Math.max(MARS_ORBIT_RADIUS, MOON_ORBIT_RADIUS) * 1.5;
    sun.shadow.camera.left = -shadowSize;
    sun.shadow.camera.right = shadowSize;
    sun.shadow.camera.top = shadowSize;
    sun.shadow.camera.bottom = -shadowSize;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = shadowSize * 2; // Cover full orbital range including Mars
    sun.shadow.bias = -0.0001; // Fine-tuned for better shadows
    sun.shadow.normalBias = 0.02; // Additional shadow acne prevention
    // Add target for directional light
    sun.target.position.set(EARTH_ORBIT_RADIUS, 0, 0); // Point at Earth's initial position
    scene.add(sun);
    scene.add(sun.target); // Important: add target to scene

    // Add Sun visual group at origin
    const sunGroup = new THREE.Group();
    sunGroup.position.set(0, 0, 0); // Sun at origin
    sunGroup.name = 'SunGroup';
    scene.add(sunGroup);

    // Sun texture - circular to avoid square bloom artifacts with smoother gradients
    const sunTexture = new THREE.CanvasTexture((() => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;  // Higher resolution for smoother gradients
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      // Clear canvas with transparency
      ctx.clearRect(0, 0, 512, 512);
      // Create circular gradient with more stops for smoother transitions
      const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
      gradient.addColorStop(0, 'rgba(255, 255, 250, 1)');
      gradient.addColorStop(0.1, 'rgba(255, 253, 235, 1)');
      gradient.addColorStop(0.2, 'rgba(255, 250, 200, 1)');
      gradient.addColorStop(0.3, 'rgba(255, 240, 150, 0.95)');
      gradient.addColorStop(0.4, 'rgba(255, 230, 120, 0.85)');
      gradient.addColorStop(0.5, 'rgba(255, 220, 100, 0.7)');
      gradient.addColorStop(0.6, 'rgba(255, 200, 80, 0.5)');
      gradient.addColorStop(0.7, 'rgba(255, 180, 60, 0.3)');
      gradient.addColorStop(0.8, 'rgba(255, 160, 40, 0.15)');
      gradient.addColorStop(0.9, 'rgba(255, 140, 20, 0.05)');
      gradient.addColorStop(1, 'rgba(255, 120, 0, 0)');
      ctx.fillStyle = gradient;
      // Draw circular sun instead of rectangle
      ctx.beginPath();
      ctx.arc(256, 256, 256, 0, Math.PI * 2);
      ctx.fill();
      return canvas;
    })());

    // Main sun core - scaled up for visual impact
    const sunCore = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunTexture,
        color: 0xffffff,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      })
    );
    sunCore.scale.set(SUN_RADIUS * 0.6, SUN_RADIUS * 0.6, 1); // Bright core, smaller than full radius
    sunGroup.add(sunCore);

    // Inner glow
    const sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunTexture,
        color: 0xffee55,
        opacity: 0.5,  // Reduced for smoother blending
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      })
    );
    sunGlow.scale.set(SUN_RADIUS * 1.1, SUN_RADIUS * 1.1, 1); // Slightly larger
    sunGroup.add(sunGlow);

    // Middle halo
    const sunHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunTexture,
        color: 0xffcc22,
        opacity: 0.25,  // Smoother transition
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      })
    );
    sunHalo.scale.set(SUN_RADIUS * 1.4, SUN_RADIUS * 1.4, 1); // Gradual size increase
    sunGroup.add(sunHalo);

    // Outer corona
    const sunCorona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunTexture,
        color: 0xffaa00,
        opacity: 0.12,  // Subtle outer glow
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      })
    );
    sunCorona.scale.set(SUN_RADIUS * 1.7, SUN_RADIUS * 1.7, 1); // Intermediate corona
    sunGroup.add(sunCorona);

    // Additional intermediate layer for smoother transition
    const sunMidCorona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunTexture,
        color: 0xff9900,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      })
    );
    sunMidCorona.scale.set(SUN_RADIUS * 2.0, SUN_RADIUS * 2.0, 1); // Between corona and outer
    sunGroup.add(sunMidCorona);

    // Extra outer halo for more glow
    const sunOuterHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunTexture,
        color: 0xff7700,
        opacity: 0.04,  // Very subtle
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      })
    );
    sunOuterHalo.scale.set(SUN_RADIUS * 2.5, SUN_RADIUS * 2.5, 1); // Large faint halo
    sunGroup.add(sunOuterHalo);

    // Point light for glow and additional illumination
    const sunPointLight = new THREE.PointLight(0xffcc66, 1.5, MARS_ORBIT_RADIUS * 1.5, 2); // Brighter and further reach for new scale
    sunGroup.add(sunPointLight);

    // Create lens flare system
    const lensFlareSystem = new LensFlareSystem();
    scene.add(lensFlareSystem.getGroup());

    // ---------- EARTH STACK (per architecture) ----------

    // Get initial biome settings from store
    const initialBiomeMode = storeRef.current.getState().biomeMode;
    prevBiomeModeRef.current = initialBiomeMode;

    // Create biome generator if seed provided
    if (seed) {
      biomeGeneratorRef.current = new BiomeGenerator(seed, world.width, world.height);
    }

    // Create planet with unified factory
    const earth = makePlanet({
      radius: PLANET_RADIUS,
      atmosphereThickness: ATMOSPHERE_THICKNESS,
      anisotropy: 0.7,
      exposure: 1.2,
      atmosphereColor: new THREE.Color(0x78a6ff),
      mieColor: new THREE.Color(0xfff2d1),
      biomeGenerator: biomeGeneratorRef.current || undefined,
      biomeMode: initialBiomeMode === 'highlight' ? 'highlight' : 'natural',
    });
    earthRef.current = earth; // Store reference for later updates

    // Add the earth group - will be positioned at saved position
    scene.add(earth.group);
    // Earth starts at saved position (close-up view of surface)
    earth.group.position.set(49.79808714103889, 0, 4.488932734347621);
    earth.group.rotation.set(0, 0.4494984999999405, 0.41015237421866746);
    // Enable shadow casting and receiving for Earth
    if (earth.meshes.planetMesh) {
      earth.meshes.planetMesh.castShadow = true;
      earth.meshes.planetMesh.receiveShadow = true;
    }

    // Multi-layer cloud system with shadows
    const cloudSystem = createMultiLayerClouds(PLANET_RADIUS);
    // Add all cloud layers to earth group
    earth.group.add(cloudSystem.group);

    // For backward compatibility, reference the middle layer as main clouds
    const clouds = cloudSystem.layers[1].mesh; // Middle stratus layer

    // Local render orders are already set in component creation

    // Control initial visibility
    if (earth.meshes.atmosphereMesh) {
      earth.meshes.atmosphereMesh.visible = storeRef.current.getState().showAtmosphere;
    }

    // Skip atmosphere depth prepass for now - focus on getting basic rendering working
    let atmoDepth: THREE.Mesh | undefined;

    // ---------- VENUS (closer to sun) ----------
    const venus = makeVenus();
    venus.group.position.set(27.634201737970393, 0, 4.511196549160116); // Saved position
    scene.add(venus.group);

    // ---------- MARS (further from sun) ----------
    const mars = makeMars();
    mars.group.position.set(74.89092004441893, 0, 4.043525058714209); // Saved position
    scene.add(mars.group);
    // Add Mars' moons to scene - TEMPORARILY DISABLED FOR DEBUGGING
    // scene.add(mars.phobos);
    // scene.add(mars.deimos);

    // ---------- MOON (using proper component) ----------
    const moonResult = makeMoon(PLANET_RADIUS);
    const moon = moonResult.mesh;
    moon.name = 'Moon';
    // Enable shadow casting and receiving for Moon
    moon.castShadow = true;
    moon.receiveShadow = true;
    // Set initial moon position
    moon.position.set(50.679984798912, 0.34954035589491184, 8.374814624039942);
    // Add moon directly to scene, not to earth group
    scene.add(moon);

    // ---------- ENHANCED STARFIELD BACKGROUND ----------
    const starfieldState = storeRef.current.getState();
    const starfield = createEnhancedStarfield({
      starCount: starfieldState.starCount,
      radius: 8000,
      densityVariation: true,
      milkyWayBand: starfieldState.showMilkyWay,
      sizeRange: [0.5, 3.0],
      colorVariation: true,
      twinkleEffect: starfieldState.showTwinkle,
      twinkleIntensity: starfieldState.twinkleIntensity,
      useLOD: true,
      frustumCulling: true,
    });
    scene.add(starfield.group);

    // ---------- NEBULA CLOUDS (Optional) ----------
    const nebulae = starfieldState.showNebulae ? createNebulaClouds(9000) : undefined;
    if (nebulae) {
      scene.add(nebulae.group);
    }

    // ---------- ASTEROID BELT ----------
    // Create asteroid belt between Mars and where Jupiter would be
    const ASTEROID_BELT_INNER = MARS_ORBIT_RADIUS * 1.6;  // Start further from Mars
    const ASTEROID_BELT_OUTER = MARS_ORBIT_RADIUS * 2.5;  // Extend further out

    const spaceDust = createSpaceDust({
      count: 30000,  // Much denser asteroid field
      radius: ASTEROID_BELT_OUTER,
      innerRadius: ASTEROID_BELT_INNER,
      intensity: 0.6,  // Brighter for better visibility
      heightRange: 8,  // Slightly thicker disk
      isRing: true,  // Make it a ring in the orbital plane
      sizeRange: [0.8, 3.0]  // Slightly larger particles for asteroids
    });
    scene.add(spaceDust.mesh);

    // ---------- VOLUMETRIC DUST (god rays) ----------
    const volumetricDust = createVolumetricDust({
      count: 15000,  // More particles for larger area
      sunRadius: SUN_RADIUS * 10,  // Match new sun scale
      spread: MARS_ORBIT_RADIUS * 1.3,  // Cover entire system
      intensity: 0.4
    });
    scene.add(volumetricDust.mesh);

    // ---------- AURORA BOREALIS ----------
    const aurora = createAuroraEffect(PLANET_RADIUS);
    earth.group.add(aurora.mesh); // Add to earth group so it rotates with planet

    // ---------- LENS FLARE ----------
    // Removed - was causing issues with positioning

    // ---------- DEBUG: POLE MARKERS (SUPER OBVIOUS) ----------
    // North pole marker (BRIGHT RED arrow pointing up)
    const northPoleArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0), // Direction (up)
      new THREE.Vector3(0, PLANET_RADIUS, 0), // Start right at north pole surface
      PLANET_RADIUS * 1.5, // VERY LONG arrow
      0xff0000, // Bright red color
      PLANET_RADIUS * 0.4, // Large head
      PLANET_RADIUS * 0.2 // Wide head
    );
    northPoleArrow.visible = true; // ALWAYS VISIBLE FOR DEBUG
    earth.group.add(northPoleArrow); // Add to earth group so it rotates with planet

    // Add a cylinder at north pole for extra visibility
    const northPoleCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(PLANET_RADIUS * 0.05, PLANET_RADIUS * 0.05, PLANET_RADIUS * 2, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    northPoleCylinder.position.y = PLANET_RADIUS;
    northPoleCylinder.visible = true;
    earth.group.add(northPoleCylinder);

    // South pole marker (BRIGHT BLUE arrow pointing down)
    const southPoleArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, -1, 0), // Direction (down)
      new THREE.Vector3(0, -PLANET_RADIUS, 0), // Start right at south pole surface
      PLANET_RADIUS * 1.5, // VERY LONG arrow
      0x00ffff, // Bright cyan color
      PLANET_RADIUS * 0.4, // Large head
      PLANET_RADIUS * 0.2 // Wide head
    );
    southPoleArrow.visible = true; // ALWAYS VISIBLE FOR DEBUG
    earth.group.add(southPoleArrow); // Add to earth group so it rotates with planet

    // Add a cylinder at south pole for extra visibility
    const southPoleCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(PLANET_RADIUS * 0.05, PLANET_RADIUS * 0.05, PLANET_RADIUS * 2, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ffff })
    );
    southPoleCylinder.position.y = -PLANET_RADIUS;
    southPoleCylinder.visible = true;
    earth.group.add(southPoleCylinder);

    // ---------- PLANETARY DUST RING for shadow shafts ----------
    // Disabled - was creating unwanted ring appearance around Earth
    // const dustRing = createPlanetaryDustRing(PLANET_RADIUS, {
    //   count: 2500,  // More particles
    //   intensity: 0.35  // Slightly brighter
    // });
    // // Add dust ring to earth group so it follows the planet
    // earth.group.add(dustRing.mesh);
    const dustRing = undefined;

    // No need for sanity checks - materials are configured correctly in their components


    // Clock for animation
    const clock = new THREE.Clock();

    // Store refs (clouds temporarily null for debugging)
    sceneRef.current = {
      renderer,
      composer,
      bloomPass,
      scene,
      camera,
      controls,
      earth,
      venus,
      mars,
      entities: null,
      clouds: clouds,
      cloudSystem,
      moon,
      sun,
      clock,
      axisHelper,
      atmoDepth,
      spaceDust,
      dustRing,
      starfield,
      nebulae,
      volumetricDust,
      aurora,
      lensFlareSystem,
      northPoleArrow,
      southPoleArrow,
      northPoleCylinder,
      southPoleCylinder
    };

    // ---------- RESIZE ----------
    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      composer.setSize(w, h);
      bloomPass.resolution.set(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      controls.dispose();
      composer.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, []);

  // Initialize entities when buffers are ready (renderOrder 1 between surface and clouds)
  useEffect(() => {
    if (!sceneRef.current || sceneRef.current.entities) return;

    const initializeEntities = () => {
      if (!client.buffers?.pos || !sceneRef.current) return;

      const entityCount = client.buffers.count;
      // Pass the color buffer directly from SharedArrayBuffer
      const entities = makeGroundEntities(entityCount, client.buffers.color || undefined);
      // Add entities to earth group for proper layering
      sceneRef.current.earth.group.add(entities);
      sceneRef.current.entities = entities;

      // Create biome boundaries if biome generator exists
      if (biomeGeneratorRef.current) {
        const store = usePlanet3DStore.getState();
        const boundaries = createBiomeBoundaries(biomeGeneratorRef.current, world.width, world.height);
        boundaries.visible = store.showBiomeBoundaries;
        sceneRef.current.earth.group.add(boundaries);
        sceneRef.current.boundaries = boundaries;
      }

      // Create food overlay if food buffers exist
      if (client.buffers.food && client.buffers.foodCols && client.buffers.foodRows) {
        const store = usePlanet3DStore.getState();
        const foodOverlay = createFoodOverlay3D({
          foodData: client.buffers.food,
          cols: client.buffers.foodCols,
          rows: client.buffers.foodRows,
          radius: PLANET_RADIUS,
          opacity: 0.9 // Higher opacity for better visibility
        });
        foodOverlay.mesh.visible = store.showFoodOverlay;
        sceneRef.current.earth.group.add(foodOverlay.mesh);
        sceneRef.current.foodOverlay = foodOverlay;
      }
    };

    // Check if buffers exist immediately
    if (client.buffers?.pos) {
      initializeEntities();
    }

    // Listen for ready message
    const unsubscribe = client.onMessage((msg) => {
      if (msg.type === 'ready' && !sceneRef.current?.entities) {
        initializeEntities();
      }
    });

    return () => {
      unsubscribe();
      // Clean up food overlay on unmount
      if (sceneRef.current?.foodOverlay) {
        sceneRef.current.foodOverlay.dispose();
      }
    };
  }, [client, world]);

  // Force resize when sidebar states change
  useEffect(() => {
    if (!sceneRef.current) return;

    // Give the DOM time to update layout
    const timer = setTimeout(() => {
      const mount = mountRef.current;
      if (!mount || !sceneRef.current) return;

      const { renderer, camera } = sceneRef.current;
      const w = mount.clientWidth;
      const h = mount.clientHeight;

      // Force update renderer and camera
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }, 100); // Small delay to ensure DOM has updated

    return () => clearTimeout(timer);
  }, [setupSidebarCollapsed, statsSidebarCollapsed, controlsHidden]);

  // Save/Restore functionality
  const saveSceneState = useCallback(() => {
    if (!sceneRef.current) return;

    const refs = sceneRef.current;
    const state = {
      camera: {
        position: refs.camera.position.toArray(),
        rotation: refs.camera.rotation.toArray(),
        fov: refs.camera.fov,
      },
      controls: {
        target: refs.controls.target.toArray(),
      },
      earth: {
        position: refs.earth.group.position.toArray(),
        rotation: refs.earth.group.rotation.toArray(),
      },
      moon: refs.moon ? {
        position: refs.moon.position.toArray(),
      } : null,
      venus: refs.venus ? {
        position: refs.venus.group.position.toArray(),
      } : null,
      mars: refs.mars ? {
        position: refs.mars.group.position.toArray(),
      } : null,
      time: refs.clock.elapsedTime,
      planet3DSettings: storeRef.current.getState(),
      timestamp: Date.now(),
    };

    // Save to localStorage
    localStorage.setItem('gene-sim-scene-state', JSON.stringify(state));

    // Log to console for debugging
    console.log('Scene state saved:', state);
    console.log('Camera position:', state.camera.position);
    console.log('Camera target:', state.controls.target);
  }, []);

  const restoreSceneState = useCallback(() => {
    if (!sceneRef.current) return;

    const savedState = localStorage.getItem('gene-sim-scene-state');
    if (!savedState) {
      console.log('No saved state found');
      return;
    }

    try {
      const state = JSON.parse(savedState);
      const refs = sceneRef.current;

      // Restore camera
      refs.camera.position.fromArray(state.camera.position);
      refs.camera.rotation.fromArray(state.camera.rotation);
      refs.camera.fov = state.camera.fov;
      refs.camera.updateProjectionMatrix();

      // Restore controls
      refs.controls.target.fromArray(state.controls.target);
      refs.controls.update();

      // Restore planet positions
      refs.earth.group.position.fromArray(state.earth.position);
      refs.earth.group.rotation.fromArray(state.earth.rotation);

      if (refs.moon && state.moon) {
        refs.moon.position.fromArray(state.moon.position);
      }

      if (refs.venus && state.venus) {
        refs.venus.group.position.fromArray(state.venus.position);
      }

      if (refs.mars && state.mars) {
        refs.mars.group.position.fromArray(state.mars.position);
      }

      // Restore Planet3D settings
      if (state.planet3DSettings) {
        const store = storeRef.current.getState();
        // Only restore view-related settings, not all settings
        store.setShowEntities(state.planet3DSettings.showEntities);
        store.setShowAtmosphere(state.planet3DSettings.showAtmosphere);
        store.setShowClouds(state.planet3DSettings.showClouds);
        store.setCameraTarget(state.planet3DSettings.cameraTarget);
        store.setCameraMode(state.planet3DSettings.cameraMode);
      }

      console.log('Scene state restored from:', new Date(state.timestamp).toLocaleString());
      console.log('Camera position:', state.camera.position);
      console.log('Camera target:', state.controls.target);
    } catch (error) {
      console.error('Failed to restore scene state:', error);
    }
  }, []);

  // Auto-restore disabled - using hardcoded default view instead
  // useEffect(() => {
  //   // Wait for scene to be fully initialized
  //   const timer = setTimeout(() => {
  //     if (sceneRef.current && localStorage.getItem('gene-sim-scene-state')) {
  //       console.log('Auto-restoring saved scene state...');
  //       restoreSceneState();
  //     }
  //   }, 1000);
  //
  //   return () => clearTimeout(timer);
  // }, [restoreSceneState]);

  // Expose functions to parent component and add keyboard shortcuts
  useEffect(() => {
    // Store functions in window for global access (temporary solution)
    (window as any).saveSceneState = saveSceneState;
    (window as any).restoreSceneState = restoreSceneState;

    // Add keyboard shortcuts
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        saveSceneState();
      } 
      // else if (e.key === 'r' || e.key === 'R') {
      //   e.preventDefault();
      //   restoreSceneState();
      // }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      delete (window as any).saveSceneState;
      delete (window as any).restoreSceneState;
    };
  }, [saveSceneState, restoreSceneState]);

  // Animation loop
  useEffect(() => {
    if (!sceneRef.current) return;

    let animationId: number;
    let t = 0;
    let frameCount = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const refs = sceneRef.current;
      if (!refs) return;

      frameCount++;

      const dt = refs.clock.getDelta();
      if (!isPaused) {
        t += dt;
      }

      // Update visibility based on dev controls
      const planet3DState = storeRef.current.getState();

      // Distance-based culling for performance
      // Calculate screen size more accurately using FOV
      const cameraDistance = refs.camera.position.distanceTo(refs.earth.group.position);
      const vFOV = (refs.camera.fov * Math.PI) / 180; // Convert to radians
      const heightAtDistance = 2 * Math.tan(vFOV / 2) * cameraDistance;
      const pixelsPerUnit = window.innerHeight / heightAtDistance;
      const planetScreenSize = PLANET_RADIUS * 2 * pixelsPerUnit; // Diameter in pixels

      // Define LOD thresholds for smooth transitions
      const LOD_THRESHOLDS = {
        entities: 100,      // Show entities when planet > 100 pixels
        clouds: 20,         // Show clouds when planet > 20 pixels  
        atmosphere: 30,     // Show atmosphere when planet > 30 pixels
        moonDetail: 15,     // Show moon when > 15 pixels
        planetDetail: 5,    // Minimum size to show planets
      };

      if (refs.earth?.meshes?.atmosphereMesh) {
        // Cull atmosphere when planet is very small on screen
        refs.earth.meshes.atmosphereMesh.visible = planet3DState.showAtmosphere && planetScreenSize > LOD_THRESHOLDS.atmosphere;
      }

      if (refs.atmoDepth) {
        refs.atmoDepth.visible = planet3DState.showAtmosphere && planetScreenSize > LOD_THRESHOLDS.atmosphere;
      }

      // Calculate moon screen size for culling
      if (refs.moon) {
        const moonDistance = refs.camera.position.distanceTo(refs.moon.position);
        const moonScreenSize = (PLANET_RADIUS * MOON_RADIUS * 2) * (window.innerHeight / (2 * Math.tan(vFOV / 2) * moonDistance));
        refs.moon.visible = planet3DState.showMoon && moonScreenSize > LOD_THRESHOLDS.moonDetail;
      }

      // Calculate Venus screen size
      if (refs.venus) {
        const venusDistance = refs.camera.position.distanceTo(refs.venus.group.position);
        const venusScreenSize = (PLANET_RADIUS * VENUS_RADIUS * 2) * (window.innerHeight / (2 * Math.tan(vFOV / 2) * venusDistance));
        refs.venus.group.visible = planet3DState.showVenus && venusScreenSize > LOD_THRESHOLDS.planetDetail;
      }

      // Calculate Mars screen size
      if (refs.mars) {
        const marsDistance = refs.camera.position.distanceTo(refs.mars.group.position);
        const marsScreenSize = (PLANET_RADIUS * MARS_RADIUS * 2) * (window.innerHeight / (2 * Math.tan(vFOV / 2) * marsDistance));
        refs.mars.group.visible = planet3DState.showMars && marsScreenSize > LOD_THRESHOLDS.planetDetail;
      }

      if (refs.cloudSystem) {
        // Cull clouds when planet is small on screen
        refs.cloudSystem.group.visible = planet3DState.showClouds && planetScreenSize > LOD_THRESHOLDS.clouds;
      }

      if (refs.clouds) {
        // Backward compatibility
        refs.clouds.visible = planet3DState.showClouds && planetScreenSize > LOD_THRESHOLDS.clouds;
      }

      if (refs.entities) {
        // Cull entities when they would be smaller than 0.5 pixels
        refs.entities.visible = planet3DState.showEntities && planetScreenSize > LOD_THRESHOLDS.entities;
      }

      if (refs.axisHelper) {
        refs.axisHelper.visible = planet3DState.showDebug;
      }
      if (refs.testSphere) {
        refs.testSphere.visible = planet3DState.showDebug;
      }
      // Update pole markers visibility
      const showPoleMarkers = storeRef.current.getState().showPoleMarkers;
      if (refs.northPoleArrow) {
        refs.northPoleArrow.visible = showPoleMarkers;
      }
      if (refs.southPoleArrow) {
        refs.southPoleArrow.visible = showPoleMarkers;
      }
      if (refs.northPoleCylinder) {
        refs.northPoleCylinder.visible = showPoleMarkers;
      }
      if (refs.southPoleCylinder) {
        refs.southPoleCylinder.visible = showPoleMarkers;
      }

      // Control sun visibility
      const sunGroup = refs.scene.getObjectByName('SunGroup');
      if (sunGroup) {
        sunGroup.visible = planet3DState.showSun;
      }

      // Update lens flare
      if (refs.lensFlareSystem) {
        refs.lensFlareSystem.setEnabled(planet3DState.showLensFlare && planet3DState.showSun);
        refs.lensFlareSystem.setIntensity(planet3DState.lensFlareIntensity);
        // Update lens flare position relative to sun (sun is at origin)
        refs.lensFlareSystem.update(refs.camera, new THREE.Vector3(0, 0, 0));
      }

      // Update bloom effect
      if (refs.bloomPass) {
        refs.bloomPass.enabled = planet3DState.showBloom;
        refs.bloomPass.strength = planet3DState.bloomIntensity;
        refs.bloomPass.threshold = planet3DState.bloomThreshold;
      }

      // Update atmosphere intensity
      if (refs.earth && refs.earth.uniforms && refs.earth.uniforms.atmUniforms) {
        refs.earth.uniforms.atmUniforms.uExposure.value = planet3DState.atmosphereIntensity;
      }

      // Handle camera planet transition animation
      const transition = cameraTransitionRef.current;
      if (transition && transition.active) {
        const elapsed = performance.now() - transition.startTime;
        const progress = Math.min(elapsed / transition.duration, 1);

        // Easing function (ease-in-out-cubic)
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        // Interpolate camera position and target
        refs.camera.position.lerpVectors(transition.fromPos, transition.toPos, eased);
        refs.controls.target.lerpVectors(transition.fromTarget, transition.toTarget, eased);

        // End animation
        if (progress >= 1) {
          transition.active = false;
        }
      }

      // Handle cinematic zoom animation - ensure no conflicts with transitions
      const anim = cinematicAnimationRef.current;
      if (anim && anim.active && !(transition && transition.active)) { // Clearer condition to prevent conflicts
        const elapsed = performance.now() - anim.startTime;
        const progress = Math.min(elapsed / anim.duration, 1);

        // Easing function (ease-in-out-power3 for more dramatic effect)
        const eased = progress < 0.5
          ? 8 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        // Calculate new distance
        const newDistance = anim.from + (anim.to - anim.from) * eased;

        // Apply zoom with rotation for cinematic effect
        const currentRotation = anim.startRotation + (anim.rotationAmount * eased);
        const direction = new THREE.Vector3(
          Math.sin(currentRotation) * Math.cos(0.3), // Slight vertical angle
          Math.sin(0.3),
          Math.cos(currentRotation) * Math.cos(0.3)
        ).normalize();

        refs.camera.position.copy(refs.controls.target).addScaledVector(direction, newDistance);
        refs.camera.lookAt(refs.controls.target);

        // Smoothly adjust FOV for dramatic effect
        if (anim.fromFov && anim.toFov) {
          const newFov = anim.fromFov + (anim.toFov - anim.fromFov) * eased;
          refs.camera.fov = newFov;
          refs.camera.updateProjectionMatrix();
        }

        // Disable user controls during animation
        refs.controls.enabled = progress >= 1;

        // End animation
        if (progress >= 1) {
          anim.active = false;
          refs.controls.enabled = true; // Re-enable controls
          // Reset FOV to default
          refs.camera.fov = CAMERA_CONFIG.fov;
          refs.camera.updateProjectionMatrix();
        }
      }

      // Update controls - disabled during both cinematic zoom and camera transitions
      refs.controls.enabled = !cinematicAnimationRef.current?.active && !cameraTransitionRef.current?.active;
      refs.controls.update();

      // Planetary orbit mechanics on ecliptic plane (controlled by orbital mode and pause)
      const earthPos = new THREE.Vector3(0, 0, 0);
      const venusPos = new THREE.Vector3(0, 0, 0);
      const marsPos = new THREE.Vector3(0, 0, 0);

      if (planet3DState.orbitalMode) {
        if (!planet3DState.pauseOrbits) {
          const orbitTime = refs.clock.elapsedTime * planet3DState.orbitalSpeed;  // Apply speed multiplier

          // Venus orbit (closer, faster)
          if (refs.venus) {
            const vx = Math.cos(orbitTime * VENUS_ORBIT_SPEED) * VENUS_ORBIT_RADIUS;
            const vz = Math.sin(orbitTime * VENUS_ORBIT_SPEED) * VENUS_ORBIT_RADIUS;
            venusPos.set(vx, 0, vz);
            refs.venus.group.position.copy(venusPos);
            // Venus rotation (retrograde and very slow)
            refs.venus.group.rotation.y = orbitTime * VENUS_ROTATION_SPEED;
          }

          // Earth orbits in the ecliptic plane (XZ plane, Y=0)
          const ex = Math.cos(orbitTime * EARTH_ORBIT_SPEED) * EARTH_ORBIT_RADIUS;
          const ez = Math.sin(orbitTime * EARTH_ORBIT_SPEED) * EARTH_ORBIT_RADIUS;
          earthPos.set(ex, 0, ez);  // Ecliptic plane
          refs.earth.group.position.copy(earthPos);

          // Mars orbit (further, slower)
          if (refs.mars) {
            const mx = Math.cos(orbitTime * MARS_ORBIT_SPEED) * MARS_ORBIT_RADIUS;
            const mz = Math.sin(orbitTime * MARS_ORBIT_SPEED) * MARS_ORBIT_RADIUS;
            marsPos.set(mx, 0, mz);
            refs.mars.group.position.copy(marsPos);
            // Mars rotation (similar to Earth)
            refs.mars.group.rotation.y = orbitTime * MARS_ROTATION_SPEED;

            // Mars' moons orbits (Phobos and Deimos) - TEMPORARILY DISABLED FOR DEBUGGING
            // if (refs.mars.phobos) {
            //   const phobosAngle = orbitTime * 0.8; // Very fast orbit
            //   refs.mars.phobos.position.set(
            //     marsPos.x + Math.cos(phobosAngle) * MARS_RADIUS * 2.5,
            //     marsPos.y,
            //     marsPos.z + Math.sin(phobosAngle) * MARS_RADIUS * 2.5
            //   );
            // }
            // if (refs.mars.deimos) {
            //   const deimosAngle = orbitTime * 0.3; // Slower orbit
            //   refs.mars.deimos.position.set(
            //     marsPos.x + Math.cos(deimosAngle) * MARS_RADIUS * 4,
            //     marsPos.y + Math.sin(deimosAngle) * MARS_RADIUS * 0.5, // Slight inclination
            //     marsPos.z + Math.sin(deimosAngle) * MARS_RADIUS * 4
            //   );
            // }
          }
        } else {
          // When paused, maintain current positions
          earthPos.copy(refs.earth.group.position);
          if (refs.venus) venusPos.copy(refs.venus.group.position);
          if (refs.mars) marsPos.copy(refs.mars.group.position);
        }
      } else {
        // When orbital mode is off, planets stay at initial positions
        earthPos.set(EARTH_ORBIT_RADIUS, 0, 0);
        refs.earth.group.position.copy(earthPos);
        if (refs.venus) {
          venusPos.set(VENUS_ORBIT_RADIUS, 0, 0);
          refs.venus.group.position.copy(venusPos);
        }
        if (refs.mars) {
          marsPos.set(MARS_ORBIT_RADIUS, 0, 0);
          refs.mars.group.position.copy(marsPos);
        }
      }

      // Geostationary camera mode - maintains position relative to target planet's surface
      if (planet3DState.cameraMode === 'geostationary') {
        // Get the target planet's position and rotation speed
        let targetPos = new THREE.Vector3();
        let rotationSpeed = 0;

        switch (planet3DState.cameraTarget) {
          case 'earth':
            targetPos = earthPos;
            rotationSpeed = EARTH_ROTATION_SPEED;
            break;
          case 'mars':
            targetPos = marsPos;
            rotationSpeed = MARS_ROTATION_SPEED;
            break;
          case 'venus':
            targetPos = venusPos;
            rotationSpeed = VENUS_ROTATION_SPEED;
            break;
          case 'moon':
            // Moon is tidally locked, so its rotation matches its orbit
            targetPos.set(
              earthPos.x + Math.cos(refs.clock.elapsedTime * MOON_ORBIT_SPEED * planet3DState.orbitalSpeed) * MOON_ORBIT_RADIUS,
              earthPos.y + Math.sin(refs.clock.elapsedTime * MOON_ORBIT_SPEED * planet3DState.orbitalSpeed) * MOON_ORBIT_RADIUS * Math.sin(MOON_ORBITAL_INCLINATION),
              earthPos.z + Math.sin(refs.clock.elapsedTime * MOON_ORBIT_SPEED * planet3DState.orbitalSpeed) * MOON_ORBIT_RADIUS * Math.cos(MOON_ORBITAL_INCLINATION)
            );
            rotationSpeed = MOON_ORBIT_SPEED; // Moon rotates at same speed as orbit
            break;
          case 'sun':
            targetPos.set(0, 0, 0);
            rotationSpeed = 0.01; // Sun rotates slowly
            break;
          default:
            targetPos = earthPos;
            rotationSpeed = EARTH_ROTATION_SPEED;
        }

        // Calculate current camera position relative to target
        const cameraRelativePos = refs.camera.position.clone().sub(targetPos);
        const currentDistance = cameraRelativePos.length();

        // Calculate the current angle of the camera relative to Earth's center
        const currentAngle = Math.atan2(cameraRelativePos.z, cameraRelativePos.x);

        // If we haven't stored the geostationary offset yet, or if target changed, initialize it
        if (!geostationaryOffsetRef.current || geostationaryOffsetRef.current.target !== planet3DState.cameraTarget) {
          const currentRotation = planet3DState.pauseOrbits ? 0 : refs.clock.elapsedTime * rotationSpeed * planet3DState.orbitalSpeed;
          geostationaryOffsetRef.current = {
            angle: currentAngle - currentRotation,
            height: cameraRelativePos.y,
            distance: Math.sqrt(cameraRelativePos.x * cameraRelativePos.x + cameraRelativePos.z * cameraRelativePos.z),
            target: planet3DState.cameraTarget
          };
        }

        // Update the stored offset whenever the user moves the camera
        // This makes the new position the geostationary reference point
        const currentRotation = planet3DState.pauseOrbits ? 0 : refs.clock.elapsedTime * rotationSpeed * planet3DState.orbitalSpeed;
        const expectedAngle = geostationaryOffsetRef.current.angle + currentRotation;
        const angleDiff = Math.abs(currentAngle - expectedAngle);

        // If camera has moved significantly (user dragged it), update the reference
        if (angleDiff > 0.01 || Math.abs(currentDistance - geostationaryOffsetRef.current.distance) > 1) {
          geostationaryOffsetRef.current = {
            angle: currentAngle - currentRotation,
            height: cameraRelativePos.y,
            distance: Math.sqrt(cameraRelativePos.x * cameraRelativePos.x + cameraRelativePos.z * cameraRelativePos.z),
            target: planet3DState.cameraTarget
          };
        }

        // Apply the geostationary rotation for the target planet (only if orbits aren't paused)
        // The camera needs to rotate WITH the planet to maintain view of the same spot
        const planetRotation = planet3DState.pauseOrbits ? 0 : refs.clock.elapsedTime * rotationSpeed * planet3DState.orbitalSpeed;
        const geostationaryAngle = geostationaryOffsetRef.current.angle + planetRotation;

        // Calculate new position that maintains the same relative position to planet's surface
        const newCameraPos = new THREE.Vector3(
          targetPos.x + Math.cos(geostationaryAngle) * geostationaryOffsetRef.current.distance,
          targetPos.y + geostationaryOffsetRef.current.height,
          targetPos.z + Math.sin(geostationaryAngle) * geostationaryOffsetRef.current.distance
        );

        // Apply the position (no lerping - direct positioning for precise geostationary orbit)
        refs.camera.position.copy(newCameraPos);
        refs.controls.target.copy(targetPos);
      } else {
        // Reset geostationary offset when switching to free mode
        geostationaryOffsetRef.current = null;
      }

      // Camera tracking for selected planet (smooth following)
      if (planet3DState.followEarth && planet3DState.orbitalMode && !cameraTransitionRef.current?.active && planet3DState.cameraMode !== 'geostationary') {
        // Get the target position based on current camera target
        let targetPlanetPos = new THREE.Vector3();

        switch (planet3DState.cameraTarget) {
          case 'sun':
            targetPlanetPos.set(0, 0, 0);
            break;
          case 'venus':
            targetPlanetPos.copy(venusPos);
            break;
          case 'earth':
            targetPlanetPos.copy(earthPos);
            break;
          case 'mars':
            targetPlanetPos.copy(marsPos);
            break;
          case 'moon':
            if (refs.moon) {
              refs.moon.getWorldPosition(targetPlanetPos);
            }
            break;
        }

        // Maintain current camera offset from target
        const currentOffset = new THREE.Vector3().subVectors(refs.camera.position, refs.controls.target);

        // Smoothly interpolate target and camera positions
        const lerpFactor = Math.min(1.0, dt * 2.0); // Smooth following
        refs.controls.target.lerp(targetPlanetPos, lerpFactor);

        const newCameraPos = targetPlanetPos.clone().add(currentOffset);
        refs.camera.position.lerp(newCameraPos, lerpFactor);
      }

      // Spin Earth with proper axial tilt relative to ecliptic plane
      // Earth's rotation axis is tilted 23.5° from perpendicular to ecliptic
      if (!refs.earth.group.userData.tiltApplied) {
        // Apply axial tilt: Earth's axis tilted relative to its orbital plane (ecliptic)
        refs.earth.group.rotation.z = AXIAL_TILT;  // 23.5° tilt from ecliptic normal
        refs.earth.group.userData.tiltApplied = true;
      }
      // Rotate Earth on its tilted axis (pause if orbital mechanics are paused)
      if (!planet3DState.pauseOrbits) {
        refs.earth.group.rotation.y = refs.clock.elapsedTime * EARTH_ROTATION_SPEED * planet3DState.orbitalSpeed;
      }

      // Moon orbit around Earth with 5.14° inclination from ecliptic
      if (!planet3DState.pauseOrbits) {
        const moonTime = refs.clock.elapsedTime * planet3DState.orbitalSpeed;  // Apply speed multiplier
        // Moon's orbit is tilted 5.14° from the ecliptic plane
        const moonAngle = moonTime * MOON_ORBIT_SPEED;
        const mx = Math.cos(moonAngle) * MOON_ORBIT_RADIUS;
        const my = Math.sin(moonAngle) * MOON_ORBIT_RADIUS * Math.sin(MOON_ORBITAL_INCLINATION);  // Y component from inclination
        const mz = Math.sin(moonAngle) * MOON_ORBIT_RADIUS * Math.cos(MOON_ORBITAL_INCLINATION);  // Z component
        // Position moon relative to Earth's current position with proper orbital inclination
        refs.moon.position.set(
          earthPos.x + mx,
          earthPos.y + my,  // Moon's orbit has vertical component due to inclination
          earthPos.z + mz
        );

        // Tidal locking - moon rotates once per orbit to always show same face to Earth
        // The rotation needs to match the orbital position
        refs.moon.rotation.y = moonAngle + Math.PI / 2; // PI/2 offset to orient the same face toward Earth
      }

      // Update sun's light to shine from origin (sun position) toward Earth
      // Position the directional light "behind" the sun looking at Earth
      const sunToEarth = new THREE.Vector3().subVectors(earthPos, new THREE.Vector3(0, 0, 0)).normalize();
      // Place light source behind sun position pointing toward Earth
      refs.sun.position.copy(sunToEarth.clone().multiplyScalar(-500)); // Behind sun
      refs.sun.position.y += 200; // Slight elevation for better angle
      refs.sun.target.position.copy(earthPos);
      refs.sun.target.updateMatrixWorld();

      // Feed sun direction to Earth materials (from origin to Earth)
      refs.earth.uniforms.shared.uLightDir.value.copy(sunToEarth); // Direction from sun to earth

      // Update shaders (now using cloudRotationSpeed properly)
      refs.earth.update({
        delta: dt,
        time: refs.clock.elapsedTime,
        directionalLight: refs.sun,
        cloudRotationSpeed: CLOUD_ROTATION_SPEED
      });

      // Update all cloud layers
      if (refs.cloudSystem) {
        refs.cloudSystem.layers.forEach((layer) => {
          layer.update(
            refs.clock.elapsedTime,
            refs.earth.uniforms.shared.uLightDir.value,
            planet3DState.pauseClouds
          );
        });
      }

      // Update single cloud layer for backward compatibility
      if (refs.clouds) {
        const cloudMaterial = refs.clouds.material as THREE.ShaderMaterial;
        if (cloudMaterial.uniforms) {
          cloudMaterial.uniforms.uLightDir.value.copy(refs.earth.uniforms.shared.uLightDir.value);
          cloudMaterial.uniforms.uTime.value = refs.clock.elapsedTime;
          cloudMaterial.uniforms.uPaused.value = planet3DState.pauseClouds ? 1 : 0;  // Set pause state
        }
      }

      // Force shadow map update to ensure moon shadows are visible
      refs.sun.shadow.needsUpdate = true;

      // Update space dust with light direction and camera position
      if (refs.spaceDust) {
        refs.spaceDust.mesh.visible = storeRef.current.getState().showSpaceDust;
        refs.spaceDust.update(
          refs.clock.elapsedTime * 1000,
          sunToEarth,
          refs.camera.position
        );
      }

      // Update volumetric dust for god rays effect
      if (refs.volumetricDust) {
        refs.volumetricDust.mesh.visible = storeRef.current.getState().showVolumetricDust;
        refs.volumetricDust.update({
          time: refs.clock.elapsedTime * 1000,
          sunPos: new THREE.Vector3(0, 0, 0), // Sun at origin
          cameraPos: refs.camera.position,
          planetPos: earthPos,
          planetRadius: PLANET_RADIUS,
          moonPos: refs.moon.position,
          moonRadius: PLANET_RADIUS * MOON_RADIUS  // Scale moon radius relative to planet
        });
      }

      // Update aurora effect
      if (refs.aurora) {
        refs.aurora.mesh.visible = storeRef.current.getState().showAurora;
        refs.aurora.update(
          refs.clock.elapsedTime * 1000,
          sunToEarth,
          refs.camera.position
        );
      }

      // Update starfield - rebuild if configuration changed
      const starfieldState = storeRef.current.getState();
      if (refs.starfield) {
        refs.starfield.group.visible = starfieldState.showStarfield;

        // Check if we need to rebuild starfield (star count or Milky Way changed)
        // Note: This is a limitation - changing star count or Milky Way requires rebuilding
        // For now, just update what we can dynamically

        // Update twinkle animation
        if (starfieldState.showTwinkle && starfieldState.showStarfield) {
          refs.starfield.update(refs.clock.elapsedTime);
        }

        // Update twinkle intensity if changed
        refs.starfield.setTwinkleIntensity(starfieldState.twinkleIntensity);
      }

      // Handle nebulae - create or remove as needed
      if (starfieldState.showNebulae && !refs.nebulae) {
        // Create nebulae if needed
        const nebulae = createNebulaClouds(9000);
        refs.scene.add(nebulae.group);
        refs.nebulae = nebulae;
      } else if (!starfieldState.showNebulae && refs.nebulae) {
        // Remove nebulae if no longer needed
        refs.scene.remove(refs.nebulae.group);
        refs.nebulae = undefined;
      }

      // Update nebulae visibility and animation
      if (refs.nebulae) {
        refs.nebulae.group.visible = starfieldState.showNebulae;
        if (starfieldState.showNebulae) {
          refs.nebulae.update(t); // Animate nebula clouds
        }
      }

      // Lens flare removed due to positioning issues

      // Update planetary dust ring (disabled)
      // if (refs.dustRing) {
      //   refs.dustRing.update(
      //     refs.clock.elapsedTime * 1000,
      //     sunToEarth,
      //     refs.camera.position
      //   );
      // }

      // Update entities if they exist
      if (refs.entities && client.buffers) {
        const { pos, color, alive, count } = client.buffers;
        if (pos && color && alive) {
          updateEntitiesFromBuffers(
            refs.entities,
            pos,
            alive,
            count,
            world.width,
            world.height
          );
          // Update entity lighting - use the same light direction as atmosphere/clouds
          const entityMaterial = refs.entities.material as THREE.ShaderMaterial;
          if (entityMaterial.uniforms && entityMaterial.uniforms.uLightDir) {
            // Use the same light direction that's fed to the planet/atmosphere
            // This is already in world space and accounts for the tilt properly
            entityMaterial.uniforms.uLightDir.value.copy(refs.earth.uniforms.shared.uLightDir.value);
          } else if (frameCount % 60 === 0) {
            console.warn('Entity material missing uniforms or uLightDir!', {
              hasUniforms: !!entityMaterial.uniforms,
              uniforms: entityMaterial.uniforms
            });
          }
        }
      }

      // Update food overlay if it exists
      if (refs.foodOverlay && client.buffers?.food) {
        const showFoodOverlay = storeRef.current.getState().showFoodOverlay;
        refs.foodOverlay.update(client.buffers.food, refs.clock.elapsedTime);
        refs.foodOverlay.mesh.visible = showFoodOverlay && planetScreenSize > LOD_THRESHOLDS.entities;
      }

      // Track FPS
      fpsTracker.trackFrame();

      // Update stats panel
      if (statsRef.current) {
        statsRef.current.update();
      }

      // Use composer for rendering (handles bloom and other post-processing)
      refs.composer.render();
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [client, world, isPaused]); // Don't add controls to deps to avoid recreating animation loop

  // Sync props with planet3D store
  useEffect(() => {
    const store = usePlanet3DStore.getState();
    // Update store when props change
    if (biomeMode !== store.biomeMode) {
      store.setBiomeMode(biomeMode);
    }
  }, [biomeMode]);

  // Subscribe to boundary visibility changes from store
  useEffect(() => {
    const unsubscribe = usePlanet3DStore.subscribe(
      (state) => state.showBiomeBoundaries,
      (showBiomeBoundaries) => {
        if (sceneRef.current?.boundaries) {
          sceneRef.current.boundaries.visible = showBiomeBoundaries;
        }
      }
    );
    
    return unsubscribe;
  }, []);

  // Subscribe to food overlay visibility changes from store
  useEffect(() => {
    const unsubscribe = usePlanet3DStore.subscribe(
      (state) => state.showFoodOverlay,
      (showFoodOverlay) => {
        if (sceneRef.current?.foodOverlay) {
          sceneRef.current.foodOverlay.mesh.visible = showFoodOverlay;
        }
      }
    );
    
    return unsubscribe;
  }, []);

  // Handle biome mode changes (from either props or store)
  useEffect(() => {
    if (!sceneRef.current || !earthRef.current || !seed) return;

    // Check if mode actually changed
    if (prevBiomeModeRef.current === biomeMode) return;
    prevBiomeModeRef.current = biomeMode;

    // Simply update the biome mode on existing earth
    if (earthRef.current?.updateBiomeMode) {
      // Pass 'hidden' directly to updateBiomeMode when biomes are off
      earthRef.current.updateBiomeMode(
        biomeMode === 'hidden' ? 'hidden' : (biomeMode === 'highlight' ? 'highlight' : 'natural'),
        biomeGeneratorRef.current || undefined
      );
    }
  }, [biomeMode, seed]);

  // Cinematic zoom functions
  const handleZoomToSurface = useCallback(() => {
    if (!sceneRef.current) return;
    const { controls, camera } = sceneRef.current;

    // Get current distance
    const currentDistance = camera.position.distanceTo(controls.target);
    const targetDistance = PLANET_RADIUS * 1.5; // Safe distance above surface

    // Disable controls during animation
    controls.enabled = false;

    // Calculate current rotation angle
    const currentAngle = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);

    // Start animation with FOV change and rotation for dramatic effect
    cinematicAnimationRef.current = {
      startTime: performance.now(),
      duration: 2500, // 2.5 seconds
      from: currentDistance,
      to: targetDistance,
      fromFov: camera.fov,
      toFov: 35, // Narrower FOV for more dramatic close-up
      startRotation: currentAngle,
      rotationAmount: Math.PI * 0.25, // Quarter rotation during zoom in
      active: true
    };
  }, []);

  const handleZoomToSystem = useCallback(() => {
    if (!sceneRef.current) return;
    const { controls, camera } = sceneRef.current;

    // Get current distance
    const currentDistance = camera.position.distanceTo(controls.target);
    const targetDistance = CAMERA_CONFIG.maxDistance * 3; // Near maximum

    // Disable controls during animation
    controls.enabled = false;

    // Calculate current rotation angle
    const currentAngle = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);

    // Start animation with FOV change and rotation for wide view
    cinematicAnimationRef.current = {
      startTime: performance.now(),
      duration: 3000, // 3 seconds for zoom out
      from: currentDistance,
      to: targetDistance,
      fromFov: camera.fov,
      toFov: 60, // Wider FOV for system overview
      startRotation: currentAngle,
      rotationAmount: -Math.PI * 0.15, // Slight reverse rotation during zoom out
      active: true
    };
  }, []);

  // Add keyboard shortcuts for cinematic zoom
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case 'i':
          handleZoomToSurface();
          break;
        case 'o':
          handleZoomToSystem();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleZoomToSurface, handleZoomToSystem]);

  const handleCameraTargetChange = useCallback((target: 'sun' | 'venus' | 'earth' | 'mars' | 'moon') => {
    if (!sceneRef.current) return;
    const { controls, camera, venus, mars, earth, moon } = sceneRef.current;

    // Get target position based on selection
    let targetPos = new THREE.Vector3();
    let viewDistance = PLANET_RADIUS * 10; // Default view distance

    switch (target) {
      case 'sun':
        targetPos.set(0, 0, 0);
        viewDistance = SUN_RADIUS * 3;
        break;
      case 'venus':
        if (venus) targetPos.copy(venus.group.position);
        viewDistance = VENUS_RADIUS * 10;
        break;
      case 'earth':
        if (earth) targetPos.copy(earth.group.position);
        viewDistance = PLANET_RADIUS * 10;
        break;
      case 'mars':
        if (mars) targetPos.copy(mars.group.position);
        viewDistance = MARS_RADIUS * 15;
        break;
      case 'moon':
        if (moon) moon.getWorldPosition(targetPos);
        viewDistance = MOON_RADIUS * 20;
        break;
    }

    // Calculate camera position to maintain similar viewing angle
    const currentDir = camera.position.clone().sub(controls.target).normalize();
    const newCameraPos = targetPos.clone().addScaledVector(currentDir, viewDistance);

    // Start smooth transition
    cameraTransitionRef.current = {
      startTime: performance.now(),
      duration: 2000, // 2 seconds for smooth flight
      fromPos: camera.position.clone(),
      toPos: newCameraPos,
      fromTarget: controls.target.clone(),
      toTarget: targetPos,
      active: true
    };
  }, []);


  return (
    <>
      {!controlsHidden && (
        <DevControlsPlanet3D
          onZoomToSurface={handleZoomToSurface}
          onZoomToSystem={handleZoomToSystem}
          onCameraTargetChange={handleCameraTargetChange}
        />
      )}
      <div
        ref={mountRef}
        className="w-full h-full"
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          backgroundColor: '#000'
        }}
      />
    </>
  );
}