import { useState, useEffect } from 'react';
import type { SimClient } from '../client/setupSimClientHybrid';
import { CompactSlider } from './CompactSlider';
import { StyledButton, ButtonGroup } from './ButtonStyles';
import { useUIStore } from '../stores/useUIStore';


export interface ControlsProps {
  client: SimClient;
  isRunning: boolean;
  onStart: () => void;
  entitySize: number;
  onEntitySizeChange: (size: number) => void;
  renderMode?: '2D' | '3D' | '3D-Planet';
  onRenderModeChange?: (mode: '2D' | '3D' | '3D-Planet') => void;
  showFood?: boolean;
  onShowFoodChange?: (show: boolean) => void;
  showBoundaries?: boolean;
  onShowBoundariesChange?: (show: boolean) => void;
  biomeMode?: 'hidden' | 'natural' | 'highlight';
  onBiomeModeChange?: (mode: 'hidden' | 'natural' | 'highlight') => void;
}

export function Controls({ client, isRunning, onStart, entitySize, onEntitySizeChange, renderMode = '2D', onRenderModeChange, showFood = true, onShowFoodChange, showBoundaries = false, onShowBoundariesChange, biomeMode = 'natural', onBiomeModeChange }: ControlsProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const speedValues = [0.1, 0.25, 0.5, 1, 2, 4, 8, 12, 16];
  const [sliderValue, setSliderValue] = useState(3); // Start at index 3 (1×)
  const { toggleFullscreen, isFullscreen, controlsHidden, toggleControlsVisibility } = useUIStore();

  const handlePause = () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    if (client) {
      client.pause(newPaused);
    }
  };

  const handleSpeed = (speedMul: number) => {
    setSpeed(speedMul);
    if (client) {
      client.setSpeed(speedMul);
      if (isPaused && speedMul > 0) {
        setIsPaused(false);
        client.pause(false);
      }
    }
  };
  
  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      if (e.target !== document.body) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        if (!isRunning) {
          onStart();
        } else if (client) {
          const newPaused = !isPaused;
          setIsPaused(newPaused);
          client.pause(newPaused);
        }
      } else if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'KeyH') {
        e.preventDefault();
        toggleControlsVisibility();
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isPaused, isRunning, onStart, client, toggleFullscreen, toggleControlsVisibility]);

  // Compact mode when controls hidden
  if (controlsHidden) {
    return (
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '8px',
        background: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '8px',
        backdropFilter: 'blur(10px)',
        alignItems: 'center',
      }}>
        {/* Start/Play/Pause Button */}
        <button
          onClick={!isRunning ? onStart : handlePause}
          style={{
            padding: '6px 10px',
            fontSize: '14px',
            background: !isRunning ? '#22c55e' : (isPaused ? '#22c55e' : '#ef4444'),
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            minWidth: '40px',
          }}
        >
          {!isRunning ? '▶' : (isPaused ? '▶' : '⏸')}
        </button>
        
        {/* Render Mode Toggle */}
        {onRenderModeChange && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => onRenderModeChange('2D')}
              style={{
                padding: '6px 8px',
                fontSize: '12px',
                background: renderMode === '2D' ? '#3b82f6' : '#4b5563',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title="2D view"
            >
              2D
            </button>
            <button
              onClick={() => onRenderModeChange('3D-Planet')}
              style={{
                padding: '6px 8px',
                fontSize: '12px',
                background: renderMode === '3D-Planet' ? '#3b82f6' : '#4b5563',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title="3D Orbital view"
            >
              3D 🌍
            </button>
          </div>
        )}
        
        {/* Show UI Button */}
        <button
          onClick={toggleControlsVisibility}
          style={{
            marginLeft: 'auto',
            padding: '6px 10px',
            fontSize: '12px',
            background: 'rgba(59, 130, 246, 0.8)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Show UI
        </button>
      </div>
    );
  }
  
  return (
    <div style={{
      display: 'flex',
      gap: '6px',
      padding: '4px 6px',
      background: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '6px',
      backdropFilter: 'blur(10px)',
      alignItems: 'center',
      flexWrap: 'nowrap',
      maxWidth: '100%',
      overflowX: 'auto',
    }}>
      {/* Pause/Play Button */}
      <StyledButton
        onClick={handlePause}
        disabled={!isRunning}
        color={isPaused ? 'green' : 'red'}
        size="small"
        style={{ minWidth: '45px' }}
      >
        <span style={{ fontSize: '16px' }}>
          {isPaused ? '▶' : '⏸'}
        </span>
      </StyledButton>
      
      {/* Speed and Size Controls - Stacked */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '2px',
        minWidth: '120px',
        padding: '2px 4px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '4px',
      }}>
        <CompactSlider
          label="Speed"
          value={sliderValue}
          onChange={(value) => {
            setSliderValue(value);
            const speedMul = speedValues[value];
            handleSpeed(speedMul);
          }}
          min={0}
          max={speedValues.length - 1}
          step={1}
          color="#3b82f6"
          displayValue={`${speed < 1 ? speed.toFixed(1) : speed}×`}
        />
        <CompactSlider
          label="Size"
          value={entitySize}
          onChange={(value) => {
            console.log('[Controls] Entity size slider changed to:', value);
            onEntitySizeChange(value);
          }}
          min={0.5}
          max={25}
          step={0.1}
          color="#10b981"
          displayValue={entitySize.toFixed(0)}
        />
      </div>
      
      {/* View Mode */}
      {onRenderModeChange && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span style={{ fontSize: '9px', color: '#64748b', fontWeight: '500' }}>VIEW</span>
          <div style={{ display: 'flex', gap: '2px' }}>
            <ButtonGroup>
              <StyledButton
                onClick={() => onRenderModeChange('2D')}
                active={renderMode === '2D'}
                color="blue"
                size="small"
                variant="toggle"
                title="2D Flat view"
              >
                2D
              </StyledButton>
              <StyledButton
                onClick={() => onRenderModeChange('3D-Planet')}
                active={renderMode === '3D-Planet'}
                color="blue"
                size="small"
                variant="toggle"
                title="3D Orbital view"
              >
                3D
              </StyledButton>
            </ButtonGroup>
            <StyledButton
              onClick={toggleControlsVisibility}
              color="gray"
              size="small"
              title="Hide UI (H key)"
            >
              Hide
            </StyledButton>
            <StyledButton
              onClick={toggleFullscreen}
              active={isFullscreen}
              color="gray"
              size="small"
              variant="toggle"
              title="Toggle fullscreen (F key)"
            >
              {isFullscreen ? 'Exit' : 'FS'}
            </StyledButton>
          </div>
        </div>
      )}
      
      {/* Layers Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <span style={{ fontSize: '9px', color: '#64748b', fontWeight: '500' }}>LAYERS</span>
        <div style={{ display: 'flex', gap: '2px' }}>
          {/* Food Display Toggle */}
          {onShowFoodChange && (
            <StyledButton
              onClick={() => onShowFoodChange(!showFood)}
              active={showFood}
              color="green"
              size="small"
              variant="toggle"
              title={showFood ? 'Hide food layer' : 'Show food layer'}
            >
              Food
            </StyledButton>
          )}

          {/* Boundary Visualization Toggle */}
          {onShowBoundariesChange && (
            <StyledButton
              onClick={() => onShowBoundariesChange(!showBoundaries)}
              active={showBoundaries}
              color="violet"
              size="small"
              variant="toggle"
              title={showBoundaries ? 'Hide boundary lines' : 'Show boundary lines'}
            >
              Boundaries
            </StyledButton>
          )}

          {/* Biome Display Mode */}
          {onBiomeModeChange && (
            <ButtonGroup>
              <StyledButton
                onClick={() => onBiomeModeChange('hidden')}
                active={biomeMode === 'hidden'}
                color="gray"
                size="small"
                variant="toggle"
                title="Hide biomes"
              >
                Off
              </StyledButton>
              <StyledButton
                onClick={() => onBiomeModeChange('natural')}
                active={biomeMode === 'natural'}
                color="emerald"
                size="small"
                variant="toggle"
                title="Natural biome colors"
              >
                Biomes
              </StyledButton>
              <StyledButton
                onClick={() => onBiomeModeChange('highlight')}
                active={biomeMode === 'highlight'}
                color="purple"
                size="small"
                variant="toggle"
                title="Highlight biome types"
              >
                Highlight
              </StyledButton>
            </ButtonGroup>
          )}
        </div>
      </div>
    </div>
  );
}