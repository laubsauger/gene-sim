import { useState, useEffect } from 'react';
import type { SimClient } from '../client/setupSimClientHybrid';

export interface ControlsProps {
  client: SimClient;
  isRunning: boolean;
  onStart: () => void;
}

export function Controls({ client, isRunning, onStart }: ControlsProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [sliderValue, setSliderValue] = useState(50);

  const handlePause = () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    client.pause(newPaused);
  };

  const speedValues = [0.1, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];
  
  const sliderToSpeed = (value: number) => {
    const index = Math.round((value / 100) * (speedValues.length - 1));
    return speedValues[index];
  };
  
  const speedToSlider = (speedMul: number) => {
    const index = speedValues.indexOf(speedMul);
    if (index === -1) {
      const closest = speedValues.reduce((prev, curr) => 
        Math.abs(curr - speedMul) < Math.abs(prev - speedMul) ? curr : prev
      );
      return (speedValues.indexOf(closest) / (speedValues.length - 1)) * 100;
    }
    return (index / (speedValues.length - 1)) * 100;
  };
  
  const handleSpeed = (speedMul: number) => {
    setSpeed(speedMul);
    client.setSpeed(speedMul);
    if (isPaused && speedMul > 0) {
      setIsPaused(false);
      client.pause(false);
    }
  };
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setSliderValue(value);
    const speedMul = sliderToSpeed(value);
    handleSpeed(speedMul);
  };
  
  // Add spacebar pause/play or start
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        if (!isRunning) {
          onStart();
        } else {
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
        alignItems: 'center', 
        gap: '12px',
        flex: 1,
        minWidth: '200px',
      }}>
        <span style={{ 
          color: 'white', 
          fontSize: '14px',
          minWidth: '45px',
          textAlign: 'right',
        }}>
          {speed < 1 ? speed.toFixed(2) : speed}×
        </span>
        <input
          type="range"
          min="0"
          max="100"
          value={sliderValue}
          onChange={handleSliderChange}
          disabled={!isRunning}
          style={{
            flex: 1,
            height: '6px',
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${sliderValue}%, #1e293b ${sliderValue}%, #1e293b 100%)`,
            borderRadius: '3px',
            outline: 'none',
            WebkitAppearance: 'none',
            appearance: 'none',
            cursor: isRunning ? 'pointer' : 'not-allowed',
            opacity: isRunning ? 1 : 0.5,
          }}
        />
        <style>{`
          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 18px;
            height: 18px;
            background: #3b82f6;
            border: 2px solid white;
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.2s;
          }
          input[type="range"]::-webkit-slider-thumb:hover {
            transform: scale(1.2);
            background: #60a5fa;
          }
          input[type="range"]::-moz-range-thumb {
            width: 18px;
            height: 18px;
            background: #3b82f6;
            border: 2px solid white;
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.2s;
          }
          input[type="range"]::-moz-range-thumb:hover {
            transform: scale(1.2);
            background: #60a5fa;
          }
        `}</style>
      </div>
    </div>
  );
}