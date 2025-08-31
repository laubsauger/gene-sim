import { useState, useEffect } from 'react';
import type { SimClient } from '../client/setupSimClientHybrid';
import { CompactSlider } from './CompactSlider';
import { StyledButton, ButtonGroup } from './ButtonStyles';

// Reuse the StyledSlider from SimulationSetup
interface StyledSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  step?: number;
  style?: React.CSSProperties;
  steps?: number[];
  stepLabels?: (string | number)[];
}

const StyledSlider = ({ min, max, value, onChange, step = 1, style = {}, steps, stepLabels }: StyledSliderProps) => {
  const percentage = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        style={{
          width: '100%',
          height: '12px',
          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #2d3748 ${percentage}%, #2d3748 100%)`,
          borderRadius: '3px',
          outline: 'none',
          ...style
        }}
        className="custom-slider"
      />
      {steps && stepLabels && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          position: 'absolute',
          width: '100%',
          top: '20px',
          pointerEvents: 'none',
        }}>
          {stepLabels.map((label, index) => {
            const showLabel = steps && (index === 0 || index === 3 || index === 6 || index === 8); // Show key speeds: 0.1×, 1×, 8×, 16×
            return showLabel ? (
              <span
                key={index}
                style={{
                  fontSize: '11px',
                  color: value === index ? '#60a5fa' : '#64748b',
                  fontWeight: value === index ? '600' : '400',
                  transition: 'all 0.15s ease',
                }}
              >
                {label}×
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
};

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
  controlsHidden?: boolean;
  onToggleControls?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function Controls({ client, isRunning, onStart, entitySize, onEntitySizeChange, renderMode = '2D', onRenderModeChange, showFood = true, onShowFoodChange, showBoundaries = false, onShowBoundariesChange, biomeMode = 'natural', onBiomeModeChange, controlsHidden = false, onToggleControls, isFullscreen = false, onToggleFullscreen }: ControlsProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const speedValues = [0.1, 0.25, 0.5, 1, 2, 4, 8, 12, 16];
  const [sliderValue, setSliderValue] = useState(3); // Start at index 3 (1×)

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
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value);
    setSliderValue(index);
    const speedMul = speedValues[index];
    handleSpeed(speedMul);
  };
  
  // Add spacebar pause/play or start
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        if (!isRunning) {
          onStart();
        } else if (client) {
          const newPaused = !isPaused;
          setIsPaused(newPaused);
          client.pause(newPaused);
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isPaused, isRunning, onStart, client]);

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
        {/* Play/Pause Button */}
        <button
          onClick={handlePause}
          disabled={!isRunning}
          style={{
            padding: '6px 10px',
            fontSize: '14px',
            background: !isRunning ? '#4b5563' : (isPaused ? '#22c55e' : '#ef4444'),
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'pointer' : 'not-allowed',
            opacity: isRunning ? 1 : 0.5,
            minWidth: '40px',
          }}
        >
          {isPaused ? '▶' : '⏸'}
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
              onClick={() => onRenderModeChange('3D')}
              style={{
                padding: '6px 8px',
                fontSize: '12px',
                background: renderMode === '3D' ? '#3b82f6' : '#4b5563',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title="3D view"
            >
              3D
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
              title="Orbital view"
            >
              🪐
            </button>
          </div>
        )}
        
        {/* Show UI Button */}
        {onToggleControls && (
          <button
            onClick={onToggleControls}
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
        )}
      </div>
    );
  }
  
  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      padding: '8px',
      background: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '8px',
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
        gap: '4px',
        minWidth: '140px',
        padding: '4px 8px',
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
          displayValue={entitySize.toFixed(1)}
        />
      </div>
      
      {/* View Mode */}
      {onRenderModeChange && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '9px', color: '#64748b', fontWeight: '500', marginBottom: '2px' }}>VIEW</span>
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
              onClick={() => onRenderModeChange('3D')}
              active={renderMode === '3D'}
              color="blue"
              size="small"
              variant="toggle"
              title="3D Planet view"
            >
              3D
            </StyledButton>
            <StyledButton
              onClick={() => onRenderModeChange('3D-Planet')}
              active={renderMode === '3D-Planet'}
              color="blue"
              size="small"
              variant="toggle"
              title="3D Orbital view"
            >
              Orbit
            </StyledButton>
          </ButtonGroup>
        </div>
      )}
      
      {/* Layers Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ fontSize: '9px', color: '#64748b', fontWeight: '500', marginBottom: '2px' }}>LAYERS</span>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
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
              <span style={{ fontSize: '13px' }}>🌾</span>
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
      
      {/* UI Visibility and Fullscreen Controls */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginLeft: 'auto', // Push to the right
      }}>
        {onToggleControls && (
          <StyledButton
            onClick={onToggleControls}
            color="gray"
            size="small"
            title="Hide UI (F key)"
          >
            Hide UI
          </StyledButton>
        )}
        {onToggleFullscreen && (
          <StyledButton
            onClick={onToggleFullscreen}
            active={isFullscreen}
            color="gray"
            size="small"
            variant="toggle"
            title="Toggle fullscreen (F11)"
          >
            {isFullscreen ? 'Exit' : 'Full'}
          </StyledButton>
        )}
      </div>
      
    </div>
  );
}