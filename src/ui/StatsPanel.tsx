import React, { useEffect, useState, memo } from 'react';
import type { SimClient } from '../client/setupSimClient';
import type { SimStats } from '../sim/types';
import { PopulationGraph } from './PopulationGraph';

export interface StatsPanelProps {
  client: SimClient;
}

export const StatsPanel = memo(function StatsPanel({ client }: StatsPanelProps) {
  const [stats, setStats] = useState<SimStats | null>(null);

  useEffect(() => {
    const unsubscribe = client.onMessage(m => {
      if (m.type === 'stats') {
        setStats(m.payload);
      }
    });
    return unsubscribe;
  }, [client]);

  if (!stats) {
    return (
      <div style={{ color: '#888', padding: '12px' }}>
        Initializing simulation...
      </div>
    );
  }

  return (
    <div style={{
      padding: '16px',
      background: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '8px',
      backdropFilter: 'blur(10px)',
      fontSize: '14px',
      lineHeight: '1.6',
    }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>
        Simulation Stats
      </h3>
      
      <div style={{ display: 'grid', gap: '8px' }}>
        <div>
          <span style={{ color: '#888' }}>Time:</span>{' '}
          <span style={{ color: '#fff', fontWeight: 'bold' }}>
            {stats.t.toFixed(1)}s
          </span>
        </div>
        
        <div>
          <span style={{ color: '#888' }}>Population:</span>{' '}
          <span style={{ color: '#fff', fontWeight: 'bold' }}>
            {stats.population.toLocaleString()}
          </span>
        </div>

        <div style={{ marginTop: '8px' }}>
          <div style={{ color: '#888', marginBottom: '4px' }}>Avg Traits:</div>
          <div style={{ paddingLeft: '12px', fontSize: '13px' }}>
            <div>Speed: {stats.mean.speed.toFixed(1)}</div>
            <div>Vision: {stats.mean.vision.toFixed(1)}</div>
            <div>Metabolism: {stats.mean.metabolism.toFixed(3)}</div>
          </div>
        </div>

        <div style={{ marginTop: '8px' }}>
          <div style={{ color: '#888', marginBottom: '4px' }}>Tribes:</div>
          <div style={{ fontSize: '13px' }}>
            {Object.entries(stats.byTribe).map(([name, tribe]) => (
              <div key={name} style={{ 
                marginBottom: '8px',
                padding: '8px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '4px',
                borderLeft: `3px solid ${tribe.color || '#3b82f6'}`,
              }}>
                <div style={{ 
                  fontWeight: 'bold', 
                  color: tribe.color || '#3b82f6',
                  marginBottom: '4px',
                }}>
                  {name}
                </div>
                <div style={{ 
                  color: '#bbb',
                  fontSize: '12px',
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'nowrap',
                }}>
                  <span style={{ whiteSpace: 'nowrap' }}>Count: {tribe.count}</span>
                  <span style={{ whiteSpace: 'nowrap' }}>Births: {tribe.births}</span>
                  <span style={{ whiteSpace: 'nowrap' }}>Deaths: {tribe.deaths}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <PopulationGraph client={client} />
    </div>
  );
});