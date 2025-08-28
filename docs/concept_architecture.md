# Genetic Simulation — High‑Performance 2D (TypeScript + React + react‑three‑fiber)

This is a complete starter blueprint (architecture + code scaffolds) for a deterministic, auto‑running genetic simulation that can push toward **100k entities**. It favors a **2D orthographic** scene, **GPU instancing/point sprites**, **WebWorker simulation**, and **SharedArrayBuffer** to avoid copying large buffers each frame.

---

## Goals

* Player chooses initial genome of one tribe; other tribes randomized within bounds.
* Sim runs hands‑off with **view controls** (pan/zoom) + **speed controls** (pause/½×/1×/2×/8×).
* **Live stats**: population counts, birth/death rates, average traits, territory spread.
* **Performance**: 100k entities with responsive UI (no stutter). Key tactics below.

---

## Stack Decisions

* **Render**: React + **@react-three/fiber** (R3F) with **three.js** in **2D** via an OrthographicCamera.
* **Simulation**: pure TS in a **WebWorker** using **TypedArrays**. Optional: switch to **bitecs** later if you prefer ECS ergonomics.
* **Data channel**: **SharedArrayBuffer (SAB)** for positions, colors, alive flags, etc. The GPU reads from BufferAttributes that wrap SAB views.
* **Instancing strategy**: **THREE.Points** w/ custom shader (fastest path for 100k) + optional **InstancedMesh** for richer sprites on close zoom.
* **Spatial partitioning**: uniform grid + hashing to keep neighbor lookups O(n).
* **Determinism**: seeded RNG (Mulberry32 or SFC32) so the same seed + params → same run.

---

## Directory Layout

```
/genetic-sim
  /src
    /sim
      random.ts
      genes.ts
      spatialHash.ts
      sim.worker.ts
      types.ts
    /client
      setupSimClient.ts
      useSim.ts
    /render
      EntityPoints.tsx
      Scene2D.tsx
    App.tsx
    ui
      Controls.tsx
      StatsPanel.tsx
  vite.config.ts (or Next.js)
```

> Works with Vite (simplest) or Next.js. For Next.js, guard the Worker with dynamic import (no SSR).

---

## Data Layout (Shared)

We minimize per‑entity memory to keep 100k+ light.

* **positions**: Float32Array (N \* 2) → x,y
* **vel**: Float32Array (N \* 2) → vx,vy (or angle+speed)
* **color**: Uint8Array (N \* 3) → r,g,b (phenotype by tribe/genes)
* **alive**: Uint8Array (N) → 1/0
* **tribeId**: Uint16Array (N)
* **genes** (compact): Float32Array (N \* G) → selected traits only (e.g., speed, vision, metabolism, reproThreshold)
* **stats** (small struct copied per tick or at lower freq)

Memory example @100k:

* pos (800KB), vel (800KB), color (300KB), alive (100KB), tribe (200KB), genes (\~1.6MB for 4 floats) → \~3.8MB + overhead. SAB is fine.

---

## Genetics (example)

```ts
// genes.ts
export type GeneSpec = {
  speed: number;        // movement units / s
  vision: number;       // sense radius
  metabolism: number;   // energy drain / s
  reproChance: number;  // small probability per second when energy > threshold
  colorHue: number;     // phenotype base hue
};

export const clampGene = (g: GeneSpec): GeneSpec => ({
  speed: Math.min(100, Math.max(2, g.speed)),
  vision: Math.min(50, Math.max(2, g.vision)),
  metabolism: Math.min(2, Math.max(0.01, g.metabolism)),
  reproChance: Math.min(0.2, Math.max(0, g.reproChance)),
  colorHue: ((g.colorHue % 360) + 360) % 360,
});

export const mutate = (g: GeneSpec, rand: () => number, intensity = 0.05): GeneSpec => ({
  speed: g.speed * (1 + (rand() * 2 - 1) * intensity),
  vision: g.vision * (1 + (rand() * 2 - 1) * intensity),
  metabolism: g.metabolism * (1 + (rand() * 2 - 1) * intensity),
  reproChance: Math.max(0, g.reproChance + (rand() * 2 - 1) * intensity * 0.1),
  colorHue: g.colorHue + (rand() * 2 - 1) * intensity * 30,
});
```

---

## Types & Messages

