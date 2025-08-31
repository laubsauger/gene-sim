
interface DevControlsPlanet3DProps {
  showEntities: boolean;
  setShowEntities: (show: boolean) => void;
  showAtmosphere: boolean;
  setShowAtmosphere: (show: boolean) => void;
  showClouds: boolean;
  setShowClouds: (show: boolean) => void;
  showMoon: boolean;
  setShowMoon: (show: boolean) => void;
  showSun: boolean;
  setShowSun: (show: boolean) => void;
  showDebug: boolean;
  setShowDebug: (show: boolean) => void;
  orbitalMode: boolean;
  setOrbitalMode: (orbital: boolean) => void;
  followEarth: boolean;
  setFollowEarth: (follow: boolean) => void;
  pauseOrbits: boolean;
  setPauseOrbits: (pause: boolean) => void;
  pauseClouds: boolean;
  setPauseClouds: (pause: boolean) => void;
}

export function DevControlsPlanet3D({
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
  showDebug,
  setShowDebug,
  orbitalMode,
  setOrbitalMode,
  followEarth,
  setFollowEarth,
  pauseOrbits,
  setPauseOrbits,
  pauseClouds,
  setPauseClouds,
}: DevControlsPlanet3DProps) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '10px',
      left: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      padding: '10px',
      borderRadius: '5px',
      color: 'white',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
      minWidth: '200px',
      maxHeight: '400px',
      overflowY: 'auto'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px', borderBottom: '1px solid #444', paddingBottom: '5px' }}>
        Planet 3D Controls
      </div>
      
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
          Earth Orbit
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', opacity: orbitalMode ? 1 : 0.5 }}>
          <input
            type="checkbox"
            checked={followEarth && orbitalMode}
            disabled={!orbitalMode}
            onChange={(e) => setFollowEarth(e.target.checked)}
          />
          Follow Earth
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
      </div>
      
      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={showDebug}
          onChange={(e) => setShowDebug(e.target.checked)}
        />
        Debug (Axes)
      </label>
    </div>
  );
}