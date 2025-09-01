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
  const [isCollapsed, setIsCollapsed] = useState(true); // Main panel collapsed by default

  // Individual section collapse states
  const [sectionsCollapsed, setSectionsCollapsed] = useState({
    camera: false,
    view: false,
    layers: false,
    visualEffects: false,
    starfield: false,
    debug: false,
    orbitalMechanics: false,
  });

  const toggleSection = (section: keyof typeof sectionsCollapsed) => {
    setSectionsCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  // Get all state and setters from store
  const {
    showEntities,
    setShowEntities,
    showAtmosphere,
    setShowAtmosphere,
    atmosphereIntensity,
    setAtmosphereIntensity,
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
    orbitalSpeed,
    setOrbitalSpeed,
    cameraTarget,
    setCameraTarget,
    cameraMode,
    setCameraMode,
    showBloom,
    setShowBloom,
    bloomIntensity,
    setBloomIntensity,
    bloomThreshold,
    setBloomThreshold,
    showStarfield,
    setShowStarfield,
    starCount,
    setStarCount,
    showTwinkle,
    setShowTwinkle,
    twinkleIntensity,
    setTwinkleIntensity,
    showMilkyWay,
    setShowMilkyWay,
    showNebulae,
    setShowNebulae,
    showLensFlare,
    setShowLensFlare,
    lensFlareIntensity,
    setLensFlareIntensity,
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
              <div
                style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '3px', color: '#aaa', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleSection('camera')}
              >
                {sectionsCollapsed.camera ? '▶' : '▼'} Camera Controls
          </div>
              {!sectionsCollapsed.camera && (
                <>
                  <div style={{ marginBottom: '5px' }}>
                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>Mode:</div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => setCameraMode('free')}
                        style={{
                          flex: 1,
                          padding: '3px 6px',
                          fontSize: '10px',
                          background: cameraMode === 'free' ? 'rgba(100, 150, 255, 0.3)' : 'rgba(100, 150, 255, 0.1)',
                          border: `1px solid ${cameraMode === 'free' ? 'rgba(100, 150, 255, 0.7)' : 'rgba(100, 150, 255, 0.3)'}`,
                          borderRadius: '3px',
                          color: '#aaf',
                          cursor: 'pointer',
                        }}
                        title="Camera moves independently of Earth's rotation"
                      >
                        Free Orbit
                      </button>
                      <button
                        onClick={() => setCameraMode('geostationary')}
                        style={{
                          flex: 1,
                          padding: '3px 6px',
                          fontSize: '10px',
                          background: cameraMode === 'geostationary' ? 'rgba(100, 150, 255, 0.3)' : 'rgba(100, 150, 255, 0.1)',
                          border: `1px solid ${cameraMode === 'geostationary' ? 'rgba(100, 150, 255, 0.7)' : 'rgba(100, 150, 255, 0.3)'}`,
                          borderRadius: '3px',
                          color: '#aaf',
                          cursor: 'pointer',
                        }}
                        title="Camera stays above same point on Earth's surface"
                      >
                        Geostationary
                      </button>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>Target:</div>
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
                </>
              )}
            </div>
      )}
      
      <div style={{ borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '5px' }}>
            <div
              style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '3px', color: '#aaa', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => toggleSection('orbitalMechanics')}
            >
              {sectionsCollapsed.orbitalMechanics ? '▶' : '▼'} Orbital Mechanics
        </div>
            {!sectionsCollapsed.orbitalMechanics && (
              <>
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
        <div style={{ marginTop: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}>
            <span style={{ minWidth: '50px' }}>Speed:</span>
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={orbitalSpeed}
              onChange={(e) => setOrbitalSpeed(parseFloat(e.target.value))}
              disabled={pauseOrbits}
              style={{
                flex: 1,
                height: '4px',
                background: pauseOrbits ? '#333' : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(orbitalSpeed - 0.1) / 9.9 * 100}%, #333 ${(orbitalSpeed - 0.1) / 9.9 * 100}%, #333 100%)`,
                borderRadius: '2px',
                outline: 'none',
                opacity: pauseOrbits ? 0.5 : 1,
              }}
            />
            <span style={{ minWidth: '35px', textAlign: 'right' }}>{orbitalSpeed.toFixed(1)}×</span>
          </div>
        </div>
              </>
            )}
      </div>
      
      <div style={{ borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '5px' }}>
            <div
              style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '3px', color: '#aaa', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => toggleSection('layers')}
            >
              {sectionsCollapsed.layers ? '▶' : '▼'} Scene Elements
        </div>
            {!sectionsCollapsed.layers && (
              <>
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
                {showAtmosphere && (
                  <div style={{ marginLeft: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <label style={{ fontSize: '9px', color: '#888', minWidth: '60px' }}>Glow: {atmosphereIntensity.toFixed(2)}</label>
                    <input
                      type="range"
                      min="0.1"
                      max="2.0"
                      step="0.05"
                      value={atmosphereIntensity}
                      onChange={(e) => setAtmosphereIntensity(parseFloat(e.target.value))}
                      style={{ flex: 1 }}
                    />
                  </div>
                )}
        
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
              </>
            )}
      </div>
      
      <div style={{ borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '5px' }}>
            <div
              style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '3px', color: '#aaa', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => toggleSection('visualEffects')}
            >
              {sectionsCollapsed.visualEffects ? '▶' : '▼'} Visual Effects
        </div>
            {!sectionsCollapsed.visualEffects && (
              <>
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
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', marginTop: '3px' }}>
          <input
            type="checkbox"
            checked={showBloom}
            onChange={(e) => setShowBloom(e.target.checked)}
          />
          Bloom Effect
        </label>
        {showBloom && (
          <>
                    <div style={{ marginTop: '5px', marginLeft: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <label style={{ fontSize: '9px', color: '#888', minWidth: '60px' }}>Intensity: {bloomIntensity.toFixed(2)}</label>
              <input
                type="range"
                min="0.1"
                max="3"
                        step="0.05"
                value={bloomIntensity}
                onChange={(e) => setBloomIntensity(parseFloat(e.target.value))}
                        style={{ flex: 1 }}
              />
            </div>
                    <div style={{ marginLeft: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <label style={{ fontSize: '9px', color: '#888', minWidth: '60px' }}>Threshold: {bloomThreshold.toFixed(3)}</label>
              <input
                type="range"
                min="0"
                max="1"
                        step="0.005"
                value={bloomThreshold}
                onChange={(e) => setBloomThreshold(parseFloat(e.target.value))}
                        style={{ flex: 1 }}
              />
            </div>
          </>
        )}
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', marginTop: '5px' }}>
          <input
            type="checkbox"
            checked={showLensFlare}
            onChange={(e) => setShowLensFlare(e.target.checked)}
          />
          Lens Flare
        </label>
        {showLensFlare && (
          <div style={{ marginTop: '5px', marginLeft: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <label style={{ fontSize: '9px', color: '#888', minWidth: '60px' }}>Intensity: {lensFlareIntensity.toFixed(2)}</label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={lensFlareIntensity}
              onChange={(e) => setLensFlareIntensity(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
          </div>
        )}
              </>
            )}
      </div>
      
      <div style={{ borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '5px' }}>
            <div
              style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '3px', color: '#aaa', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => toggleSection('starfield')}
            >
              {sectionsCollapsed.starfield ? '▶' : '▼'} Starfield
        </div>
            {!sectionsCollapsed.starfield && (
              <>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showStarfield}
            onChange={(e) => setShowStarfield(e.target.checked)}
          />
          Show Stars
        </label>
        {showStarfield && (
          <>
            <div style={{ marginTop: '5px', marginLeft: '20px' }}>
              <label style={{ fontSize: '9px', color: '#888' }}>Count: {starCount.toLocaleString()} (requires refresh)</label>
              <input
                type="range"
                min="1000"
                max="100000"
                step="1000"
                value={starCount}
                onChange={(e) => setStarCount(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', marginLeft: '20px', marginTop: '3px' }}>
              <input
                type="checkbox"
                checked={showTwinkle}
                onChange={(e) => setShowTwinkle(e.target.checked)}
              />
              Twinkle
            </label>
            {showTwinkle && (
                      <div style={{ marginLeft: '40px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <label style={{ fontSize: '9px', color: '#888', minWidth: '60px' }}>Intensity: {twinkleIntensity.toFixed(2)}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                          step="0.05"
                  value={twinkleIntensity}
                  onChange={(e) => setTwinkleIntensity(parseFloat(e.target.value))}
                          style={{ flex: 1 }}
                />
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', marginLeft: '20px', marginTop: '3px' }}>
              <input
                type="checkbox"
                checked={showMilkyWay}
                onChange={(e) => setShowMilkyWay(e.target.checked)}
              />
              Milky Way Band (requires refresh)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', marginLeft: '20px', marginTop: '3px' }}>
              <input
                type="checkbox"
                checked={showNebulae}
                onChange={(e) => setShowNebulae(e.target.checked)}
              />
              Nebula Clouds
            </label>
          </>
        )}
              </>
            )}
      </div>
      
      <div style={{ paddingBottom: '5px', marginBottom: '5px' }}>
            <div
              style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '3px', color: '#aaa', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => toggleSection('debug')}
            >
              {sectionsCollapsed.debug ? '▶' : '▼'} Debug
        </div>
            {!sectionsCollapsed.debug && (
              <>
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
              </>
            )}
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
                In [I]
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
                Out [O]
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