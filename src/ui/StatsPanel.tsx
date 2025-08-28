import { useEffect, useState, memo, useRef } from 'react';
import type { SimClient } from '../client/setupSimClient';
import type { SimStats, TribeStats } from '../sim/types';
import { PopulationGraph } from './PopulationGraph';
import { RadarChart } from './RadarChart';
import { TraitHistogram } from './TraitHistogram';
import { PopulationDominance } from './PopulationDominance';
import { CollapsibleSection } from './CollapsibleSection';
import { PerformancePanel } from './PerformancePanel';

export interface StatsPanelProps {
  client: SimClient;
}

export const StatsPanel = memo(function StatsPanel({ client }: StatsPanelProps) {
  const [stats, setStats] = useState<SimStats | null>(null);
  const [viewMode, setViewMode] = useState<'dominance' | 'compare' | 'details'>('dominance');
  const [simPerf, setSimPerf] = useState({ fps: 0, simSpeed: 0, speedMul: 1 });
  const tribeOrderRef = useRef<string[]>([]);
  const lastKnownDataRef = useRef<Record<string, TribeStats>>({});

  useEffect(() => {
    const unsubscribe = client.onMessage(m => {
      if (m.type === 'stats') {
        const newStats = m.payload;

        // Update tribe order and last known data
        if (newStats.byTribe) {
          // Add new tribes to order
          Object.keys(newStats.byTribe).forEach(name => {
            if (!tribeOrderRef.current.includes(name)) {
              tribeOrderRef.current.push(name);
            }
          });

          // Update last known data for all tribes
          Object.entries(newStats.byTribe).forEach(([name, tribe]) => {
            lastKnownDataRef.current[name] = tribe;
          });
        }

        setStats(newStats);
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
      maxHeight: '100vh',
      lineHeight: '1.4',
    }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold' }}>
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
            onClick={() => setViewMode('dominance')}
            style={{
              flex: 1,
              padding: '4px',
              background: viewMode === 'dominance' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '3px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Dominance
          </button>
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

        {viewMode === 'dominance' ? (
          <PopulationDominance stats={stats} />
        ) : viewMode === 'compare' ? (
          <div style={{ fontSize: '11px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', color: '#888', padding: '4px' }}>Tribe</th>
                  <th style={{ textAlign: 'center', color: '#888', padding: '2px' }}>Pop</th>
                  <th style={{ textAlign: 'center', color: '#888', padding: '2px' }}>Speed</th>
                  <th style={{ textAlign: 'center', color: '#888', padding: '2px' }}>Vision</th>
                  <th style={{ textAlign: 'center', color: '#888', padding: '2px' }}>Metab</th>
                  <th style={{ textAlign: 'center', color: '#888', padding: '2px' }}>Repro</th>
                  <th style={{ textAlign: 'center', color: '#888', padding: '2px' }}>Aggr</th>
                  <th style={{ textAlign: 'center', color: '#888', padding: '2px' }}>Pick</th>
                  <th style={{ textAlign: 'center', color: '#888', padding: '2px' }}>Diet</th>
                  <th style={{ textAlign: 'center', color: '#888', padding: '2px' }}>K/S</th>
                </tr>
              </thead>
              <tbody>
                  {tribeOrderRef.current.map(name => {
                    const tribe = stats.byTribe[name] || lastKnownDataRef.current[name];
                    if (!tribe) return null;
                    const isExtinct = !stats.byTribe[name];
                    return (
                      <tr key={name} style={{ opacity: isExtinct ? 0.4 : 1 }}>
                        <td style={{ color: tribe.color, fontWeight: 'bold', padding: '4px' }}>
                        {name} {isExtinct && '†'}
                      </td>
                      <td style={{ textAlign: 'center', color: isExtinct ? '#666' : '#fff', padding: '2px' }}>
                        {tribe.count}
                      </td>
                      <td style={{ textAlign: 'center', color: isExtinct ? '#666' : '#bbb', padding: '2px' }}>
                        {tribe.mean.speed.toFixed(0)}
                      </td>
                      <td style={{ textAlign: 'center', color: isExtinct ? '#666' : '#bbb', padding: '2px' }}>
                        {tribe.mean.vision.toFixed(0)}
                      </td>
                      <td style={{ textAlign: 'center', color: isExtinct ? '#666' : '#bbb', padding: '2px' }}>
                        {tribe.mean.metabolism.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center', color: isExtinct ? '#666' : '#bbb', padding: '2px' }}>
                        {tribe.mean.reproChance.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center', color: isExtinct ? '#666' : '#bbb', padding: '2px' }}>
                        {tribe.mean.aggression.toFixed(1)}
                      </td>
                      <td style={{ textAlign: 'center', color: isExtinct ? '#666' : '#bbb', padding: '2px' }}>
                        {tribe.mean.foodStandards?.toFixed(1) || '0.3'}
                      </td>
                      <td style={{ textAlign: 'center', color: isExtinct ? '#666' : '#bbb', padding: '2px' }}>
                        {tribe.mean.diet?.toFixed(1) || '-0.5'}
                      </td>
                      <td style={{ textAlign: 'center', color: '#999', padding: '2px', fontSize: '10px' }}>
                        {tribe.kills || 0}/{tribe.starved || 0}
                      </td>
                    </tr>
                  );
                })}
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
                  <td style={{ textAlign: 'center', color: '#bbb', padding: '2px' }}>
                    {stats.global.mean.foodStandards?.toFixed(1) || '0.3'}
                  </td>
                  <td style={{ textAlign: 'center', color: '#bbb', padding: '2px' }}>
                    {stats.global.mean.diet?.toFixed(1) || '-0.5'}
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
                {tribeOrderRef.current.map(name => {
                  const tribe = stats.byTribe[name] || lastKnownDataRef.current[name];
                  if (!tribe) return null;
                  const isExtinct = !stats.byTribe[name];
                  return (
                    <details key={name} style={{ marginBottom: '4px', opacity: isExtinct ? 0.4 : 1 }}>
                      <summary style={{
                        cursor: 'pointer',
                        padding: '4px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '3px',
                        borderLeft: `2px solid ${tribe.color}`,
                        color: tribe.color,
                        fontWeight: 'bold',
                      }}>
                    {name} {isExtinct && '†'}: {tribe.count} ({tribe.births}↑ {tribe.deaths}↓)
                  </summary>
                <div style={{ padding: '4px 8px', fontSize: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', color: '#bbb' }}>
                    <div>Speed: {tribe.mean.speed.toFixed(1)}</div>
                    <div>Vision: {tribe.mean.vision.toFixed(1)}</div>
                    <div>Metabolism: {tribe.mean.metabolism.toFixed(3)}</div>
                    <div>Reproduce: {tribe.mean.reproChance.toFixed(3)}</div>
                    <div>Aggression: {tribe.mean.aggression.toFixed(2)}</div>
                    <div>Cohesion: {tribe.mean.cohesion.toFixed(2)}</div>
                    <div>Pickiness: {tribe.mean.foodStandards?.toFixed(2) || '0.30'}</div>
                    <div>Diet: {(() => {
                      const diet = tribe.mean.diet || -0.5;
                      if (diet < -0.7) return 'Herbivore';
                      if (diet < -0.3) return 'Herb-lean';
                      if (diet < 0.3) return 'Omnivore';
                      if (diet < 0.7) return 'Carn-lean';
                      return 'Carnivore';
                    })()}</div>
                  </div>
                  <div style={{ marginTop: '4px', color: '#888' }}>
                    Kills: {tribe.kills || 0} | Starved: {tribe.starved || 0}
                  </div>
                </div>
              </details>
              );
            })}
          </div>
        )}
      </div>
      
      <CollapsibleSection title="Trait Comparison" defaultOpen={true}>
        <RadarChart stats={stats} />
      </CollapsibleSection>
      
      <CollapsibleSection title="Trait Distribution" defaultOpen={false}>
        <TraitHistogram stats={stats} />
      </CollapsibleSection>
      
      <CollapsibleSection title="Population History" defaultOpen={false}>
        <PopulationGraph client={client} />
      </CollapsibleSection>
      
      <PerformancePanel client={client} />
    </div>
  );
});