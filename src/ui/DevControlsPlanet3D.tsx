import { useState } from 'react';
import { usePlanet3DStore } from '../stores/usePlanet3DStore';

interface DevControlsPlanet3DProps {
  onZoomToSurface?: () => void;
  onZoomToSystem?: () => void;
  onCameraTargetChange?: (target: 'sun' | 'venus' | 'earth' | 'mars' | 'moon') => void;
}

export function DevControlsPlanet3D({
  onZoomToSurface,
  onZoomToSystem,
  onCameraTargetChange,
}: DevControlsPlanet3DProps) {
  const [isCollapsed, setIsCollapsed] = useState(true); // Collapsed by default
  
  // Get all state and setters from store
  const {
    showEntities,
    setShowEntities,
    showAtmosphere,
    setShowAtmosphere,
    showClouds,
    setShowClouds,
    showMoon,
    setShowMoon,
    showSun,
    setShowSun,
    showVenus,
    setShowVenus,
    showMars,
    setShowMars,
    showDebug,
    setShowDebug,
    showAurora,
    setShowAurora,
    showSpaceDust,
    setShowSpaceDust,
    showVolumetricDust,
    setShowVolumetricDust,
    showPoleMarkers,
    setShowPoleMarkers,
    orbitalMode,
    setOrbitalMode,
    followEarth,
    setFollowEarth,
    pauseOrbits,
    setPauseOrbits,
    pauseClouds,
    setPauseClouds,
    cameraTarget,
    setCameraTarget,
  } = usePlanet3DStore();
  
  return (
    <div style={{
      position: 'absolute',
      bottom: '10px',
      left: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      borderRadius: '5px',
      color: 'white',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      minWidth: '200px',
      maxHeight: isCollapsed ? 'auto' : '400px',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ 
        fontWeight: 'bold', 
        padding: '10px 10px 5px 10px',
        borderBottom: '1px solid #444',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer'
      }}
      onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span>Planet 3D Controls</span>
        <span style={{ fontSize: '14px', marginLeft: '10px' }}>
          {isCollapsed ? '▲' : '▼'}
        </span>
      </div>
      {!isCollapsed && (
        <div style={{
          padding: '10px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px'
        }}>
      
      {onCameraTargetChange && (
        <div style={{ borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '5px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '3px', color: '#aaa' }}>
            Camera Target
          </div>
          <select
            value={cameraTarget}
            onChange={(e) => {
              const target = e.target.value as 'sun' | 'venus' | 'earth' | 'mars' | 'moon';
              setCameraTarget(target);
              onCameraTargetChange(target);
            }}
            style={{
              width: '100%',
              padding: '4px',
              fontSize: '11px',
              background: 'rgba(100, 150, 255, 0.1)',
              border: '1px solid rgba(100, 150, 255, 0.3)',
              borderRadius: '3px',
              color: '#fff',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="sun" style={{ background: '#000' }}>☀️ Sun</option>
            <option value="venus" style={{ background: '#000' }}>🟡 Venus</option>
            <option value="earth" style={{ background: '#000' }}>🌍 Earth</option>
            <option value="mars" style={{ background: '#000' }}>🔴 Mars</option>
            <option value="moon" style={{ background: '#000' }}>🌙 Moon</option>
          </select>
        </div>
      )}
      
      <div style={{ borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '5px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '3px', color: '#aaa' }}>
          Orbital Mechanics
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={orbitalMode}
            onChange={(e) => setOrbitalMode(e.target.checked)}
          />
          Planetary Orbits
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', opacity: orbitalMode ? 1 : 0.5 }}>
          <input
            type="checkbox"
            checked={followEarth && orbitalMode}
            disabled={!orbitalMode}
            onChange={(e) => setFollowEarth(e.target.checked)}
          />
          Follow Target
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={pauseOrbits}
            onChange={(e) => setPauseOrbits(e.target.checked)}
          />
          Pause Motion
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={pauseClouds}
            onChange={(e) => setPauseClouds(e.target.checked)}
          />
          Pause Clouds
        </label>
      </div>
      
      <div style={{ borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '5px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '3px', color: '#aaa' }}>
          Scene Elements
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showEntities}
            onChange={(e) => setShowEntities(e.target.checked)}
          />
          Entities
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showAtmosphere}
            onChange={(e) => setShowAtmosphere(e.target.checked)}
          />
          Atmosphere
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showClouds}
            onChange={(e) => setShowClouds(e.target.checked)}
          />
          Clouds
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showMoon}
            onChange={(e) => setShowMoon(e.target.checked)}
          />
          Moon
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showSun}
            onChange={(e) => setShowSun(e.target.checked)}
          />
          Sun
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showVenus}
            onChange={(e) => setShowVenus(e.target.checked)}
          />
          Venus
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showMars}
            onChange={(e) => setShowMars(e.target.checked)}
          />
          Mars
        </label>
      </div>
      
      <div style={{ borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '5px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '3px', color: '#aaa' }}>
          Visual Effects
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showAurora}
            onChange={(e) => setShowAurora(e.target.checked)}
          />
          Aurora
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showSpaceDust}
            onChange={(e) => setShowSpaceDust(e.target.checked)}
          />
          Space Dust
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showVolumetricDust}
            onChange={(e) => setShowVolumetricDust(e.target.checked)}
          />
          God Rays
        </label>
      </div>
      
      <div style={{ paddingBottom: '5px', marginBottom: '5px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '3px', color: '#aaa' }}>
          Debug
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showDebug}
            onChange={(e) => setShowDebug(e.target.checked)}
          />
          Axes
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showPoleMarkers}
            onChange={(e) => setShowPoleMarkers(e.target.checked)}
          />
          Pole Markers
        </label>
      </div>
      
      {(onZoomToSurface || onZoomToSystem) && (
        <div style={{ borderTop: '1px solid #333', paddingTop: '5px', marginTop: '5px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '3px', color: '#aaa' }}>
            Quick Zoom
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            {onZoomToSurface && (
              <button
                onClick={onZoomToSurface}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: '11px',
                  background: 'rgba(100, 150, 255, 0.2)',
                  border: '1px solid rgba(100, 150, 255, 0.5)',
                  borderRadius: '3px',
                  color: '#aaf',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(100, 150, 255, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(100, 150, 255, 0.7)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(100, 150, 255, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(100, 150, 255, 0.5)';
                }}
              >
                Zoom In
              </button>
            )}
            {onZoomToSystem && (
              <button
                onClick={onZoomToSystem}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: '11px',
                  background: 'rgba(255, 150, 100, 0.2)',
                  border: '1px solid rgba(255, 150, 100, 0.5)',
                  borderRadius: '3px',
                  color: '#faa',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 150, 100, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(255, 150, 100, 0.7)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 150, 100, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(255, 150, 100, 0.5)';
                }}
              >
                Zoom Out
              </button>
            )}
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
}