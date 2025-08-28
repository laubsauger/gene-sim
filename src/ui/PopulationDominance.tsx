import { useMemo } from 'react';
import type { SimStats } from '../sim/types';

interface PopulationDominanceProps {
  stats: SimStats | null;
}

export function PopulationDominance({ stats }: PopulationDominanceProps) {
  const dominanceData = useMemo(() => {
    if (!stats?.byTribe) return [];

    // Calculate total population
    const totalPop = Object.values(stats.byTribe).reduce((sum, t) => sum + t.count, 0);

    // Create array with percentages, maintaining consistent order by name
    return Object.entries(stats.byTribe)
      .map(([name, tribe]) => ({
        name,
        count: tribe.count,
        percentage: totalPop > 0 ? (tribe.count / totalPop) * 100 : 0,
        color: tribe.color,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically for consistency
  }, [stats]);

  const totalPopulation = useMemo(() =>
    dominanceData.reduce((sum, t) => sum + t.count, 0),
    [dominanceData]
  );

  return (
    <div style={{ padding: '16px' }}>
      {/* Stacked bar chart */}
      <div style={{
        width: '100%',
        height: '40px',
        background: '#1a1a1a',
        borderRadius: '4px',
        overflow: 'hidden',
        display: 'flex',
        marginBottom: '16px',
        border: '1px solid #333',
      }}>
        {dominanceData.map((tribe) => (
          tribe.percentage > 0.5 && ( // Only show if > 0.5% to avoid too tiny slices
            <div
              key={tribe.name}
              style={{
                width: `${tribe.percentage}%`,
                background: tribe.color,
                height: '100%',
                position: 'relative',
                transition: 'width 0.3s ease',
                minWidth: tribe.percentage > 5 ? 'auto' : '2px', // Minimum visible width
              }}
              title={`${tribe.name}: ${tribe.count} (${tribe.percentage.toFixed(1)}%)`}
            >
              {tribe.percentage > 10 && ( // Only show label if enough space
                <span style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  textShadow: '0 0 4px rgba(0,0,0,0.8)',
                  whiteSpace: 'nowrap',
                }}>
                  {tribe.percentage.toFixed(0)}%
                </span>
              )}
            </div>
          )
        ))}
      </div>

      {/* Detailed breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {dominanceData.map((tribe, index) => (
          <div
            key={tribe.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px',
              background: index === 0 ? 'rgba(255,255,255,0.05)' : 'transparent',
              borderRadius: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <div style={{
                width: '12px',
                height: '12px',
                background: tribe.color,
                borderRadius: '2px',
              }} />
              <span style={{
                color: '#e0e0e0',
                fontSize: '13px',
                fontWeight: index === 0 ? 'bold' : 'normal',
              }}>
                {tribe.name}
                {/* {index === 0 && <span style={{ marginLeft: '8px', color: '#4ade80' }}>👑</span>} */}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{
                color: '#a0a0a0',
                fontSize: '12px',
                minWidth: '60px',
                textAlign: 'right',
              }}>
                {tribe.count.toLocaleString()}
              </span>

              {/* Mini bar */}
              <div style={{
                width: '60px',
                height: '16px',
                background: '#1a1a1a',
                borderRadius: '2px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${tribe.percentage}%`,
                  height: '100%',
                  background: tribe.color,
                  opacity: 0.7,
                  transition: 'width 0.3s ease',
                }} />
              </div>

              <span style={{
                color: index === 0 ? '#4ade80' : '#808080',
                fontSize: '12px',
                fontWeight: 'bold',
                minWidth: '45px',
                textAlign: 'right',
              }}>
                {tribe.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}

        {dominanceData.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: '#666',
            padding: '20px',
            fontSize: '13px',
          }}>
            No populations yet
          </div>
        )}
      </div>

      {/* Total population */}
      <div style={{
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '12px',
        color: '#808080',
      }}>
        <span>Total Population</span>
        <span style={{ fontWeight: 'bold', color: '#e0e0e0' }}>
          {totalPopulation.toLocaleString()}
        </span>
      </div>
    </div>
  );
}