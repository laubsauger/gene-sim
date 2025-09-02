import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface Planet3DState {
  // Quality preset
  qualityPreset: 'low' | 'high';
  
  // Visual elements
  showEntities: boolean;
  showAtmosphere: boolean;
  showClouds: boolean;
  showMoon: boolean;
  showSun: boolean;
  showVenus: boolean;
  showMars: boolean;
  
  // Biome settings
  biomeMode: 'hidden' | 'natural' | 'highlight';
  showBiomeBoundaries: boolean;
  showFoodOverlay: boolean;
  useAdvancedBiomeShaders: boolean;
  biomeShaderBlend: number;
  biomeOceanWaves: number;
  biomeShowContours: boolean;
  biomeSatelliteView: boolean;
  
  // Visual effects
  showAurora: boolean;
  showSpaceDust: boolean;
  showVolumetricDust: boolean;
  showBloom: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  atmosphereIntensity: number; // 0-2 for atmosphere glow strength
  showLensFlare: boolean;
  lensFlareIntensity: number; // 0-1 for lens flare brightness
  
  // Starfield configuration
  showStarfield: boolean;
  starCount: number; // 1k to 100k
  showTwinkle: boolean;
  twinkleIntensity: number; // 0-1
  showMilkyWay: boolean;
  showNebulae: boolean;
  
  // Debug
  showDebug: boolean;
  showPoleMarkers: boolean;
  
  // Orbital mechanics
  orbitalMode: boolean;
  followEarth: boolean; // Now follows any selected target, not just Earth
  pauseOrbits: boolean;
  pauseClouds: boolean;
  orbitalSpeed: number; // Multiplier for orbital speed (0.1 to 10)
  
  // Camera controls
  cameraTarget: 'sun' | 'venus' | 'earth' | 'mars' | 'moon';
  cameraMode: 'free' | 'geostationary'; // Free orbit or locked to Earth rotation
  
  // Audio settings
  soundEnabled: boolean;
  musicEnabled: boolean;
  soundVolume: number; // 0-1
  musicVolume: number; // 0-1

  // Quality preset setter
  setQualityPreset: (preset: 'low' | 'high') => void;
  
  // Biome setters
  setBiomeMode: (mode: 'hidden' | 'natural' | 'highlight') => void;
  setShowBiomeBoundaries: (value: boolean) => void;
  setShowFoodOverlay: (value: boolean) => void;
  setUseAdvancedBiomeShaders: (value: boolean) => void;
  setBiomeShaderBlend: (value: number) => void;
  setBiomeOceanWaves: (value: number) => void;
  setBiomeShowContours: (value: boolean) => void;
  setBiomeSatelliteView: (value: boolean) => void;

  // Actions
  toggleShowEntities: () => void;
  toggleShowAtmosphere: () => void;
  toggleShowClouds: () => void;
  toggleShowMoon: () => void;
  toggleShowSun: () => void;
  toggleShowVenus: () => void;
  toggleShowMars: () => void;
  toggleShowAurora: () => void;
  toggleShowSpaceDust: () => void;
  toggleShowVolumetricDust: () => void;
  toggleShowBloom: () => void;
  toggleShowLensFlare: () => void;
  toggleShowDebug: () => void;
  toggleShowPoleMarkers: () => void;
  toggleOrbitalMode: () => void;
  toggleFollowEarth: () => void;
  togglePauseOrbits: () => void;
  togglePauseClouds: () => void;
  
  // Setters for checkboxes that need explicit values
  setShowEntities: (value: boolean) => void;
  setShowAtmosphere: (value: boolean) => void;
  setShowClouds: (value: boolean) => void;
  setShowMoon: (value: boolean) => void;
  setShowSun: (value: boolean) => void;
  setShowVenus: (value: boolean) => void;
  setShowMars: (value: boolean) => void;
  setShowAurora: (value: boolean) => void;
  setShowSpaceDust: (value: boolean) => void;
  setShowVolumetricDust: (value: boolean) => void;
  setShowBloom: (value: boolean) => void;
  setBloomIntensity: (value: number) => void;
  setBloomThreshold: (value: number) => void;
  setAtmosphereIntensity: (value: number) => void;
  setShowLensFlare: (value: boolean) => void;
  setLensFlareIntensity: (value: number) => void;
  setShowDebug: (value: boolean) => void;
  setShowPoleMarkers: (value: boolean) => void;
  setOrbitalMode: (value: boolean) => void;
  setFollowEarth: (value: boolean) => void;
  setPauseOrbits: (value: boolean) => void;
  setPauseClouds: (value: boolean) => void;
  setCameraTarget: (target: 'sun' | 'venus' | 'earth' | 'mars' | 'moon') => void;
  setOrbitalSpeed: (speed: number) => void;
  setCameraMode: (mode: 'free' | 'geostationary') => void;
  
  // Starfield setters
  setShowStarfield: (value: boolean) => void;
  setStarCount: (count: number) => void;
  setShowTwinkle: (value: boolean) => void;
  setTwinkleIntensity: (intensity: number) => void;
  setShowMilkyWay: (value: boolean) => void;
  setShowNebulae: (value: boolean) => void;

  // Audio setters
  setSoundEnabled: (value: boolean) => void;
  setMusicEnabled: (value: boolean) => void;
  setSoundVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
}

