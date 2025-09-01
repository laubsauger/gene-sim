import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface Planet3DState {
  // Visual elements
  showEntities: boolean;
  showAtmosphere: boolean;
  showClouds: boolean;
  showMoon: boolean;
  showSun: boolean;
  showVenus: boolean;
  showMars: boolean;
  
  // Visual effects
  showAurora: boolean;
  showSpaceDust: boolean;
  showVolumetricDust: boolean;
  
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
  setShowDebug: (value: boolean) => void;
  setShowPoleMarkers: (value: boolean) => void;
  setOrbitalMode: (value: boolean) => void;
  setFollowEarth: (value: boolean) => void;
  setPauseOrbits: (value: boolean) => void;
  setPauseClouds: (value: boolean) => void;
  setCameraTarget: (target: 'sun' | 'venus' | 'earth' | 'mars' | 'moon') => void;
  setOrbitalSpeed: (speed: number) => void;
}

export const usePlanet3DStore = create<Planet3DState>()(
  subscribeWithSelector((set) => ({
    // Initial states
    showEntities: true,
    showAtmosphere: true,
    showClouds: true,
    showMoon: true,
    showSun: true,
    showVenus: true,
    showMars: true,
    showAurora: true,
    showSpaceDust: true,
    showVolumetricDust: true,
    showDebug: false,
    showPoleMarkers: false,
    orbitalMode: true,
    followEarth: true,
    pauseOrbits: false,
    pauseClouds: false,
    orbitalSpeed: 1, // Default to 1x speed
    cameraTarget: 'earth',
    
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
    toggleShowDebug: () => set((state) => ({ showDebug: !state.showDebug })),
    toggleShowPoleMarkers: () => set((state) => ({ showPoleMarkers: !state.showPoleMarkers })),
    toggleOrbitalMode: () => set((state) => ({ orbitalMode: !state.orbitalMode })),
    toggleFollowEarth: () => set((state) => ({ followEarth: !state.followEarth })),
    togglePauseOrbits: () => set((state) => ({ pauseOrbits: !state.pauseOrbits })),
    togglePauseClouds: () => set((state) => ({ pauseClouds: !state.pauseClouds })),
    
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
    setShowDebug: (value) => set({ showDebug: value }),
    setShowPoleMarkers: (value) => set({ showPoleMarkers: value }),
    setOrbitalMode: (value) => set({ orbitalMode: value }),
    setFollowEarth: (value) => set({ followEarth: value }),
    setPauseOrbits: (value) => set({ pauseOrbits: value }),
    setPauseClouds: (value) => set({ pauseClouds: value }),
    setCameraTarget: (target) => set({ cameraTarget: target }),
    setOrbitalSpeed: (speed) => set({ orbitalSpeed: speed }),
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