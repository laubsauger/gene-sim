import React, { useState } from 'react';
import type { SimClient } from '../client/setupSimClient';

export interface ControlsProps {
  client: SimClient;
}

export function Controls({ client }: ControlsProps) {
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
        style={{
          padding: '8px 16px',
          fontSize: '16px',
          background: isPaused ? '#22c55e' : '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        {isPaused ? '▶️' : '⏸'}
      </button>
      
      <div style={{ display: 'flex', gap: '4px' }}>
        {[0.5, 1, 2, 8].map(s => (
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
            }}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}