```ts
// types.ts
export type Seed = number;

export type TribeInit = {
  name: string;
  count: number;       // initial individuals
  spawn: { x: number; y: number; radius: number };
  genes?: Partial<import('./genes').GeneSpec>; // player-chosen overrides
};

export type WorldInit = {
  width: number;   // world meters
  height: number;
  foodGrid: { cols: number; rows: number; regen: number; capacity: number };
};

export type SimInit = {
  seed: Seed;
  tribes: TribeInit[];
  world: WorldInit;
  cap: number;          // max N (e.g., 120_000)
};

export type SimStats = {
  t: number; // sim time seconds
  population: number;
  byTribe: Record<string, { count: number; births: number; deaths: number }>;
  mean: { speed: number; vision: number; metabolism: number };
};

export type WorkerMsg =
  | { type: 'init'; payload: SimInit }
  | { type: 'setSpeed'; payload: { speedMul: number } }
  | { type: 'pause'; payload: { paused: boolean } }
  | { type: 'requestSnapshot' }
  | { type: 'setViewport'; payload: { x: number; y: number; w: number; h: number; zoom: number } };

export type MainMsg =
  | { type: 'ready'; payload: { sab: { pos: SharedArrayBuffer; color: SharedArrayBuffer; alive: SharedArrayBuffer };
                              meta: { count: number } } }
  | { type: 'stats'; payload: SimStats };
```

---

## Spatial Hash (uniform grid)

```ts
// spatialHash.ts
export class SpatialHash {
  cell: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
  buckets: Int32Array;   // head index per bucket (-1 if empty)
  next: Int32Array;      // next pointer per entity

  constructor(width: number, height: number, cell: number, cap: number) {
    this.width = width; this.height = height; this.cell = cell;
    this.cols = Math.ceil(width / cell); this.rows = Math.ceil(height / cell);
    this.buckets = new Int32Array(this.cols * this.rows).fill(-1);
    this.next = new Int32Array(cap).fill(-1);
  }

  key(x: number, y: number) {
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cell)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cell)));
    return cy * this.cols + cx;
  }

  rebuild(pos: Float32Array, alive: Uint8Array, count: number) {
    this.buckets.fill(-1); this.next.fill(-1);
    for (let i = 0; i < count; i++) if (alive[i]) {
      const k = this.key(pos[i*2], pos[i*2+1]);
      this.next[i] = this.buckets[k];
      this.buckets[k] = i;
    }
  }

  forNeighbors(x: number, y: number, radius: number, fn: (i: number) => void) {
    const r = radius + this.cell; // visit surrounding cells
    const x0 = Math.max(0, Math.floor((x - r) / this.cell));
    const y0 = Math.max(0, Math.floor((y - r) / this.cell));
    const x1 = Math.min(this.cols - 1, Math.floor((x + r) / this.cell));
    const y1 = Math.min(this.rows - 1, Math.floor((y + r) / this.cell));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      let idx = this.buckets[cy * this.cols + cx];
      while (idx !== -1) { fn(idx); idx = this.next[idx]; }
    }
  }
}
```

---

## RNG (deterministic)

```ts
// random.ts (SFC32)
export const sfc32 = (a: number, b: number, c: number, d: number) => () => {
  a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
  let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21 | c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
  return (t >>> 0) / 4294967296;
};
```

---

## Worker (simulation core)

