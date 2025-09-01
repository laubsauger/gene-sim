import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  // Sidebar states
  setupSidebarCollapsed: boolean;
  statsSidebarCollapsed: boolean;
  
  // Fullscreen state
  isFullscreen: boolean;
  controlsHidden: boolean;
  
  // Render mode
  renderMode: '2D' | '3D' | '3D-Planet';
  
  // Actions
  toggleSetupSidebar: () => void;
  toggleStatsSidebar: () => void;
  setSetupSidebar: (collapsed: boolean) => void;
  setStatsSidebar: (collapsed: boolean) => void;
  toggleFullscreen: () => void;
  toggleControlsVisibility: () => void;
  setControlsHidden: (hidden: boolean) => void;
  setRenderMode: (mode: '2D' | '3D' | '3D-Planet') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial states
      setupSidebarCollapsed: false,
      statsSidebarCollapsed: false,
      isFullscreen: false,
      controlsHidden: false,
      renderMode: '3D-Planet', // Default to orbit mode
      
      // Actions
      toggleSetupSidebar: () => {
        set((state) => ({ 
          setupSidebarCollapsed: !state.setupSidebarCollapsed 
        }));
        // Trigger resize event to update canvas dimensions
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 50);
      },
      toggleStatsSidebar: () => {
        set((state) => ({ 
          statsSidebarCollapsed: !state.statsSidebarCollapsed 
        }));
        // Trigger resize event to update canvas dimensions
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 50);
      },
      setSetupSidebar: (collapsed) => set({ setupSidebarCollapsed: collapsed }),
      setStatsSidebar: (collapsed) => set({ statsSidebarCollapsed: collapsed }),
      setRenderMode: (mode) => set({ renderMode: mode }),
      
      toggleFullscreen: () => {
        const elem = document.documentElement;
        const isCurrentlyFullscreen = document.fullscreenElement !== null;
        
        if (!isCurrentlyFullscreen) {
          elem.requestFullscreen().catch(err => {
            console.error('Error attempting to enable fullscreen:', err);
          });
        } else {
          document.exitFullscreen().catch(err => {
            console.error('Error attempting to exit fullscreen:', err);
          });
        }
        
        set({ isFullscreen: !isCurrentlyFullscreen });
      },
      
      toggleControlsVisibility: () => set((state) => ({ 
        controlsHidden: !state.controlsHidden 
      })),
      setControlsHidden: (hidden) => set({ controlsHidden: hidden }),
    }),
    {
      name: 'ui-storage', // unique name for localStorage
      partialize: (state) => ({ 
        setupSidebarCollapsed: state.setupSidebarCollapsed,
        statsSidebarCollapsed: state.statsSidebarCollapsed,
        renderMode: state.renderMode, // Persist render mode
        // Don't persist fullscreen or controls hidden state
      }),
    }
  )
);