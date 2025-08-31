import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
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
import { updateEntitiesFromBuffers, makeGroundEntities } from './planet3d/EntityRenderer';
import { makeMoon } from './planet3d/MoonComponent';
import {
  PLANET_RADIUS,
  ATMOSPHERE_THICKNESS,
  EARTH_ORBIT_RADIUS,
  EARTH_ORBIT_SPEED,
  EARTH_ROTATION_SPEED,
  MOON_ORBIT_RADIUS,
  MOON_ORBIT_SPEED,
  CLOUD_ROTATION_SPEED,
  AXIAL_TILT,
  MOON_ORBITAL_INCLINATION,
  INITIAL_CAMERA_POSITION,
  CAMERA_CONFIG,
  updateCloudUniforms
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
    moon: THREE.Mesh;
    sun: THREE.DirectionalLight;
    clock: THREE.Clock;
    axisHelper?: THREE.AxesHelper;
    testSphere?: THREE.Mesh;
    atmoDepth?: THREE.Mesh;
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

    // Verify renderer settings
    console.log('[Renderer Setup] Settings:', {
      sortObjects: renderer.sortObjects,
      logarithmicDepthBuffer: renderer.capabilities.logarithmicDepthBuffer,
    });

    // Renderer successfully created

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
    // Expanded shadow camera for orbital mechanics
    sun.shadow.camera.left = -EARTH_ORBIT_RADIUS * 2;
    sun.shadow.camera.right = EARTH_ORBIT_RADIUS * 2;
    sun.shadow.camera.top = EARTH_ORBIT_RADIUS * 2;
    sun.shadow.camera.bottom = -EARTH_ORBIT_RADIUS * 2;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = EARTH_ORBIT_RADIUS * 4; // Cover full orbital range
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

    // Flare texture (cross pattern)
    // const flareTexture = new THREE.CanvasTexture((() => {
    //   const canvas = document.createElement('canvas');
    //   canvas.width = 512;
    //   canvas.height = 512;
    //   const ctx = canvas.getContext('2d')!;

    //   // Horizontal flare
    //   const hGrad = ctx.createLinearGradient(0, 256, 512, 256);
    //   hGrad.addColorStop(0, 'rgba(255, 220, 150, 0)');
    //   hGrad.addColorStop(0.3, 'rgba(255, 230, 180, 0.3)');
    //   hGrad.addColorStop(0.5, 'rgba(255, 255, 220, 0.6)');
    //   hGrad.addColorStop(0.7, 'rgba(255, 230, 180, 0.3)');
    //   hGrad.addColorStop(1, 'rgba(255, 220, 150, 0)');

    //   ctx.fillStyle = hGrad;
    //   ctx.fillRect(0, 240, 512, 32);

    //   // Vertical flare
    //   const vGrad = ctx.createLinearGradient(256, 0, 256, 512);
    //   vGrad.addColorStop(0, 'rgba(255, 220, 150, 0)');
    //   vGrad.addColorStop(0.3, 'rgba(255, 230, 180, 0.3)');
    //   vGrad.addColorStop(0.5, 'rgba(255, 255, 220, 0.6)');
    //   vGrad.addColorStop(0.7, 'rgba(255, 230, 180, 0.3)');
    //   vGrad.addColorStop(1, 'rgba(255, 220, 150, 0)');

    //   ctx.fillStyle = vGrad;
    //   ctx.fillRect(240, 0, 32, 512);

    //   return canvas;
    // })());

    // Main sun core
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
    sunCore.scale.set(1.5, 1.5, 1); // Smaller core
    sunGroup.add(sunCore);

    // Inner glow
    const sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunTexture,
        color: 0xffcc00,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      })
    );
    sunGlow.scale.set(2.2, 2.2, 1); // Even smaller inner glow
    sunGroup.add(sunGlow);

    // // Lens flare cross
    // const lensFlare1 = new THREE.Sprite(
    //   new THREE.SpriteMaterial({
    //     map: flareTexture,
    //     color: 0xffffff,
    //     opacity: 0.4,
    //     blending: THREE.AdditiveBlending,
    //     depthWrite: false,
    //     depthTest: true,
    //   })
    // );
    // lensFlare1.scale.set(15, 15, 1);
    // lensFlare1.userData.isFlare = true;
    // sunGroup.add(lensFlare1);

    // // Secondary flare rotated
    // const lensFlare2 = new THREE.Sprite(
    //   new THREE.SpriteMaterial({
    //     map: flareTexture,
    //     color: 0xffee88,
    //     opacity: 0.25,
    //     blending: THREE.AdditiveBlending,
    //     depthWrite: false,
    //     depthTest: true,
    //   })
    // );
    // lensFlare2.scale.set(12, 12, 1);
    // lensFlare2.rotation.z = Math.PI / 4;
    // lensFlare2.userData.isFlare = true;
    // sunGroup.add(lensFlare2);

    // Outer halo
    const sunHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunTexture,
        color: 0xff9900,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      })
    );
    sunHalo.scale.set(3.5, 3.5, 1); // Smaller outer halo
    sunGroup.add(sunHalo);

    // Point light for glow and additional illumination
    const sunPointLight = new THREE.PointLight(0xffcc66, 0.5, EARTH_ORBIT_RADIUS * 3, 2); // Reduced intensity for better shadows
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

    // Clouds (procedural, transparent) - renderOrder 2
    const cloudResult = makeProceduralCloudShell({
      radius: PLANET_RADIUS * 1.01, // Just above surface
    });
    const clouds = cloudResult.mesh;
    // Enable shadow casting for clouds (subtle cloud shadows)
    clouds.castShadow = true;
    clouds.receiveShadow = false; // Clouds don't receive shadows, they cast them
    // Add clouds to earth group for proper layering
    earth.group.add(clouds);

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
      moon,
      sun,
      clock,
      axisHelper,
      atmoDepth
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

      if (refs.earth?.meshes?.atmosphereMesh) {
        refs.earth.meshes.atmosphereMesh.visible = controls.showAtmosphere;
      }

      if (refs.atmoDepth) {
        refs.atmoDepth.visible = controls.showAtmosphere;
      }

      if (refs.moon) {
        refs.moon.visible = controls.showMoon;
      }

      if (refs.clouds) {
        refs.clouds.visible = controls.showClouds;
      }

      if (refs.entities) {
        refs.entities.visible = controls.showEntities;
      }

      if (refs.axisHelper) {
        refs.axisHelper.visible = controls.showDebug;
      }
      if (refs.testSphere) {
        refs.testSphere.visible = controls.showDebug;
      }

      // Control sun visibility
      const sunGroup = refs.scene.getObjectByName('SunGroup');
      if (sunGroup) {
        sunGroup.visible = controls.showSun;
      }

      // Update controls
      refs.controls.update();

      // Earth orbit mechanics on ecliptic plane (controlled by orbital mode and pause)
      let earthPos = new THREE.Vector3(0, 0, 0);
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

      // Update cloud uniforms with rotation and pause state
      if (refs.clouds) {
        const cloudMaterial = refs.clouds.material as THREE.ShaderMaterial;
        if (cloudMaterial.uniforms) {
          cloudMaterial.uniforms.uLightDir.value.copy(refs.earth.uniforms.shared.uLightDir.value);
          cloudMaterial.uniforms.uTime.value = refs.clock.elapsedTime;
          cloudMaterial.uniforms.uPaused.value = controls.pauseClouds ? 1 : 0;  // Set pause state
        }
      }

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

      refs.renderer.render(refs.scene, refs.camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [client, world, isPaused]); // Don't add controls to deps to avoid recreating animation loop

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