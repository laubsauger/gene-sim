import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SimClient } from '../client/setupSimClientHybrid';
import type { MainMsg } from '../sim/types';
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
  MOON_RADIUS,
  ENTITY_ALTITUDE,
  CLOUD_ROTATION_SPEED,
  CLOUD_ALTITUDE,
  AXIAL_TILT,
  SUN_DISTANCE,
  SUN_HEIGHT,
  SUN_RADIUS,
  SUN_COLOR,
  SUN_INTENSITY,
  MOON_COLOR,
  MOON_EMISSIVE,
  ENTITY_SCALE,
  MAX_ENTITIES,
  INITIAL_CAMERA_POSITION,
  CAMERA_CONFIG,
  setSunDirForPlanet,
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

  // Dev control states (like Scene3D)
  const [showEntities, setShowEntities] = useState(true);
  const [showAtmosphere, setShowAtmosphere] = useState(true); // Enable by default
  const [showClouds, setShowClouds] = useState(true);
  const [showMoon, setShowMoon] = useState(true);
  const [showSun, setShowSun] = useState(true);
  const [showDebug, setShowDebug] = useState(true);
  const controlsRef = useRef({ showEntities, showAtmosphere, showClouds, showMoon, showSun, showDebug });

  // Update controls ref when state changes
  useEffect(() => {
    controlsRef.current = { showEntities, showAtmosphere, showClouds, showMoon, showSun, showDebug };
  }, [showEntities, showAtmosphere, showClouds, showMoon, showSun, showDebug]);
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
    // Start close to planet like Scene3D
    camera.position.set(...INITIAL_CAMERA_POSITION);
    camera.lookAt(0, 0, 0);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = CAMERA_CONFIG.minDistance;
    controls.maxDistance = CAMERA_CONFIG.maxDistance;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 1.0;
    controls.target.set(0, 0, 0); // Look at origin

    // Add ambient light for debugging
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    // Add axis helper for orientation
    const axisHelper = new THREE.AxesHelper(5);
    axisHelper.visible = controlsRef.current.showDebug;
    scene.add(axisHelper);

    // Add a simple test sphere to verify rendering works
    const testSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xff0000 })
    );
    // Position it partially behind the planet
    testSphere.position.set(0, 0, -0.5);
    testSphere.visible = controlsRef.current.showDebug;
    scene.add(testSphere);

    // ---------- SUN (Directional Light) - Fixed position like Scene3D ----------
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(SUN_DISTANCE, SUN_HEIGHT, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -1500;
    sun.shadow.camera.right = 1500;
    sun.shadow.camera.top = 1500;
    sun.shadow.camera.bottom = -1500;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 10000;
    scene.add(sun);

    // Add Sun visual from CelestialBodies (import it)
    const sunGroup = new THREE.Group();
    sunGroup.position.copy(sun.position);
    scene.add(sunGroup);

    // Simple sun sprite for now
    const sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture((() => {
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d')!;
          const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
          gradient.addColorStop(0, 'rgba(255, 255, 240, 1)');
          gradient.addColorStop(0.5, 'rgba(255, 220, 100, 1)');
          gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, 256, 256);
          return canvas;
        })()),
        color: 0xffffff,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    sunSprite.scale.set(2, 2, 1);
    sunGroup.add(sunSprite);

    // ---------- EARTH STACK (per architecture) ----------

    const earth = makePlanetWithAtmosphere({
      radius: PLANET_RADIUS,
      atmosphereThickness: ATMOSPHERE_THICKNESS,
      anisotropy: 0.7,
      exposure: 1.2,
      atmosphereColor: new THREE.Color(0x78a6ff),
      mieColor: new THREE.Color(0xfff2d1),
    });

    // Add the earth group (planet is now back in the group since we fixed depth)
    scene.add(earth.group);
    // Earth added at origin

    // Clouds (procedural, transparent) - renderOrder 2
    const cloudResult = makeProceduralCloudShell({
      radius: PLANET_RADIUS * 1.01, // Just above surface
    });
    const clouds = cloudResult.mesh;
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
      testSphere,
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

      // Update controls
      refs.controls.update();

      // For now, keep Earth at origin to debug visibility
      // const ex = Math.cos(t * EARTH_ORBIT_SPEED) * EARTH_ORBIT_RADIUS;
      // const ez = Math.sin(t * EARTH_ORBIT_SPEED) * EARTH_ORBIT_RADIUS;
      // refs.earth.group.position.set(ex, 0, ez);
      refs.earth.group.position.set(0, 0, 0);

      // Spin Earth
      if (!isPaused) {
        refs.earth.group.rotation.y += 0.05 * dt;
      }

      // Moon orbit around Earth (simplified for debugging)
      const mx = Math.cos(t * MOON_ORBIT_SPEED) * MOON_ORBIT_RADIUS;
      const mz = Math.sin(t * MOON_ORBIT_SPEED) * MOON_ORBIT_RADIUS;
      refs.moon.position.set(mx, 0, mz);

      // Feed sun direction to Earth materials (per frame as per checklist)
      setSunDirForPlanet(refs.earth.group, refs.sun, refs.earth.uniforms.shared.uLightDir);

      // Update shaders (now using cloudRotationSpeed properly)
      refs.earth.update({
        delta: dt,
        time: refs.clock.elapsedTime,
        directionalLight: refs.sun,
        cloudRotationSpeed: CLOUD_ROTATION_SPEED
      });

      // Update cloud uniforms with rotation (skip if clouds disabled)
      if (refs.clouds) {
        updateCloudUniforms(refs.clouds, {
          lightDir: refs.earth.uniforms.shared.uLightDir.value,
          time: refs.clock.elapsedTime,
          rotationSpeed: CLOUD_ROTATION_SPEED,
        });
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

      refs.renderer.render(refs.scene, refs.camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [client, world, isPaused]); // Don't add controls to deps to avoid recreating animation loop

  return (
    <>
      {/* Dev Controls Panel */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(0,0,0,0.7)',
        padding: '10px',
        borderRadius: '5px',
        color: 'white',
        fontSize: '12px',
        zIndex: 1000,
        fontFamily: 'monospace'
      }}>
        <div style={{ marginBottom: '5px' }}>
          <label>
            <input
              type="checkbox"
              checked={showAtmosphere}
              onChange={(e) => setShowAtmosphere(e.target.checked)}
            /> Atmosphere
          </label>
        </div>
        <div style={{ marginBottom: '5px' }}>
          <label>
            <input
              type="checkbox"
              checked={showClouds}
              onChange={(e) => setShowClouds(e.target.checked)}
            /> Clouds
          </label>
        </div>
        <div style={{ marginBottom: '5px' }}>
          <label>
            <input
              type="checkbox"
              checked={showMoon}
              onChange={(e) => setShowMoon(e.target.checked)}
            /> Moon
          </label>
        </div>
        <div style={{ marginBottom: '5px' }}>
          <label>
            <input
              type="checkbox"
              checked={showEntities}
              onChange={(e) => setShowEntities(e.target.checked)}
            /> Entities
          </label>
        </div>
        <div style={{ marginBottom: '5px' }}>
          <label>
            <input
              type="checkbox"
              checked={showDebug}
              onChange={(e) => setShowDebug(e.target.checked)}
            /> Debug (Axes + Test Sphere)
          </label>
        </div>
      </div>
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