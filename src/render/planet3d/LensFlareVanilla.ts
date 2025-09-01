import * as THREE from 'three';

export class LensFlareSystem {
  private flares: THREE.Sprite[] = [];
  private group: THREE.Group;
  private enabled: boolean = true;
  private intensity: number = 1.0;
  
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'LensFlareSystem';
    this.createFlares();
  }
  
  private createFlares() {
    // Define flare elements with different sizes, colors, and positions along the axis
    const flareConfigs = [
      { size: 35, color: 0xffffff, opacity: 0.15, distance: 0 }, // Much dimmer main flare at sun
      { size: 20, color: 0xffcc88, opacity: 0.2, distance: 0.3 },
      { size: 12, color: 0x8888ff, opacity: 0.15, distance: 0.5 },
      { size: 10, color: 0x88ccff, opacity: 0.12, distance: 0.7 },
      { size: 16, color: 0xff8844, opacity: 0.15, distance: 0.9 },
      { size: 6, color: 0x88aaff, opacity: 0.1, distance: 1.1 },
      { size: 5, color: 0xffaa66, opacity: 0.08, distance: 1.3 },
    ];
    
    flareConfigs.forEach((config) => {
      const texture = this.createFlareTexture(config.color);
      const material = new THREE.SpriteMaterial({
        map: texture,
        color: config.color,
        opacity: config.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      });
      
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(config.size, config.size, 1);
      sprite.userData = { 
        distance: config.distance, 
        baseOpacity: config.opacity,
        baseSize: config.size 
      };
      
      this.flares.push(sprite);
      this.group.add(sprite);
    });
  }
  
  private createFlareTexture(color: number): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    // Create radial gradient for soft flare
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    const colorObj = new THREE.Color(color);
    const r = Math.floor(colorObj.r * 255);
    const g = Math.floor(colorObj.g * 255);
    const b = Math.floor(colorObj.b * 255);
    
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
    gradient.addColorStop(0.2, `rgba(${r}, ${g}, ${b}, 0.8)`);
    gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.3)`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }
  
  update(camera: THREE.Camera, sunPosition: THREE.Vector3) {
    if (!this.enabled) {
      this.group.visible = false;
      return;
    }
    
    // Calculate sun position in screen space
    const sunScreenPos = sunPosition.clone();
    sunScreenPos.project(camera);
    
    // Check if sun is behind camera
    if (sunScreenPos.z > 1) {
      this.group.visible = false;
      return;
    }
    
    this.group.visible = true;
    
    // Calculate the direction from sun to center of screen
    const screenCenter = new THREE.Vector2(0, 0);
    const sunScreen2D = new THREE.Vector2(sunScreenPos.x, sunScreenPos.y);
    const flareDirection = screenCenter.clone().sub(sunScreen2D);
    
    // Calculate distance-based fade (fade out near edges)
    const distanceFromCenter = sunScreen2D.length();
    const edgeFade = Math.max(0, 1 - distanceFromCenter / 1.2);
    
    // Position each flare element along the axis
    this.flares.forEach((sprite) => {
      const userData = sprite.userData as { 
        distance: number; 
        baseOpacity: number;
        baseSize: number;
      };
      
      // Position along the flare axis from sun toward center
      const flarePos = sunScreen2D.clone().add(
        flareDirection.clone().multiplyScalar(userData.distance)
      );
      
      // Convert screen space to world space
      const worldPos = new THREE.Vector3(flarePos.x, flarePos.y, 0.9);
      worldPos.unproject(camera);
      
      // Position the sprite between camera and sun
      const direction = worldPos.clone().sub(camera.position).normalize();
      const distance = camera.position.distanceTo(sunPosition) * 0.9; // Place flares closer than sun
      sprite.position.copy(camera.position).add(direction.multiplyScalar(distance));
      
      // Adjust opacity based on edge fade and intensity
      if (sprite.material instanceof THREE.SpriteMaterial) {
        sprite.material.opacity = userData.baseOpacity * edgeFade * this.intensity;
        sprite.material.needsUpdate = true;
      }
      
      // Scale based on distance for perspective
      const scaleFactor = userData.baseSize * (1.0 + userData.distance * 0.2);
      sprite.scale.setScalar(scaleFactor);
    });
  }
  
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.group.visible = enabled;
  }
  
  setIntensity(intensity: number) {
    this.intensity = Math.max(0, Math.min(1, intensity));
  }
  
  getGroup(): THREE.Group {
    return this.group;
  }
  
  dispose() {
    this.flares.forEach(sprite => {
      if (sprite.material instanceof THREE.SpriteMaterial) {
        sprite.material.map?.dispose();
        sprite.material.dispose();
      }
    });
    this.flares = [];
  }
}