```ts
// sim.worker.ts
/// <reference lib="webworker" />
import { sfc32 } from './random';
import { GeneSpec, clampGene, mutate } from './genes';
import { SpatialHash } from './spatialHash';
import type { SimInit, WorkerMsg, MainMsg, SimStats } from './types';

let pos!: Float32Array, vel!: Float32Array, color!: Uint8Array, alive!: Uint8Array, tribeId!: Uint16Array;
let genes!: Float32Array; // packed [speed,vision,metabolism,repro]
let count = 0, cap = 0;
let rand = Math.random;
let t = 0, speedMul = 1, paused = false;
let grid!: SpatialHash;
let tribeNames: string[] = [];
let birthsByTribe: Uint32Array, deathsByTribe: Uint32Array;
let world = { width: 1000, height: 1000 };

const G = 4; // floats per entity in genes

function hueToRgb(h: number, s = 0.7, v = 1) {
  h = ((h % 360) + 360) % 360; const c = v * s; const x = c * (1 - Math.abs(((h / 60) % 2) - 1)); const m = v - c;
  let [r,g,b] = [0,0,0];
  if (h < 60) [r,g,b] = [c,x,0]; else if (h < 120) [r,g,b] = [x,c,0];
  else if (h < 180) [r,g,b] = [0,c,x]; else if (h < 240) [r,g,b] = [0,x,c];
  else if (h < 300) [r,g,b] = [x,0,c]; else [r,g,b] = [c,0,x];
  return [(r+m)*255,(g+m)*255,(b+m)*255];
}

function spawnEntity(i: number, x: number, y: number, g: GeneSpec, tribeIx: number) {
  pos[i*2] = x; pos[i*2+1] = y;
  const ang = rand() * Math.PI * 2; const sp = g.speed * (0.6 + rand()*0.8);
  vel[i*2] = Math.cos(ang) * sp; vel[i*2+1] = Math.sin(ang) * sp;
  alive[i] = 1; tribeId[i] = tribeIx;
  const base = i*G; genes[base] = g.speed; genes[base+1] = g.vision; genes[base+2] = g.metabolism; genes[base+3] = g.reproChance;
  const [r,gc,b] = hueToRgb(g.colorHue);
  color[i*3] = r|0; color[i*3+1] = gc|0; color[i*3+2] = b|0;
}

function step(dt: number) {
  if (paused) return;
  const n = count;
  t += dt * speedMul;
  // Simple behavior: random drift + boundary wrap + occasional reproduction.
  for (let i = 0; i < n; i++) if (alive[i]) {
    const base = i*G; const sp = genes[base]; const metab = genes[base+2]; const repro = genes[base+3];
    // jitter velocity
    const jx = (rand()*2-1) * sp * 0.5; const jy = (rand()*2-1) * sp * 0.5;
    vel[i*2] += jx * dt; vel[i*2+1] += jy * dt;
    // clamp speed
    let vx = vel[i*2], vy = vel[i*2+1];
    const vlen = Math.hypot(vx, vy) || 1e-6; const vmax = sp;
    if (vlen > vmax) { vx = vx / vlen * vmax; vy = vy / vlen * vmax; vel[i*2]=vx; vel[i*2+1]=vy; }
    // integrate
    pos[i*2] += vx * dt; pos[i*2+1] += vy * dt;
    // wrap
    if (pos[i*2] < 0) pos[i*2]+=world.width; else if (pos[i*2] > world.width) pos[i*2]-=world.width;
    if (pos[i*2+1] < 0) pos[i*2+1]+=world.height; else if (pos[i*2+1] > world.height) pos[i*2+1]-=world.height;
    // death chance from metabolism (toy model)
    if (rand() < metab * dt * 0.001) { alive[i]=0; deathsByTribe[tribeId[i]]++; }
    // reproduction
    if (alive[i] && rand() < repro * dt) {
      // find a free slot
      for (let j = 0; j < cap; j++) if (!alive[j]) {
        const child = mutate({
          speed: genes[base], vision: genes[base+1], metabolism: genes[base+2], reproChance: genes[base+3], colorHue: 0
        }, rand, 0.02);
        child.colorHue = (Math.atan2(vy, vx) * 180/Math.PI + 360) % 360; // fun: hue by heading
        spawnEntity(j, pos[i*2], pos[i*2+1], child, tribeId[i]);
        birthsByTribe[tribeId[i]]++;
        break;
      }
    }
  }
}

function stats(): SimStats {
  const byTribe: SimStats['byTribe'] = {};
  let aliveCount = 0, meanV=0, meanS=0, meanM=0;
  for (let i=0;i<count;i++) if (alive[i]) {
    aliveCount++;
    const base=i*G; meanS += genes[base]; meanV += genes[base+1]; meanM += genes[base+2];
    const name = tribeNames[tribeId[i]];
    if (!byTribe[name]) byTribe[name] = { count: 0, births: birthsByTribe[tribeId[i]], deaths: deathsByTribe[tribeId[i]] };
    byTribe[name].count++;
  }
  const inv = 1/Math.max(1, aliveCount);
  return {
    t, population: aliveCount, byTribe,
    mean: { speed: meanS*inv, vision: meanV*inv, metabolism: meanM*inv },
  };
}

// Message plumbing
self.onmessage = (e: MessageEvent<WorkerMsg>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    const init = msg.payload as SimInit;
    world.width = init.world.width; world.height = init.world.height;
    cap = init.cap;
    // allocate SABs
    const sabPos = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap * 2);
    const sabVel = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap * 2);
    const sabCol = new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * cap * 3);
    const sabAlive = new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * cap);
    const sabTribe = new SharedArrayBuffer(Uint16Array.BYTES_PER_ELEMENT * cap);
    const sabGenes = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap * G);
    pos = new Float32Array(sabPos); vel = new Float32Array(sabVel);
    color = new Uint8Array(sabCol); alive = new Uint8Array(sabAlive);
    tribeId = new Uint16Array(sabTribe); genes = new Float32Array(sabGenes);

    birthsByTribe = new Uint32Array(init.tribes.length);
    deathsByTribe = new Uint32Array(init.tribes.length);
    tribeNames = init.tribes.map(t => t.name);

    // RNG
    const s = init.seed >>> 0;
    rand = sfc32(s, s^0x9e3779b9, s^0x85ebca6b, s^0xc2b2ae35);

    // Spawn
    count = 0;
    init.tribes.forEach((t, ix) => {
      const baseGenes: GeneSpec = clampGene({
        speed: 20, vision: 12, metabolism: 0.2, reproChance: 0.005, colorHue: (ix*90)%360,
        ...(t.genes||{})
      });
      for (let i=0;i<t.count;i++) {
        const ang = rand()*Math.PI*2; const r = Math.sqrt(rand()) * t.spawn.radius;
        const x = t.spawn.x + Math.cos(ang)*r; const y = t.spawn.y + Math.sin(ang)*r;
        spawnEntity(count++, x, y, baseGenes, ix);
      }
    });

    grid = new SpatialHash(world.width, world.height, 16, cap);

    const payload: MainMsg = { type: 'ready', payload: { sab: { pos: sabPos, color: sabCol, alive: sabAlive }, meta: { count } } } as any;
    // Transfer SABs (they remain shared)
    (self as any).postMessage(payload);

    // Main loop (fixed dt with catch-up)
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      let dt = Math.min(0.1, (now - last)/1000); // cap large pause
      last = now;
      if (!paused && speedMul>0) {
        // do multiple micro-steps for stability at high speed
        const stepDt = 1/60; let acc = dt*speedMul;
        while (acc > 0) { const h = Math.min(stepDt, acc); step(h); acc -= h; }
      }
      if ((now|0) % 100 === 0) { // ~10Hz stats
        (self as any).postMessage({ type: 'stats', payload: stats() } as MainMsg);
      }
      requestAnimationFrame(tick);
    };
    tick();
  }
  else if (msg.type === 'setSpeed') speedMul = msg.payload.speedMul;
  else if (msg.type === 'pause') paused = msg.payload.paused;
};
```

