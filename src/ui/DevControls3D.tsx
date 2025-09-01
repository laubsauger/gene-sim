/**
 * @deprecated This is for the old Scene3D renderer. Use DevControlsPlanet3D instead.
 * This file is kept for reference but should not be used for new features.
 */
import React from 'react';

interface DevControls3DProps {
  showEntities: boolean;
  setShowEntities: (show: boolean) => void;
  showAtmosphere: boolean;
  setShowAtmosphere: (show: boolean) => void;
  showClouds: boolean;
  setShowClouds: (show: boolean) => void;
  autoRotate: boolean;
  setAutoRotate: (rotate: boolean) => void;
  showStars: boolean;
  setShowStars: (show: boolean) => void;
  showMoon: boolean;
  setShowMoon: (show: boolean) => void;
  showSun: boolean;
  setShowSun: (show: boolean) => void;
  showDebug: boolean;
  setShowDebug: (show: boolean) => void;
  biomeMode: 'hidden' | 'natural' | 'highlight';
  setBiomeMode: (mode: 'hidden' | 'natural' | 'highlight') => void;
  showBoundaries: boolean;
  setShowBoundaries: (show: boolean) => void;
}

export function DevControls3D({
  showEntities,
  setShowEntities,
  showAtmosphere,
  setShowAtmosphere,
  showClouds,
  setShowClouds,
  autoRotate,
  setAutoRotate,
  showStars,
  setShowStars,
  showMoon,
  setShowMoon,
  showSun,
  setShowSun,
  showDebug,
  setShowDebug,
  biomeMode,
  setBiomeMode,
  showBoundaries,
  setShowBoundaries,
}: DevControls3DProps) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '10px',
      right: '250px',  // Account for sidebar width
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
      minWidth: '180px',
      maxHeight: '300px',
      overflowY: 'auto'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px', borderBottom: '1px solid #444', paddingBottom: '5px' }}>
        3D Scene Controls
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
          checked={autoRotate}
          onChange={(e) => setAutoRotate(e.target.checked)}
        />
        Planet Rotation
      </label>
      
      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={showStars}
          onChange={(e) => setShowStars(e.target.checked)}
        />
        Stars
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
          checked={showDebug}
          onChange={(e) => setShowDebug(e.target.checked)}
        />
        Debug Arrows
      </label>
      
      <div style={{ borderTop: '1px solid #444', paddingTop: '5px', marginTop: '5px' }}>
        <div style={{ marginBottom: '5px', fontSize: '11px', color: '#aaa' }}>Biome Display:</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '11px' }}>
          <input
            type="radio"
            name="biomeMode"
            checked={biomeMode === 'hidden'}
            onChange={() => setBiomeMode('hidden')}
          />
          Hidden
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '11px' }}>
          <input
            type="radio"
            name="biomeMode"
            checked={biomeMode === 'natural'}
            onChange={() => setBiomeMode('natural')}
          />
          Natural
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '11px' }}>
          <input
            type="radio"
            name="biomeMode"
            checked={biomeMode === 'highlight'}
            onChange={() => setBiomeMode('highlight')}
          />
          Highlight
        </label>
      </div>
      
      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={showBoundaries}
          onChange={(e) => setShowBoundaries(e.target.checked)}
        />
        Biome Boundaries
      </label>
    </div>
  );
}