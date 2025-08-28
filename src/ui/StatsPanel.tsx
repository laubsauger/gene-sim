import React, { useEffect, useState, memo } from 'react';
import type { SimClient } from '../client/setupSimClient';
import type { SimStats } from '../sim/types';
import { PopulationGraph } from './PopulationGraph';
import { RadarChart } from './RadarChart';
import { TraitHistogram } from './TraitHistogram';

export interface StatsPanelProps {
  client: SimClient;
}

export const StatsPanel = memo(function StatsPanel({ client }: StatsPanelProps) {
  const [stats, setStats] = useState<SimStats | null>(null);
  const [viewMode, setViewMode] = useState<'details' | 'compare'>('compare');
  const [simPerf, setSimPerf] = useState({ fps: 0, simSpeed: 0, speedMul: 1 });

  useEffect(() => {
    const unsubscribe = client.onMessage(m => {
      if (m.type === 'stats') {
        setStats(m.payload);
      } else if (m.type === 'perf') {
        setSimPerf(m.payload);
      }
    });
    return unsubscribe;
  }, [client]);

  if (!stats) {
    return (
      <div style={{ color: '#888', padding: '10px' }}>
        Initializing simulation...
      </div>
    );
  }

  return (
    <div style={{
      padding: '10px',
      background: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '6px',
      backdropFilter: 'blur(10px)',
      fontSize: '12px',
      lineHeight: '1.4',
    }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>
        Simulation Stats
      </h3>
      <div style={{ display: 'grid', gap: '6px' }}>
        {/* Population and time stats */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '4px 0',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div>
            <span style={{ color: '#888' }}>Pop:</span> <b>{stats.population.toLocaleString()}</b>
          </div>
          <div>
            <span style={{ color: '#888' }}>Time:</span> <b>{stats.t.toFixed(1)}s</b>
          </div>
        </div>
        
        {/* Performance metrics */}
        <div style={{ 
          fontSize: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          padding: '2px 0',
          marginBottom: '4px'
        }}>
          <span style={{ color: simPerf.fps < 30 ? '#f87171' : simPerf.fps < 50 ? '#fbbf24' : '#34d399' }}>
            Render: {simPerf.fps}fps
          </span>
          <span style={{ color: simPerf.simSpeed < 30 ? '#f87171' : simPerf.simSpeed < 50 ? '#fbbf24' : '#34d399' }}>
            Sim: {simPerf.simSpeed}Hz @ {simPerf.speedMul}×
          </span>
        </div>

        <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
          <button
            onClick={() => setViewMode('compare')}
            style={{
              flex: 1,
              padding: '4px',
              background: viewMode === 'compare' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '3px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Compare
          </button>
          <button
            onClick={() => setViewMode('details')}
            style={{
              flex: 1,
              padding: '4px',
              background: viewMode === 'details' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '3px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Details
          </button>
        </div>

        {viewMode === 'compare' ? (
          <div style={{ fontSize: '11px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', color: '#888', padding: '4px' }}>Tribe</th>
                  <th style={{ textAlign: 'center', color: '#888', padding: '2px' }}>Pop</th>
                  <th style={{ textAlign: 'center', color: '#888', padding: '2px' }}>Spd</th>
                  <th style={{ textAlign: 'center', color: '#888', padding: '2px' }}>Vis</th>
                  <th style={{ textAlign: 'center', color: '#888', padding: '2px' }}>Met</th>
                  <th style={{ textAlign: 'center', color: '#888', padding: '2px' }}>Rep</th>
                  <th style={{ textAlign: 'center', color: '#888', padding: '2px' }}>Agg</th>
                  <th style={{ textAlign: 'center', color: '#888', padding: '2px' }}>KD</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byTribe).map(([name, tribe]) => (
                  <tr key={name}>
                    <td style={{ color: tribe.color, fontWeight: 'bold', padding: '4px' }}>
                      {name}
                    </td>
                    <td style={{ textAlign: 'center', color: '#fff', padding: '2px' }}>
                      {tribe.count}
                    </td>
                    <td style={{ textAlign: 'center', color: '#bbb', padding: '2px' }}>
                      {tribe.mean.speed.toFixed(0)}
                    </td>
                    <td style={{ textAlign: 'center', color: '#bbb', padding: '2px' }}>
                      {tribe.mean.vision.toFixed(0)}
                    </td>
                    <td style={{ textAlign: 'center', color: '#bbb', padding: '2px' }}>
                      {tribe.mean.metabolism.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center', color: '#bbb', padding: '2px' }}>
                      {tribe.mean.reproChance.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center', color: '#bbb', padding: '2px' }}>
                      {tribe.mean.aggression.toFixed(1)}
                    </td>
                    <td style={{ textAlign: 'center', color: '#999', padding: '2px', fontSize: '10px' }}>
                      {tribe.kills || 0}/{tribe.starved || 0}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid #444' }}>
                  <td style={{ color: '#fff', fontWeight: 'bold', padding: '4px' }}>
                    Global
                  </td>
                  <td style={{ textAlign: 'center', color: '#fff', padding: '2px' }}>
                    {stats.population}
                  </td>
                  <td style={{ textAlign: 'center', color: '#bbb', padding: '2px' }}>
                    {stats.global.mean.speed.toFixed(0)}
                  </td>
                  <td style={{ textAlign: 'center', color: '#bbb', padding: '2px' }}>
                    {stats.global.mean.vision.toFixed(0)}
                  </td>
                  <td style={{ textAlign: 'center', color: '#bbb', padding: '2px' }}>
                    {stats.global.mean.metabolism.toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'center', color: '#bbb', padding: '2px' }}>
                    {stats.global.mean.reproChance.toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'center', color: '#bbb', padding: '2px' }}>
                    {stats.global.mean.aggression.toFixed(1)}
                  </td>
                  <td style={{ textAlign: 'center', color: '#999', padding: '2px', fontSize: '10px' }}>
                    -
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ fontSize: '11px' }}>
            {Object.entries(stats.byTribe).map(([name, tribe]) => (
              <details key={name} style={{ marginBottom: '4px' }}>
                <summary style={{
                  cursor: 'pointer',
                  padding: '4px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '3px',
                  borderLeft: `2px solid ${tribe.color}`,
                  color: tribe.color,
                  fontWeight: 'bold',
                }}>
                  {name}: {tribe.count} ({tribe.births}↑ {tribe.deaths}↓)
                </summary>
                <div style={{ padding: '4px 8px', fontSize: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', color: '#bbb' }}>
                    <div>Spd: {tribe.mean.speed.toFixed(1)}</div>
                    <div>Vis: {tribe.mean.vision.toFixed(1)}</div>
                    <div>Met: {tribe.mean.metabolism.toFixed(3)}</div>
                    <div>Rep: {tribe.mean.reproChance.toFixed(3)}</div>
                    <div>Agg: {tribe.mean.aggression.toFixed(2)}</div>
                    <div>Coh: {tribe.mean.cohesion.toFixed(2)}</div>
                  </div>
                  <div style={{ marginTop: '4px', color: '#888' }}>
                    Kills: {tribe.kills || 0} | Starved: {tribe.starved || 0}
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
      
      <RadarChart stats={stats} />
      <TraitHistogram stats={stats} />
      <PopulationGraph client={client} />
    </div>
  );
});