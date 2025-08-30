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
            const showLabel = steps && (index === 0 || index === 3 || index === 6 || index === 9); // Show key speeds: 0.1×, 1×, 8×, 64×
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
}

export function Controls({ client, isRunning, onStart, entitySize, onEntitySizeChange }: ControlsProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const speedValues = [0.1, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];
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
      gap: '8px',
      padding: '12px',
      background: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '8px',
      backdropFilter: 'blur(10px)',
    }}>
      <button
        onClick={handlePause}
        disabled={!isRunning}
        style={{
          padding: '8px 16px',
          fontSize: '16px',
          lineHeight: '16px',
          height: '36px',
          background: !isRunning ? '#4b5563' : (isPaused ? '#22c55e' : '#ef4444'),
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isRunning ? 'pointer' : 'not-allowed',
          opacity: isRunning ? 1 : 0.5,
          minWidth: '50px',
          width: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ fontSize: '16px', lineHeight: '16px', display: 'block' }}>
          {isPaused ? '▶' : '⏸'}
        </span>
      </button>
      
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '8px',
        flex: 1,
        minWidth: '250px',
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
    </div>
  );
}