---

## Client Hook (wire Worker + SAB → R3F)

```ts
// client/setupSimClient.ts
import type { SimInit, WorkerMsg, MainMsg } from '../sim/types';

export type SimClient = ReturnType<typeof setupSimClient>;

export function setupSimClient(worker: Worker) {
  let pos!: Float32Array, color!: Uint8Array, alive!: Uint8Array; let count = 0;
  const listeners = new Set<(m: MainMsg) => void>();

  worker.onmessage = (e: MessageEvent<MainMsg>) => {
    const msg = e.data;
    if (msg.type === 'ready') {
      const { sab, meta } = msg.payload;
      pos = new Float32Array(sab.pos); color = new Uint8Array(sab.color); alive = new Uint8Array(sab.alive);
      count = meta.count;
    }
    listeners.forEach(l => l(msg));
  };

  return {
    init(payload: SimInit) { worker.postMessage({ type: 'init', payload } as WorkerMsg); },
    setSpeed(speedMul: number) { worker.postMessage({ type: 'setSpeed', payload: { speedMul } } as WorkerMsg); },
    pause(paused: boolean) { worker.postMessage({ type: 'pause', payload: { paused } } as WorkerMsg); },
    onMessage(cb: (m: MainMsg) => void) { listeners.add(cb); return () => listeners.delete(cb); },
    get buffers() { return { pos, color, alive, count }; },
  };
}
```

---

## Renderer — 100k via Points (custom shader)

