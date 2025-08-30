Perfect — with those assumptions, here’s the lean, stable plan that scales to 100k+ ground entities, keeps the Sun-driven lighting/terminator correct as bodies orbit, and stays robust with Earth/Moon occlusion.

# The architecture (per-planet)

**Opaque queue (depthWrite=true):**

1. Planet surface (opaque)
2. Ground entities (opaque instancing; slight normal offset to avoid z-fighting)
3. Moon (opaque planet with no clouds/atmo — sits in the same opaque queue, anywhere in the scene)

**Transparent queue (depthWrite=false, depthTest=true):**
4\) Cloud shell (procedural, transparent)
5\) Atmosphere shell (additive, BackSide, transparent)

Why this works:

* Opaques write depth → whichever body is closer wins automatically (Moon in front of Earth, etc.).
* Clouds/atmo still **depth-test** against the opaque depth buffer, so they never bleed over nearer geometry.
* Atmosphere last (still depth-testing) “glazes” both surface **and** clouds for the correct limb glow and day→night look.

---

# Global renderer & camera

```js
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.sortObjects = true;

camera.near = 0.1;   // raise if you can
camera.far  = 1e8;   // keep tight, don’t go infinite

// (Optional) floating origin if you travel far:
function rebaseIfFar(camera, worldRoot, threshold = 1e6) {
  const p = camera.position;
  if (Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)) > threshold) {
    worldRoot.position.sub(p);
    camera.position.set(0,0,0);
  }
}
```

---

# Sun alignment for the terminator

Regardless of orbits/rotations, compute each planet’s sun direction **per frame** from the Sun’s world position:

```js
function setSunDirForPlanet(planetGroup, sunObject3D, destUniform /* vec3 uniform */) {
  const planetWorld = new THREE.Vector3(); planetGroup.getWorldPosition(planetWorld);
  const sunWorld    = new THREE.Vector3(); sunObject3D.getWorldPosition(sunWorld);
  destUniform.value.copy(sunWorld.sub(planetWorld).normalize()); // dir: planet -> sun
}
```

Use this same `uLightDir` in the surface, clouds, atmosphere **and** entity materials so the day/night, cloud shading, and rim glow line up.

---

# 100k ground entities: fast & robust path

* **Representation:** one (or several) **Instanced** draws with a very low-poly base mesh (e.g., cones, capsules, quads), **opaque** material.
* **Placement:** compute (in your compute pass) per-entity **lat, lon, scale, optional yaw** and feed to the vertex shader via a **float texture** (or SSBO if you’re on WebGPU).
* **Z-fighting:** lift each instance a tiny epsilon above the surface along its normal: `altitude = planetRadius * 0.001` (tune) **or** use `polygonOffset` on the planet surface (but altitude is clearer).
* **Culling:** chunk by tiles (e.g., 36×18 lat-lon tiles). Each tile is its own InstancedMesh with a correct bounding sphere → frustum culling stays cheap. (Per-instance CPU culling is costly; keep it coarse.)
* **Lighting:** use the **planet normal** at the instance position (not the entity’s own mesh normal) for N·L so day/night and terminator shading match the ground.

### Minimal entity pipeline (drop-in)

