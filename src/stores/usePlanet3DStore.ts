import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface Planet3DState {
  // Visual elements
  showEntities: boolean;
  showAtmosphere: boolean;
  showClouds: boolean;
  showMoon: boolean;
  showSun: boolean;
  
  // Visual effects
  showAurora: boolean;
  showSpaceDust: boolean;
  showVolumetricDust: boolean;
  
  // Debug
  showDebug: boolean;
  showPoleMarkers: boolean;
  
  // Orbital mechanics
  orbitalMode: boolean;
  followEarth: boolean;
  pauseOrbits: boolean;
  pauseClouds: boolean;
  
  // Actions
  toggleShowEntities: () => void;
  toggleShowAtmosphere: () => void;
  toggleShowClouds: () => void;
  toggleShowMoon: () => void;
  toggleShowSun: () => void;
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
  setShowAurora: (value: boolean) => void;
  setShowSpaceDust: (value: boolean) => void;
  setShowVolumetricDust: (value: boolean) => void;
  setShowDebug: (value: boolean) => void;
  setShowPoleMarkers: (value: boolean) => void;
  setOrbitalMode: (value: boolean) => void;
  setFollowEarth: (value: boolean) => void;
  setPauseOrbits: (value: boolean) => void;
  setPauseClouds: (value: boolean) => void;
}

export const usePlanet3DStore = create<Planet3DState>()(
  subscribeWithSelector((set) => ({
    // Initial states
    showEntities: true,
    showAtmosphere: true,
    showClouds: true,
    showMoon: true,
    showSun: true,
    showAurora: true,
    showSpaceDust: true,
    showVolumetricDust: true,
    showDebug: false,
    showPoleMarkers: false,
    orbitalMode: true,
    followEarth: true,
    pauseOrbits: false,
    pauseClouds: false,
    
    // Toggle actions
    toggleShowEntities: () => set((state) => ({ showEntities: !state.showEntities })),
    toggleShowAtmosphere: () => set((state) => ({ showAtmosphere: !state.showAtmosphere })),
    toggleShowClouds: () => set((state) => ({ showClouds: !state.showClouds })),
    toggleShowMoon: () => set((state) => ({ showMoon: !state.showMoon })),
    toggleShowSun: () => set((state) => ({ showSun: !state.showSun })),
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
    setShowAurora: (value) => set({ showAurora: value }),
    setShowSpaceDust: (value) => set({ showSpaceDust: value }),
    setShowVolumetricDust: (value) => set({ showVolumetricDust: value }),
    setShowDebug: (value) => set({ showDebug: value }),
    setShowPoleMarkers: (value) => set({ showPoleMarkers: value }),
    setOrbitalMode: (value) => set({ orbitalMode: value }),
    setFollowEarth: (value) => set({ followEarth: value }),
    setPauseOrbits: (value) => set({ pauseOrbits: value }),
    setPauseClouds: (value) => set({ pauseClouds: value }),
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