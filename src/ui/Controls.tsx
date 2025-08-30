import { useState, useEffect } from 'react';
import type { SimClient } from '../client/setupSimClientHybrid';

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
  renderMode?: '2D' | '3D';
  onRenderModeChange?: (mode: '2D' | '3D') => void;
}

export function Controls({ client, isRunning, onStart, entitySize, onEntitySizeChange, renderMode = '2D', onRenderModeChange }: ControlsProps) {
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

  return (
    <div style={{
      display: 'flex',
      gap: '16px',
      padding: '12px',
      background: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '8px',
      backdropFilter: 'blur(10px)',
      alignItems: 'stretch',
      flexWrap: 'wrap',
    }}>
      {/* Pause/Play Button - Centered in its container */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60px',
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <button
          onClick={handlePause}
          disabled={!isRunning}
          style={{
            padding: '8px 16px',
            fontSize: '16px',
            lineHeight: '16px',
            height: '40px',
            background: !isRunning ? '#4b5563' : (isPaused ? '#22c55e' : '#ef4444'),
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'pointer' : 'not-allowed',
            opacity: isRunning ? 1 : 0.5,
            minWidth: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
          }}
        >
          <span style={{ fontSize: '18px', lineHeight: '18px', display: 'block' }}>
            {isPaused ? '▶' : '⏸'}
          </span>
        </button>
      </div>
      
      {/* Speed and Size Controls */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '8px',
        flex: '1 1 280px',
        minWidth: '280px',
        minHeight: '60px',
        justifyContent: 'center',
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
        }}>
          <span style={{ 
            color: 'white', 
            fontSize: '13px',
            fontWeight: '500',
            minWidth: '45px',
          }}>
            Speed
          </span>
          <div style={{ flex: 1 }}>
            <StyledSlider
              min={0}
              max={speedValues.length - 1}
              step={1}
              value={sliderValue}
              onChange={handleSliderChange}
              steps={speedValues}
              stepLabels={speedValues.map(s => s < 1 ? s.toFixed(1) : s)}
              style={{ marginBottom: '8px' }}
            />
          </div>
          <span style={{ 
            color: '#60a5fa', 
            fontSize: '13px',
            fontWeight: '600',
            minWidth: '35px',
            textAlign: 'right',
          }}>
            {speed < 1 ? speed.toFixed(2) : speed}×
          </span>
        </div>
        
        {/* Entity Size Control */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
        }}>
          <span style={{ 
            color: 'white', 
            fontSize: '13px',
            fontWeight: '500',
            minWidth: '45px',
          }}>
            Size
          </span>
          <div style={{ flex: 1 }}>
            <input
              type="range"
              min={0.5}
              max={25}
              step={0.1}
              value={entitySize}
              onChange={(e) => onEntitySizeChange(parseFloat(e.target.value))}
              style={{
                width: '100%',
                height: '12px',
                background: `linear-gradient(to right, #10b981 0%, #10b981 ${((entitySize - 0.5) / 24.5) * 100}%, #2d3748 ${((entitySize - 0.5) / 24.5) * 100}%, #2d3748 100%)`,
                borderRadius: '3px',
                outline: 'none',
              }}
              className="custom-slider"
            />
          </div>
          <span style={{ 
            color: '#60a5fa', 
            fontSize: '13px',
            fontWeight: '600',
            minWidth: '35px',
            textAlign: 'right',
          }}>
            {entitySize.toFixed(1)}
          </span>
        </div>
      </div>
      
      {/* Render Mode Toggle */}
      {onRenderModeChange && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60px',
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <button
            onClick={() => onRenderModeChange(renderMode === '2D' ? '3D' : '2D')}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              lineHeight: '14px',
              height: '40px',
              background: renderMode === '3D' ? '#3b82f6' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              minWidth: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxSizing: 'border-box',
              transition: 'background 0.2s',
            }}
            title={`Switch to ${renderMode === '2D' ? '3D Planet' : '2D Flat'} view`}
          >
            <span style={{ fontSize: '16px' }}>
              {renderMode === '2D' ? '🌍' : '🗺️'}
            </span>
            <span style={{ fontWeight: '500' }}>
              {renderMode === '2D' ? '3D' : '2D'}
            </span>
          </button>
        </div>
      )}
      
    </div>
  );
}