```js
// CPU: build a float texture NxN where each texel packs [lat, lon, scale, yaw]
const N = Math.ceil(Math.sqrt(instanceCount));
const entityData = new Float32Array(N*N*4);
// ...fill entityData in compute or on CPU...
const entityTex = new THREE.DataTexture(entityData, N, N, THREE.RGBAFormat, THREE.FloatType);
entityTex.needsUpdate = true;

// Base mesh
const baseGeom = new THREE.ConeGeometry(0.003, 0.02, 6); // tiny, cheap; units ~ planet radius=1
baseGeom.translate(0, 0.01, 0); // pivot at base so Y+ points “outward”

const entityMat = new THREE.ShaderMaterial({
  uniforms: {
    uPlanetRadius: { value: 1.0 },
    uAltitude: { value: 0.0015 },     // normal offset to avoid z-fighting
    uLightDir: { value: new THREE.Vector3(1,0,0) }, // link this to planet’s shared uLightDir
    uInstanceTex: { value: entityTex },
    uTexSize: { value: N }
  },
  vertexShader: /* glsl */`
    precision highp float;
    uniform float uPlanetRadius, uAltitude, uTexSize;
    uniform sampler2D uInstanceTex;

    attribute vec3 position;
    attribute vec3 normal;

    // Instanced attribute exists but we won't use it (we fetch from texture).
    attribute mat4 instanceMatrix;

    varying vec3 vWorldPos;
    varying vec3 vGroundNormal;

    // Fetch texel for gl_InstanceID
    vec4 fetchInstance(int id){
      float idx = float(id);
      float N = uTexSize;
      float x = (mod(idx, N) + 0.5) / N;
      float y = (floor(idx / N) + 0.5) / N;
      return texture2D(uInstanceTex, vec2(x,y));
    }

    // From lat,lon radians -> unit normal
    vec3 normalFromLatLon(float lat, float lon){
      float cl = cos(lat), sl = sin(lat);
      float co = cos(lon), so = sin(lon);
      return normalize(vec3(cl*co, sl, cl*so));
    }

    // Build tangent frame from ground normal (Y up along normal)
    mat3 basisFromNormal(vec3 n){
      vec3 up = abs(n.y) < 0.99 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0);
      vec3 t = normalize(cross(up, n));
      vec3 b = cross(n, t);
      return mat3(t, n, b); // columns: T, N, B (Y aligns with N)
    }

    void main(){
      vec4 inst = fetchInstance(gl_InstanceID);
      float lat  = inst.x;          // radians
      float lon  = inst.y;          // radians
      float s    = inst.z;          // uniform scale
      float yaw  = inst.w;          // rotation around ground normal

      vec3 n = normalFromLatLon(lat, lon);
      vec3 origin = n * (uPlanetRadius + uAltitude);

      // Orientation: Y axis along normal; yaw around Y
      mat3 M = basisFromNormal(n);
      float c = cos(yaw), si = sin(yaw);
      mat3 R = mat3( c, 0.0, si,
                     0.0,1.0,0.0,
                    -si, 0.0, c);

      vec3 local = (R * (M * (position * s)));
      vec3 world = origin + local;

      vWorldPos = world;
      vGroundNormal = n; // for lighting
      gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform vec3 uLightDir;
    varying vec3 vWorldPos;
    varying vec3 vGroundNormal;
    void main(){
      vec3 N = normalize(vGroundNormal);
      vec3 L = normalize(uLightDir);
      float lambert = max(dot(N, L), 0.0);

      // simple lit color; you can stylize here
      vec3 base = mix(vec3(0.15,0.2,0.25), vec3(0.9,0.9,0.95), lambert);
      gl_FragColor = vec4(base, 1.0);
    }
  `
});

// One big instanced draw (or chunk into tiles for culling)
const entities = new THREE.InstancedMesh(baseGeom, entityMat, instanceCount);
entities.renderOrder = 1;            // between surface(0) and clouds(2)
entities.frustumCulled = false;      // if you don’t chunk; else true per-tile
planetGroup.add(entities);
```

* If your compute pass updates `entityTex`, just set `entityTex.needsUpdate = true` each frame (or swap textures).
* If you prefer CPU transforms, you can fill `entities.instanceMatrix` in chunks — but the texture fetch keeps CPU overhead low for 100k.

---

# Surface, clouds, atmosphere: flags + order (per planet)

```js
// SURFACE
planetMat.transparent = false;
planetMat.depthTest  = true;
planetMat.depthWrite = true;
planetMesh.renderOrder = 0;

// ENTITIES (opaque)
entityMat.transparent = false;
entityMat.depthTest   = true;
entityMat.depthWrite  = true;
entities.renderOrder  = 1;

// CLOUDS (procedural)
cloudMat.transparent = true;
cloudMat.depthTest   = true;
cloudMat.depthWrite  = false;
cloudMesh.renderOrder = 2;

// ATMOSPHERE (additive)
atmosphereMat.transparent = true;
atmosphereMat.depthTest   = true;
atmosphereMat.depthWrite  = false;
atmosphereMesh.material.side = THREE.BackSide;
atmosphereMesh.renderOrder = 3;
```

> Across the **whole scene**, don’t force global renderOrder. Let three.js sort opaques vs. transparents; the depth buffer + the settings above resolve Earth/Moon occlusion and keep clouds/atmo stable.

---

# Procedural clouds (no textures)

Keep them as the **thin shell** above the surface, rendered **before** atmosphere. Use your favorite low-cost FBM noise to produce a mask and a simple day-side lighting term:

* Depth: `depthTest:true`, `depthWrite:false`.
* Day mask: `day = smoothstep(0.0, softness, wrap(N·L))`.
* Limb attenuation (optional): reduce alpha near rim via `limb = pow(1.0 - dot(N,V), 1.2)`.
* Color: mix a faint night tint and white day tint, times a small “grazing-light” darkening.

This gets you stylized but convincing clouds that also get “glazed” by the atmosphere rim, since the atmo draws after.

---

# Moon specifics

* The Moon is just another **opaque** sphere in the **opaque** queue. No cloud/atmo.
* Because opaques write depth, the Moon correctly occludes Earth’s entities/clouds/atmo when in front. When it’s behind Earth, it’s naturally hidden.
* No special cross-planet renderOrder is needed.

---

# Gotchas (and quick fixes)

* **Entity flicker on the ground:** increase `uAltitude` a bit (e.g., 0.0015 → 0.003 \* planetRadius) or add `planetMat.polygonOffset = true; planetMat.polygonOffsetFactor = 1; planetMat.polygonOffsetUnits = 1;`.
* **Atmosphere/Cloud halos over Moon:** ensure both have `depthTest:true`. If you ever see bleed, double-check Moon is opaque and writing depth.
* **Perf with 100k:** keep base geom very low poly; chunk instances into \~1–4k tiles for culling; avoid per-frame CPU updates; prefer texture/compute updates.

---

## TL;DR Implementation Checklist

* [ ] Renderer: `logarithmicDepthBuffer:true`, reasonable `near/far`.
* [ ] Per planet: **surface(0, opaque)** → **entities(1, opaque instanced, +altitude)** → **clouds(2, transparent, depthWrite=false)** → **atmo(3, additive, BackSide, depthWrite=false)**.
* [ ] Every frame: compute `uLightDir` = normalize(`sunPos - planetPos`) and feed to surface/entities/clouds/atmo.
* [ ] Entities: 1–N **InstancedMesh** draws sourcing per-instance data from a float texture (updated by your compute). Use the planet normal for lighting.
* [ ] Moon: plain opaque sphere; nothing special.
* [ ] Optional: chunk entities by lat-lon tiles for frustum culling.

If you want, tell me your compute data layout (what you pack per entity), and I’ll adapt the vertex fetch + basis build so you can paste it straight in.
