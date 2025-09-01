import * as THREE from 'three';

// Lens flare sprite textures
function createFlareTexture(size: number = 256, type: 'circle' | 'hexagon' | 'star' = 'circle'): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  const center = size / 2;
  
  if (type === 'circle') {
    // Soft circular flare
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.4, 'rgba(255, 240, 200, 0.6)');
    gradient.addColorStop(0.7, 'rgba(255, 200, 100, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  } else if (type === 'hexagon') {
    // Hexagonal flare (lens aperture)
    ctx.translate(center, center);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const x = Math.cos(angle) * center * 0.8;
      const y = Math.sin(angle) * center * 0.8;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, center);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 240, 200, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fill();
  } else if (type === 'star') {
    // Star burst pattern
    ctx.translate(center, center);
    const spikes = 6;
    const outerRadius = center * 0.9;
    const innerRadius = center * 0.1;
    
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI / spikes) * i;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, center);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 240, 200, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fill();
  }
  
  return new THREE.CanvasTexture(canvas);
}

export class LensFlareSystem {
  private flareSprites: THREE.Sprite[] = [];
  private group: THREE.Group;
  private sunPosition: THREE.Vector3;
  private baseIntensity: number = 1.0;
  
  constructor() {
    this.group = new THREE.Group();
    this.sunPosition = new THREE.Vector3(0, 0, 0);
    
    // Create multiple flare elements
    const flareConfigs = [
      { size: 1.0, distance: 0.0, color: new THREE.Color(1.0, 1.0, 0.9), type: 'star' as const },
      { size: 0.5, distance: 0.3, color: new THREE.Color(1.0, 0.9, 0.7), type: 'circle' as const },
      { size: 0.3, distance: 0.5, color: new THREE.Color(0.7, 0.9, 1.0), type: 'hexagon' as const },
      { size: 0.4, distance: 0.7, color: new THREE.Color(1.0, 0.7, 0.5), type: 'circle' as const },
      { size: 0.6, distance: 1.0, color: new THREE.Color(0.5, 0.7, 1.0), type: 'hexagon' as const },
      { size: 0.2, distance: 1.3, color: new THREE.Color(1.0, 0.6, 0.4), type: 'circle' as const },
      { size: 0.3, distance: -0.3, color: new THREE.Color(0.8, 0.9, 1.0), type: 'circle' as const },
      { size: 0.2, distance: -0.6, color: new THREE.Color(1.0, 0.8, 0.6), type: 'hexagon' as const },
    ];
    
    flareConfigs.forEach(config => {
      const texture = createFlareTexture(256, config.type);
      const material = new THREE.SpriteMaterial({
        map: texture,
        color: config.color,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false
      });
      
      const sprite = new THREE.Sprite(material);
      sprite.scale.setScalar(config.size * 50);
      sprite.userData = { distance: config.distance, baseSize: config.size * 50 };
      
      this.flareSprites.push(sprite);
      this.group.add(sprite);
    });
    
    this.group.renderOrder = 999; // Render last
  }
  
  update(camera: THREE.Camera, sunWorldPos: THREE.Vector3, planetPos: THREE.Vector3, planetRadius: number) {
    // Calculate if we're looking toward the sun
    const cameraPos = camera.position;
    const sunDir = sunWorldPos.clone().sub(cameraPos).normalize();
    
    // Get camera's forward direction
    const cameraDir = new THREE.Vector3(0, 0, -1);
    cameraDir.applyQuaternion((camera as THREE.PerspectiveCamera).quaternion);
    
    // Check angle between camera direction and sun direction
    const dotProduct = cameraDir.dot(sunDir);
    
    // Only show flare when looking toward sun (within ~60 degrees)
    if (dotProduct < 0.5) {
      this.setOpacity(0);
      return;
    }
    
    // Get sun position in screen space
    const sunScreenPos = sunWorldPos.clone();
    sunScreenPos.project(camera);
    
    // Check if sun is occluded by planet
    const sunToCam = cameraPos.clone().sub(sunWorldPos);
    const sunToPlanet = planetPos.clone().sub(sunWorldPos);
    
    // Project camera position onto sun-planet line
    const t = sunToCam.dot(sunToPlanet) / sunToPlanet.lengthSq();
    
    if (t > 0 && t < 1) {
      // Camera is between sun and planet, check for occlusion
      const closestPoint = sunWorldPos.clone().add(sunToPlanet.clone().multiplyScalar(t));
      const distToPlanet = closestPoint.distanceTo(planetPos);
      
      if (distToPlanet < planetRadius * 1.2) {
        // Sun is occluded by planet
        this.setOpacity(0);
        return;
      }
    }
    
    // Calculate intensity based on how directly we're looking at sun
    const intensity = Math.pow(dotProduct, 2) * this.baseIntensity; // Quadratic falloff
    
    // Position flares along line from sun position to screen center
    const screenCenter = new THREE.Vector2(0, 0);
    const sunScreen2D = new THREE.Vector2(sunScreenPos.x, sunScreenPos.y);
    
    this.flareSprites.forEach((sprite, index) => {
      const distance = sprite.userData.distance;
      
      // Interpolate position along the line
      const flareScreen = new THREE.Vector2().lerpVectors(sunScreen2D, screenCenter, distance);
      
      // Convert back to world space
      const flarePos = new THREE.Vector3(flareScreen.x, flareScreen.y, 0.9);
      flarePos.unproject(camera);
      
      // Position sprite between camera and unprojected position
      const direction = flarePos.clone().sub(cameraPos).normalize();
      sprite.position.copy(cameraPos).add(direction.multiplyScalar(100));
      
      // Scale based on intensity and add variation
      const scale = sprite.userData.baseSize * (0.5 + intensity * 0.5);
      sprite.scale.setScalar(scale);
      
      // Set opacity with slight variation per flare
      const opacity = intensity * (0.6 + Math.sin(index * 1.7) * 0.4);
      (sprite.material as THREE.SpriteMaterial).opacity = opacity * 0.5;
    });
    
    // Make group look at camera
    this.group.lookAt(camera.position);
  }
  
  private setOpacity(opacity: number) {
    this.flareSprites.forEach(sprite => {
      (sprite.material as THREE.SpriteMaterial).opacity = opacity;
    });
  }
  
  setIntensity(intensity: number) {
    this.baseIntensity = intensity;
  }
  
  getMesh(): THREE.Group {
    return this.group;
  }
}