```tsx
// render/EntityPoints.tsx
import * as THREE from 'three';
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export function EntityPoints({ pos, color, alive, count, pointSize = 2 }: {
  pos: Float32Array; color: Uint8Array; alive: Uint8Array; count: number; pointSize?: number;
}) {
  const geom = useMemo(() => new THREE.BufferGeometry(), []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    depthWrite: false,
    transparent: true,
    vertexShader: `
      attribute vec2 aPos;
      attribute vec3 aCol;
      attribute float aAlive;
      varying vec3 vColor; varying float vAlive;
      uniform float uSize; uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix;
      void main(){
        vColor = aCol; vAlive = aAlive;
        vec4 mvPosition = modelViewMatrix * vec4(aPos, 0.0, 1.0);
        gl_PointSize = uSize; // sizeAttenuation off for ortho
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      precision mediump float; varying vec3 vColor; varying float vAlive;
      void main(){
        if (vAlive < 0.5) discard;
        // circle mask for round dots
        vec2 p = gl_PointCoord * 2.0 - 1.0; if (dot(p,p) > 1.0) discard;
        gl_FragColor = vec4(vColor/255.0, 1.0);
      }
    `,
    uniforms: { uSize: { value: pointSize } },
  }), []);

  const aPos = useMemo(() => new THREE.BufferAttribute(pos, 2), [pos]);
  const aCol = useMemo(() => new THREE.BufferAttribute(new Float32Array(color.buffer), 3), [color]);
  const aAlive = useMemo(() => new THREE.BufferAttribute(new Float32Array(alive.buffer), 1), [alive]);

  React.useEffect(() => {
    geom.setAttribute('aPos', aPos);
    geom.setAttribute('aCol', aCol);
    geom.setAttribute('aAlive', aAlive);
    geom.setDrawRange(0, count);
  }, [geom, aPos, aCol, aAlive, count]);

  useFrame(() => {
    // mark dirty each frame; GPU pulls from SAB-backed views
    (geom.getAttribute('aPos') as THREE.BufferAttribute).needsUpdate = true;
    (geom.getAttribute('aCol') as THREE.BufferAttribute).needsUpdate = true; // optional if colors mutate rarely
    (geom.getAttribute('aAlive') as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <points>
      {/* BufferGeometry isn't used by <points>; we render with custom ShaderMaterial on a raw mesh quad */}
      {/* Trick: use THREE.Points with custom attributes is awkward; instead render as raw point cloud: */}
      <primitive object={geom} attach="geometry" />
      <primitive object={mat} attach="material" />
    </points>
  );
}
```

> Note: We feed typed views that wrap SABs. Toggling `needsUpdate` uploads only the regions that changed (driver‑dependent). For ultra‑large N, you can throttle updates (e.g., 30 Hz) when zoomed out.

---

## Scene & Controls (2D Orthographic)

```tsx
// render/Scene2D.tsx
import React, { useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { MapControls, OrthographicCamera } from '@react-three/drei';
import { EntityPoints } from './EntityPoints';
import type { SimClient } from '../client/setupSimClient';

function EntitiesLayer({ client }: { client: SimClient }) {
  const { buffers } = client; const [tick, setTick] = useState(0);
  useEffect(() => client.onMessage(() => setTick(t => t+1)), [client]);
  if (!buffers || !buffers.pos) return null;
  return (
    <EntityPoints pos={buffers.pos} color={buffers.color} alive={buffers.alive} count={buffers.count} pointSize={2} />
  );
}

function CameraRig({ world }: { world: { width: number; height: number } }) {
  const { size } = useThree();
  const aspect = size.width / size.height;
  const halfW = world.width / 2; const halfH = world.height / 2;
  return (
    <>
      <OrthographicCamera makeDefault position={[halfW, halfH, 10]} zoom={1} near={-1000} far={1000} />
      <MapControls enableRotate={false} zoomSpeed={1.5} panSpeed={1.0} minZoom={0.3} maxZoom={20} />
    </>
  );
}

export function Scene2D({ client, world }: { client: SimClient, world: { width: number; height: number } }) {
  return (
    <Canvas orthographic gl={{ antialias: false, powerPreference: 'high-performance' }}>
      <ambientLight intensity={0.5} />
      <CameraRig world={world} />
      <EntitiesLayer client={client} />
    </Canvas>
  );
}
```

---

## UI: Controls & Stats

```tsx
// ui/Controls.tsx
import React from 'react';
import type { SimClient } from '../client/setupSimClient';

export function Controls({ client }: { client: SimClient }) {
  return (
    <div className="controls">
      <button onClick={() => client.pause(false)}>▶️</button>
      <button onClick={() => client.pause(true)}>⏸</button>
      <button onClick={() => client.setSpeed(0.5)}>0.5×</button>
      <button onClick={() => client.setSpeed(1)}>1×</button>
      <button onClick={() => client.setSpeed(2)}>2×</button>
      <button onClick={() => client.setSpeed(8)}>8×</button>
    </div>
  );
}
```

```tsx
// ui/StatsPanel.tsx
import React, { useEffect, useState } from 'react';
import type { SimClient } from '../client/setupSimClient';
import type { SimStats } from '../sim/types';

export function StatsPanel({ client }: { client: SimClient }) {
  const [stats, setStats] = useState<SimStats | null>(null);
  useEffect(() => client.onMessage(m => { if (m.type === 'stats') setStats(m.payload); }), [client]);
  if (!stats) return null;
  return (
    <div className="stats">
      <div>t: {stats.t.toFixed(1)} s</div>
      <div>population: {stats.population}</div>
      <div>mean speed: {stats.mean.speed.toFixed(2)}</div>
      <div>mean vision: {stats.mean.vision.toFixed(2)}</div>
      <div>mean metabolism: {stats.mean.metabolism.toFixed(3)}</div>
      <div>
        tribes:
        <ul>
          {Object.entries(stats.byTribe).map(([name, v]) => (
            <li key={name}>{name}: {v.count} (b{v.births}/d{v.deaths})</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

---

## App Wiring

```tsx
// App.tsx
import React, { useEffect, useMemo } from 'react';
import { Scene2D } from './render/Scene2D';
import { setupSimClient } from './client/setupSimClient';
import SimWorkerURL from './sim/sim.worker.ts?worker&url'; // Vite: create a worker URL
import { Controls } from './ui/Controls';
import { StatsPanel } from './ui/StatsPanel';

export default function App() {
  const worker = useMemo(() => new Worker(SimWorkerURL, { type: 'module' }), []);
  const client = useMemo(() => setupSimClient(worker), [worker]);

  useEffect(() => {
    client.init({
      seed: 12345,
      cap: 120_000,
      world: { width: 4000, height: 4000, foodGrid: { cols: 256, rows: 256, regen: 0.1, capacity: 1 } },
      tribes: [
        { name: 'Player', count: 2000, spawn: { x: 2000, y: 2000, radius: 80 }, genes: { speed: 25, reproChance: 0.008 } },
        { name: 'Red', count: 2000, spawn: { x: 1000, y: 1000, radius: 60 } },
        { name: 'Blue', count: 2000, spawn: { x: 3000, y: 3000, radius: 60 } },
      ],
    });
  }, [client]);

  return (
    <div className="app" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', height: '100vh' }}>
      <Scene2D client={client} world={{ width: 4000, height: 4000 }} />
      <div style={{ padding: 12, overflow: 'auto', background: '#0b0b0b', color: '#ddd' }}>
        <Controls client={client} />
        <StatsPanel client={client} />
      </div>
    </div>
  );
}
```

---

## Performance Playbook (100k+)

1. **Points shader** first; switch to **InstancedMesh** only when you need per‑entity rotation/shape.
2. Keep attributes **tight** (2D pos only, byte colors, flags in bytes). Avoid matrices.
3. Use **SAB** to avoid postMessage copies. Keep **one geometry**; just flag `needsUpdate`.
4. **Decouple sim tick** and render; simulate at fixed 60 Hz slices with a speed multiplier.
5. **Throttle uploads** when zoomed out (e.g., update every other frame), or render a **heatmap LOD** (texture with counts per cell) instead of points.
6. **Frustum cull** by supplying only visible range (optional: maintain a compacted visible list). For points, driver culling is limited; consider a visibility flag buffer.
7. **Spatial hashing** selectively: if you add local interactions (predation/mating), only query neighbors within **vision**.
8. Prefer **branchless** math; reduce `Math.hypot`; precompute `1/len` where possible.
9. Keep **GC at zero** in the Worker (no dynamic arrays in hot loops).

---

## LOD Upgrade Ideas

* **Far zoom**: render a single **heatmap texture** updated at 10–20 Hz from the Worker (post RGBA8 tile counts), draw under the points.
* **Mid zoom**: draw **Points** only for visible tiles (skip uploading full buffer).
* **Near zoom**: switch entity under cursor to a small **instanced sprite** with ring/outline + text labels (only a handful).

---

## Next Steps / Options

* Introduce **food field** dynamics: regrowth, diffusion, and consumption for survival pressure.
* Add **selection pressure**: energy intake depends on speed vs. metabolism; reproduction thresholds; mutations skew toward feasible niches.
* **Save/Load** scenario → seed + serialized initial params.
* **Recording**: sample stats over time to a ring buffer for charts.
* Consider **OffscreenCanvas** later to move rendering off main thread if your UI grows heavy.

---

## Dependencies

* `react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei`, `vite` (or Next.js).

---

### Notes

* Browsers may require cross‑origin isolation for SharedArrayBuffer (COOP/COEP headers). In dev, use Vite plugin or set headers; in prod, configure your host.
* If you need ECS ergonomics: wire these arrays into **bitecs** components for readability without sacrificing perf.