export const usePlanet3DStore = create<Planet3DState>()(
  subscribeWithSelector((set) => ({
    // Initial states - DEFAULT TO LOW QUALITY
    qualityPreset: 'low',
    showEntities: true,
    showAtmosphere: true,
    showClouds: true,
    showMoon: true,
    showSun: true,
    showVenus: true, // Now enabled by default
    showMars: true, // Now enabled by default
  
  // Biome settings
  biomeMode: 'natural',
  showBiomeBoundaries: false,
  showFoodOverlay: true, // Default to true like in Scene2D
  useAdvancedBiomeShaders: true, // Enable by default for better visuals
  biomeShaderBlend: 0.8,
  biomeOceanWaves: 0.7,
  biomeShowContours: false,
  biomeSatelliteView: true,
    showAurora: true,
    showSpaceDust: true,
    showVolumetricDust: true,
    showBloom: true, // On by default with reduced intensity
    bloomIntensity: 0.32,
    bloomThreshold: 0.25,
    atmosphereIntensity: 1.0, // Default atmosphere glow
    showLensFlare: false, // Disabled in low quality
    lensFlareIntensity: 0.3, // Lower default intensity
    showStarfield: true, // Now enabled by default
    starCount: 20000, // Default 20k stars
    showTwinkle: true,
    twinkleIntensity: 0.3,
    showMilkyWay: true,
    showNebulae: false, // Off by default for performance
    showDebug: false,
    showPoleMarkers: false,
    orbitalMode: true,
    followEarth: true,
    pauseOrbits: false,
    pauseClouds: false,
    orbitalSpeed: 1, // Default to 1x speed
    cameraTarget: 'earth',
    cameraMode: 'free', // Default to free orbit (already correct)
    soundEnabled: false, // Off by default
    musicEnabled: false, // Off by default
    soundVolume: 0.7,
    musicVolume: 0.5,
  
  // Biome setters
  setBiomeMode: (mode) => set({ biomeMode: mode }),
  setShowBiomeBoundaries: (value) => set({ showBiomeBoundaries: value }),
  setShowFoodOverlay: (value) => set({ showFoodOverlay: value }),
  setUseAdvancedBiomeShaders: (value) => set({ useAdvancedBiomeShaders: value }),
  setBiomeShaderBlend: (value) => set({ biomeShaderBlend: value }),
  setBiomeOceanWaves: (value) => set({ biomeOceanWaves: value }),
  setBiomeShowContours: (value) => set({ biomeShowContours: value }),
  setBiomeSatelliteView: (value) => set({ biomeSatelliteView: value }),
    
    // Toggle actions
    toggleShowEntities: () => set((state) => ({ showEntities: !state.showEntities })),
    toggleShowAtmosphere: () => set((state) => ({ showAtmosphere: !state.showAtmosphere })),
    toggleShowClouds: () => set((state) => ({ showClouds: !state.showClouds })),
    toggleShowMoon: () => set((state) => ({ showMoon: !state.showMoon })),
    toggleShowSun: () => set((state) => ({ showSun: !state.showSun })),
    toggleShowVenus: () => set((state) => ({ showVenus: !state.showVenus })),
    toggleShowMars: () => set((state) => ({ showMars: !state.showMars })),
    toggleShowAurora: () => set((state) => ({ showAurora: !state.showAurora })),
    toggleShowSpaceDust: () => set((state) => ({ showSpaceDust: !state.showSpaceDust })),
    toggleShowVolumetricDust: () => set((state) => ({ showVolumetricDust: !state.showVolumetricDust })),
    toggleShowBloom: () => set((state) => ({ showBloom: !state.showBloom })),
    toggleShowLensFlare: () => set((state) => ({ showLensFlare: !state.showLensFlare })),
    toggleShowDebug: () => set((state) => ({ showDebug: !state.showDebug })),
    toggleShowPoleMarkers: () => set((state) => ({ showPoleMarkers: !state.showPoleMarkers })),
    toggleOrbitalMode: () => set((state) => ({ orbitalMode: !state.orbitalMode })),
    toggleFollowEarth: () => set((state) => ({ followEarth: !state.followEarth })),
    togglePauseOrbits: () => set((state) => ({ pauseOrbits: !state.pauseOrbits })),
    togglePauseClouds: () => set((state) => ({ pauseClouds: !state.pauseClouds })),
    
    // Quality preset setter
    setQualityPreset: (preset) => set((state) => {
      if (preset === 'low') {
        // Low quality: disable expensive features
        return {
          qualityPreset: 'low',
          showVenus: false,
          showMars: false,
          showStarfield: false,
          showNebulae: false,
          showLensFlare: false,
          showVolumetricDust: false,
          showSpaceDust: false,
          starCount: 5000, // Reduce star count
        };
      } else {
        // High quality: enable all features
        return {
          qualityPreset: 'high',
          showVenus: true,
          showMars: true,
          showStarfield: true,
          showNebulae: true,
          showLensFlare: true,
          showVolumetricDust: true,
          showSpaceDust: true,
          starCount: 20000, // Full star count
        };
      }
    }),
    
    // Setter actions
    setShowEntities: (value) => set({ showEntities: value }),
    setShowAtmosphere: (value) => set({ showAtmosphere: value }),
    setShowClouds: (value) => set({ showClouds: value }),
    setShowMoon: (value) => set({ showMoon: value }),
    setShowSun: (value) => set({ showSun: value }),
    setShowVenus: (value) => set({ showVenus: value }),
    setShowMars: (value) => set({ showMars: value }),
    setShowAurora: (value) => set({ showAurora: value }),
    setShowSpaceDust: (value) => set({ showSpaceDust: value }),
    setShowVolumetricDust: (value) => set({ showVolumetricDust: value }),
    setShowBloom: (value) => set({ showBloom: value }),
    setBloomIntensity: (value) => set({ bloomIntensity: value }),
    setBloomThreshold: (value) => set({ bloomThreshold: value }),
    setAtmosphereIntensity: (value) => set({ atmosphereIntensity: value }),
    setShowLensFlare: (value) => set({ showLensFlare: value }),
    setLensFlareIntensity: (value) => set({ lensFlareIntensity: value }),
    setShowDebug: (value) => set({ showDebug: value }),
    setShowPoleMarkers: (value) => set({ showPoleMarkers: value }),
    setOrbitalMode: (value) => set({ orbitalMode: value }),
    setFollowEarth: (value) => set({ followEarth: value }),
    setPauseOrbits: (value) => set({ pauseOrbits: value }),
    setPauseClouds: (value) => set({ pauseClouds: value }),
    setCameraTarget: (target) => set({ cameraTarget: target }),
    setOrbitalSpeed: (speed) => set({ orbitalSpeed: speed }),
    setCameraMode: (mode) => set({ cameraMode: mode }),
    
    // Starfield setters
    setShowStarfield: (value) => set({ showStarfield: value }),
    setStarCount: (count) => set({ starCount: count }),
    setShowTwinkle: (value) => set({ showTwinkle: value }),
    setTwinkleIntensity: (intensity) => set({ twinkleIntensity: intensity }),
    setShowMilkyWay: (value) => set({ showMilkyWay: value }),
    setShowNebulae: (value) => set({ showNebulae: value }),

    // Audio setters
    setSoundEnabled: (value) => set({ soundEnabled: value }),
    setMusicEnabled: (value) => set({ musicEnabled: value }),
    setSoundVolume: (volume) => set({ soundVolume: volume }),
    setMusicVolume: (volume) => set({ musicVolume: volume }),
  }))
);

// Selectors for performance optimization
export const selectVisualElements = (state: Planet3DState) => ({
  showEntities: state.showEntities,
  showAtmosphere: state.showAtmosphere,
  showClouds: state.showClouds,
  showMoon: state.showMoon,
  showSun: state.showSun,
});

export const selectVisualEffects = (state: Planet3DState) => ({
  showAurora: state.showAurora,
  showSpaceDust: state.showSpaceDust,
  showVolumetricDust: state.showVolumetricDust,
});

export const selectDebugOptions = (state: Planet3DState) => ({
  showDebug: state.showDebug,
  showPoleMarkers: state.showPoleMarkers,
});

export const selectOrbitalMechanics = (state: Planet3DState) => ({
  orbitalMode: state.orbitalMode,
  followEarth: state.followEarth,
  pauseOrbits: state.pauseOrbits,
  pauseClouds: state.pauseClouds,
});