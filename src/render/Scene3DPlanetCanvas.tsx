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
  enforcePlanetLocalOrder,
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
    renderer.sortObjects = true; // Enable proper transparent sorting
    mount.appendChild(renderer.domElement);

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

    // Optional: Add axis helper for orientation
    // const axisHelper = new THREE.AxesHelper(5);
    // scene.add(axisHelper);

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
    scene.add(earth.group);
    // Earth added at origin

    // Clouds (procedural, transparent) - renderOrder 2
    const clouds = makeProceduralCloudShell({
      radius: PLANET_RADIUS * 1.01, // Just above surface
    });
    clouds.renderOrder = 2;
    earth.group.add(clouds);

    // Enforce local render order per checklist
    enforcePlanetLocalOrder(earth, clouds);

    // ---------- MOON (opaque, no atmosphere) ----------
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(MOON_RADIUS, 64, 48),
      new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.9, metalness: 0.0 })
    );
    moon.castShadow = false;
    moon.receiveShadow = false;
    scene.add(moon);

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
      clock
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
      const entities = makeGroundEntities({
        planetRadius: PLANET_RADIUS,
        count: entityCount,
        instanceTexSide: Math.ceil(Math.sqrt(entityCount)),
        worldWidth: world.width,
        worldHeight: world.height,
      });
      entities.renderOrder = 1; // Between surface(0) and clouds(2)
      sceneRef.current.earth.group.add(entities);
      sceneRef.current.entities = entities;
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

      // Remove debug logging now that we know it works
      frameCount++;

      const dt = refs.clock.getDelta();
      if (!isPaused) {
        t += dt;
      }

      // Update controls
      refs.controls.update();

      // Orbit Earth around Sun (XZ plane)
      const ex = Math.cos(t * EARTH_ORBIT_SPEED) * EARTH_ORBIT_RADIUS;
      const ez = Math.sin(t * EARTH_ORBIT_SPEED) * EARTH_ORBIT_RADIUS;
      refs.earth.group.position.set(ex, 0, ez);

      // Spin Earth
      if (!isPaused) {
        refs.earth.group.rotation.y += 0.05 * dt;
      }

      // Moon orbit around Earth
      const mx = refs.earth.group.position.x + Math.cos(t * MOON_ORBIT_SPEED) * MOON_ORBIT_RADIUS;
      const mz = refs.earth.group.position.z + Math.sin(t * MOON_ORBIT_SPEED) * MOON_ORBIT_RADIUS;
      const my = 0.4 * Math.sin(t * 0.6);
      refs.moon.position.set(mx, my, mz);

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
      if (refs.entities) {
        updateEntitiesFromBuffers(refs.entities, client.buffers, world.width, world.height);
        updateEntitiesLightDir(refs.entities, refs.earth.uniforms.shared.uLightDir.value);
      }

      refs.renderer.render(refs.scene, refs.camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [client, world, isPaused]);

  return (
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
  );
}