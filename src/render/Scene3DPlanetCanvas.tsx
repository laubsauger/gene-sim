import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import type { SimClient } from '../client/setupSimClientHybrid';
import type { MainMsg } from '../sim/types';
import { DevControlsPlanet3D } from '../ui/DevControlsPlanet3D';

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
import { makePlanetWithAtmosphere } from './planet3d/PlanetWithAtmosphere';
import { makeProceduralCloudShell } from './planet3d/ProceduralCloudShell';
import { createMultiLayerClouds } from './planet3d/MultiLayerClouds';
import { updateEntitiesFromBuffers, makeGroundEntities } from './planet3d/EntityRenderer';
import { makeMoon } from './planet3d/MoonComponent';
import { createSpaceDust, createPlanetaryDustRing } from './planet3d/SpaceDust';
import { createStarfield, createVolumetricDust } from './planet3d/VolumetricLight';
import { createAuroraEffect } from './planet3d/AuroraEffect';
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
  INITIAL_CAMERA_POSITION,
  CAMERA_CONFIG,
  SUN_RADIUS
} from './planet3d/planetUtils';

export interface Scene3DPlanetCanvasProps {
  client: SimClient;
  world: { width: number; height: number };
  entitySize: number;
}

export function Scene3DPlanetCanvas({ client, world }: Scene3DPlanetCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(true);
  const fpsTracker = FPSTracker({ client });
  const cinematicAnimationRef = useRef<{ startTime: number; duration: number; from: number; to: number; active: boolean } | null>(null);
  const statsRef = useRef<Stats | null>(null);

  // Dev control states (like Scene3D)
  const [showEntities, setShowEntities] = useState(true);
  const [showAtmosphere, setShowAtmosphere] = useState(true); // Enable by default
  const [showClouds, setShowClouds] = useState(true);
  const [showMoon, setShowMoon] = useState(true);
  const [showSun, setShowSun] = useState(true);
  const [showDebug, setShowDebug] = useState(false); // Hide debug elements by default
  const [orbitalMode, setOrbitalMode] = useState(true); // Enable orbital mode by default
  const [followEarth, setFollowEarth] = useState(true); // Enable follow Earth by default
  const [pauseOrbits, setPauseOrbits] = useState(false); // New control to pause all orbital mechanics
  const [pauseClouds, setPauseClouds] = useState(false); // New control to pause cloud movement
  const controlsRef = useRef({ showEntities, showAtmosphere, showClouds, showMoon, showSun, showDebug, orbitalMode, followEarth, pauseOrbits, pauseClouds });

  // Update controls ref when state changes
  useEffect(() => {
    controlsRef.current = { showEntities, showAtmosphere, showClouds, showMoon, showSun, showDebug, orbitalMode, followEarth, pauseOrbits, pauseClouds };
  }, [showEntities, showAtmosphere, showClouds, showMoon, showSun, showDebug, orbitalMode, followEarth, pauseOrbits, pauseClouds]);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    earth: any;
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
    starfield?: THREE.Group;
    volumetricDust?: ReturnType<typeof createVolumetricDust>;
    aurora?: ReturnType<typeof createAuroraEffect>;
    northPoleArrow?: THREE.ArrowHelper;
    southPoleArrow?: THREE.ArrowHelper;
    northPoleCylinder?: THREE.Mesh;
    southPoleCylinder?: THREE.Mesh;
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
      depth: true
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
    // Start looking at Earth's initial position
    camera.position.set(
      EARTH_ORBIT_RADIUS + INITIAL_CAMERA_POSITION[0],
      INITIAL_CAMERA_POSITION[1],
      INITIAL_CAMERA_POSITION[2]
    );
    camera.lookAt(EARTH_ORBIT_RADIUS, 0, 0);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = CAMERA_CONFIG.minDistance;
    controls.maxDistance = CAMERA_CONFIG.maxDistance * 3; // Allow more zoom out for orbital view
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 1.0;
    controls.target.set(EARTH_ORBIT_RADIUS, 0, 0); // Look at Earth's initial position

    // Add ambient light for debugging
    const ambientLight = new THREE.AmbientLight(0x404040, 0.1); // Reduced for better shadows
    scene.add(ambientLight);

    // Add axis helper for orientation
    const axisHelper = new THREE.AxesHelper(5);
    axisHelper.visible = controlsRef.current.showDebug;
    scene.add(axisHelper);

    // ---------- SUN (Directional Light) - Position at origin ----------
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    // Directional light position represents where light comes FROM
    // We'll update this dynamically to always shine from sun (origin) to Earth
    sun.position.set(100, 100, 100); // Initial position (will be updated per frame)
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096); // Higher resolution for better shadows
    // Expanded shadow camera for orbital mechanics and moon orbit
    const shadowSize = Math.max(EARTH_ORBIT_RADIUS, MOON_ORBIT_RADIUS) * 2;
    sun.shadow.camera.left = -shadowSize;
    sun.shadow.camera.right = shadowSize;
    sun.shadow.camera.top = shadowSize;
    sun.shadow.camera.bottom = -shadowSize;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = shadowSize * 4; // Cover full orbital range including moon
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

    // Sun texture
    const sunTexture = new THREE.CanvasTexture((() => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      gradient.addColorStop(0, 'rgba(255, 255, 240, 1)');
      gradient.addColorStop(0.2, 'rgba(255, 250, 200, 1)');
      gradient.addColorStop(0.5, 'rgba(255, 220, 100, 1)');
      gradient.addColorStop(0.8, 'rgba(255, 180, 50, 0.5)');
      gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 256);
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
        color: 0xffdd44,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      })
    );
    sunGlow.scale.set(SUN_RADIUS * 1.0, SUN_RADIUS * 1.0, 1); // Full sun size
    sunGroup.add(sunGlow);

    // Middle halo
    const sunHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunTexture,
        color: 0xffaa00,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      })
    );
    sunHalo.scale.set(SUN_RADIUS * 1.5, SUN_RADIUS * 1.5, 1); // Medium halo
    sunGroup.add(sunHalo);

    // Outer corona
    const sunCorona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunTexture,
        color: 0xff8800,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      })
    );
    sunCorona.scale.set(SUN_RADIUS * 2.0, SUN_RADIUS * 2.0, 1); // Large corona
    sunGroup.add(sunCorona);

    // Extra outer halo for more glow
    const sunOuterHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunTexture,
        color: 0xff6600,
        opacity: 0.05,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      })
    );
    sunOuterHalo.scale.set(SUN_RADIUS * 3.0, SUN_RADIUS * 3.0, 1); // Very large faint halo
    sunGroup.add(sunOuterHalo);

    // Point light for glow and additional illumination
    const sunPointLight = new THREE.PointLight(0xffcc66, 1.0, EARTH_ORBIT_RADIUS * 4, 2); // Brighter and further reach
    sunGroup.add(sunPointLight);

    // ---------- EARTH STACK (per architecture) ----------

    const earth = makePlanetWithAtmosphere({
      radius: PLANET_RADIUS,
      atmosphereThickness: ATMOSPHERE_THICKNESS,
      anisotropy: 0.7,
      exposure: 1.2,
      atmosphereColor: new THREE.Color(0x78a6ff),
      mieColor: new THREE.Color(0xfff2d1),
    });

    // Add the earth group - will be positioned at orbit radius
    scene.add(earth.group);
    // Earth starts at orbit position
    earth.group.position.set(EARTH_ORBIT_RADIUS, 0, 0);
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
      earth.meshes.atmosphereMesh.visible = controlsRef.current.showAtmosphere;
    }

    // Skip atmosphere depth prepass for now - focus on getting basic rendering working
    let atmoDepth: THREE.Mesh | undefined;

    // ---------- MOON (using proper component) ----------
    const moonResult = makeMoon(PLANET_RADIUS);
    const moon = moonResult.mesh;
    moon.name = 'Moon';
    // Enable shadow casting and receiving for Moon
    moon.castShadow = true;
    moon.receiveShadow = true;
    // Add moon directly to scene, not to earth group
    scene.add(moon);
    
    // ---------- STARFIELD BACKGROUND ----------
    const starfield = createStarfield(8000, 25000); // Far away starfield with multiple layers
    scene.add(starfield);
    
    // ---------- SPACE DUST for volumetric lighting ----------
    const spaceDust = createSpaceDust({
      count: 8000,  // More particles for better coverage
      radius: EARTH_ORBIT_RADIUS * 2,  // Extend further out
      innerRadius: PLANET_RADIUS * 2,  // Start closer to sun
      intensity: 0.6  // Slightly brighter
    });
    scene.add(spaceDust.mesh);
    
    // ---------- VOLUMETRIC DUST (god rays) ----------
    const volumetricDust = createVolumetricDust({
      count: 10000,
      sunRadius: 100,
      spread: EARTH_ORBIT_RADIUS * 2.5,
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
      scene,
      camera,
      controls,
      earth,
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
      volumetricDust,
      aurora,
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
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      controls.dispose();
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
      const entities = makeGroundEntities(entityCount);
      // Add entities to earth group for proper layering
      sceneRef.current.earth.group.add(entities);
      sceneRef.current.entities = entities;

      // Entities are already configured in makeGroundEntities
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

    return unsubscribe;
  }, [client, world]);

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
      const controls = controlsRef.current;

      // Distance-based culling for performance
      const cameraDistance = refs.camera.position.distanceTo(refs.earth.group.position);
      const planetScreenSize = (PLANET_RADIUS / cameraDistance) * Math.min(window.innerHeight, window.innerWidth);

      if (refs.earth?.meshes?.atmosphereMesh) {
        // Cull atmosphere when planet is very small on screen
        refs.earth.meshes.atmosphereMesh.visible = controls.showAtmosphere && planetScreenSize > 20;
      }

      if (refs.atmoDepth) {
        refs.atmoDepth.visible = controls.showAtmosphere && planetScreenSize > 20;
      }

      if (refs.moon) {
        refs.moon.visible = controls.showMoon;
      }

      if (refs.cloudSystem) {
        // Cull clouds when planet is small on screen
        refs.cloudSystem.group.visible = controls.showClouds && planetScreenSize > 10;
      }
      
      if (refs.clouds) {
        // Backward compatibility
        refs.clouds.visible = controls.showClouds && planetScreenSize > 10;
      }

      if (refs.entities) {
        // Cull entities when they would be smaller than 0.5 pixels
        refs.entities.visible = controls.showEntities && planetScreenSize > 50;
      }

      if (refs.axisHelper) {
        refs.axisHelper.visible = controls.showDebug;
      }
      if (refs.testSphere) {
        refs.testSphere.visible = controls.showDebug;
      }
      // Update pole markers visibility
      if (refs.northPoleArrow) {
        refs.northPoleArrow.visible = true; // Always visible for debug
      }
      if (refs.southPoleArrow) {
        refs.southPoleArrow.visible = true; // Always visible for debug
      }
      if (refs.northPoleCylinder) {
        refs.northPoleCylinder.visible = true;
      }
      if (refs.southPoleCylinder) {
        refs.southPoleCylinder.visible = true;
      }

      // Control sun visibility
      const sunGroup = refs.scene.getObjectByName('SunGroup');
      if (sunGroup) {
        sunGroup.visible = controls.showSun;
      }

      // Handle cinematic zoom animation
      const anim = cinematicAnimationRef.current;
      if (anim && anim.active) {
        const elapsed = performance.now() - anim.startTime;
        const progress = Math.min(elapsed / anim.duration, 1);

        // Easing function (ease-in-out-cubic)
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        // Calculate new distance
        const newDistance = anim.from + (anim.to - anim.from) * eased;

        // Apply zoom - maintain current direction from target
        const direction = refs.camera.position.clone().sub(refs.controls.target).normalize();
        refs.camera.position.copy(refs.controls.target).addScaledVector(direction, newDistance);

        // End animation
        if (progress >= 1) {
          anim.active = false;
        }
      }

      // Update controls
      refs.controls.update();

      // Earth orbit mechanics on ecliptic plane (controlled by orbital mode and pause)
      const earthPos = new THREE.Vector3(0, 0, 0);
      if (controls.orbitalMode) {
        if (!controls.pauseOrbits) {
          const orbitTime = refs.clock.elapsedTime;  // Use elapsed time for continuous motion
          // Earth orbits in the ecliptic plane (XZ plane, Y=0)
          const ex = Math.cos(orbitTime * EARTH_ORBIT_SPEED) * EARTH_ORBIT_RADIUS;
          const ez = Math.sin(orbitTime * EARTH_ORBIT_SPEED) * EARTH_ORBIT_RADIUS;
          earthPos.set(ex, 0, ez);  // Ecliptic plane
          refs.earth.group.position.copy(earthPos);
        } else {
          // When paused, maintain current position
          earthPos.copy(refs.earth.group.position);
        }
      } else {
        // When orbital mode is off, Earth stays at orbit radius on ecliptic plane
        earthPos.set(EARTH_ORBIT_RADIUS, 0, 0);
        refs.earth.group.position.copy(earthPos);
      }

      // Camera tracking for Earth (smooth following)
      if (controls.followEarth && controls.orbitalMode) {
        // Maintain current camera offset from target
        const currentOffset = new THREE.Vector3().subVectors(refs.camera.position, refs.controls.target);

        // Smoothly interpolate target and camera positions
        const lerpFactor = Math.min(1.0, dt * 2.0); // Smooth following
        refs.controls.target.lerp(earthPos, lerpFactor);

        const newCameraPos = earthPos.clone().add(currentOffset);
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
      if (!controls.pauseOrbits) {
        refs.earth.group.rotation.y = refs.clock.elapsedTime * EARTH_ROTATION_SPEED;
      }

      // Moon orbit around Earth with 5.14° inclination from ecliptic
      if (!controls.pauseOrbits) {
        const moonTime = refs.clock.elapsedTime;  // Use elapsed time for continuous motion
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
            controls.pauseClouds
          );
        });
      }
      
      // Update single cloud layer for backward compatibility
      if (refs.clouds) {
        const cloudMaterial = refs.clouds.material as THREE.ShaderMaterial;
        if (cloudMaterial.uniforms) {
          cloudMaterial.uniforms.uLightDir.value.copy(refs.earth.uniforms.shared.uLightDir.value);
          cloudMaterial.uniforms.uTime.value = refs.clock.elapsedTime;
          cloudMaterial.uniforms.uPaused.value = controls.pauseClouds ? 1 : 0;  // Set pause state
        }
      }
      
      // Force shadow map update to ensure moon shadows are visible
      refs.sun.shadow.needsUpdate = true;
      
      // Update space dust with light direction and camera position
      if (refs.spaceDust) {
        refs.spaceDust.update(
          refs.clock.elapsedTime * 1000,
          sunToEarth,
          refs.camera.position
        );
      }
      
      // Update volumetric dust for god rays effect
      if (refs.volumetricDust) {
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
        refs.aurora.update(
          refs.clock.elapsedTime * 1000,
          sunToEarth,
          refs.camera.position
        );
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
            color,
            alive,
            count,
            world.width,
            world.height
          );
          // Update entity lighting direction
          const mat = refs.entities.material as THREE.ShaderMaterial;
          if (mat.uniforms?.uLightDir) {
            mat.uniforms.uLightDir.value.copy(refs.earth.uniforms.shared.uLightDir.value);
          }
        }
      }

      // Track FPS
      fpsTracker.trackFrame();
      
      // Update stats panel
      if (statsRef.current) {
        statsRef.current.update();
      }

      refs.renderer.render(refs.scene, refs.camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [client, world, isPaused]); // Don't add controls to deps to avoid recreating animation loop

  // Cinematic zoom functions
  const handleZoomToSurface = useCallback(() => {
    if (!sceneRef.current) return;
    const { controls, camera } = sceneRef.current;

    // Get current distance
    const currentDistance = camera.position.distanceTo(controls.target);
    const targetDistance = PLANET_RADIUS * 1.5; // Safe distance above surface

    // Start animation
    cinematicAnimationRef.current = {
      startTime: performance.now(),
      duration: 2500, // 2.5 seconds
      from: currentDistance,
      to: targetDistance,
      active: true
    };
  }, []);

  const handleZoomToSystem = useCallback(() => {
    if (!sceneRef.current) return;
    const { controls, camera } = sceneRef.current;

    // Get current distance
    const currentDistance = camera.position.distanceTo(controls.target);
    const targetDistance = CAMERA_CONFIG.maxDistance * 3; // Near maximum

    // Start animation
    cinematicAnimationRef.current = {
      startTime: performance.now(),
      duration: 3000, // 3 seconds for zoom out
      from: currentDistance,
      to: targetDistance,
      active: true
    };
  }, []);


  return (
    <>
      <DevControlsPlanet3D
        showEntities={showEntities}
        setShowEntities={setShowEntities}
        showAtmosphere={showAtmosphere}
        setShowAtmosphere={setShowAtmosphere}
        showClouds={showClouds}
        setShowClouds={setShowClouds}
        showMoon={showMoon}
        setShowMoon={setShowMoon}
        showSun={showSun}
        setShowSun={setShowSun}
        showDebug={showDebug}
        setShowDebug={setShowDebug}
        orbitalMode={orbitalMode}
        setOrbitalMode={setOrbitalMode}
        followEarth={followEarth}
        setFollowEarth={setFollowEarth}
        pauseOrbits={pauseOrbits}
        setPauseOrbits={setPauseOrbits}
        pauseClouds={pauseClouds}
        setPauseClouds={setPauseClouds}
        onZoomToSurface={handleZoomToSurface}
        onZoomToSystem={handleZoomToSystem}
      />
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