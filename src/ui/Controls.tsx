import React, { useState, useEffect } from 'react';
import type { SimClient } from '../client/setupSimClient';

export interface ControlsProps {
  client: SimClient;
  isRunning: boolean;
  onStart: () => void;
}

export function Controls({ client, isRunning, onStart }: ControlsProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);

  const handlePause = () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    client.pause(newPaused);
  };

  const handleSpeed = (speedMul: number) => {
    setSpeed(speedMul);
    client.setSpeed(speedMul);
    if (isPaused && speedMul > 0) {
      setIsPaused(false);
      client.pause(false);
    }
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
      
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {[0.1, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128].map(s => (
          <button
            key={s}
            onClick={() => handleSpeed(s)}
            style={{
              padding: '8px 12px',
              fontSize: '14px',
              background: speed === s ? '#3b82f6' : '#1e293b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background 0.2s',
              minWidth: '45px',
            }}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}