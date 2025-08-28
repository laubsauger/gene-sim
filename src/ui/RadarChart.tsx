import React, { useMemo } from 'react';
import type { SimStats } from '../sim/types';

interface RadarChartProps {
  stats: SimStats | null;
}

export function RadarChart({ stats }: RadarChartProps) {
  if (!stats || !stats.byTribe) return null;

  const traits = ['speed', 'vision', 'metabolism', 'reproChance', 'aggression', 'cohesion'];
  const traitLabels = ['Speed', 'Vision', 'Metab', 'Repro', 'Aggro', 'Cohesion'];
  
  // Calculate max values for normalization
  const maxValues = useMemo(() => {
    const maxes: Record<string, number> = {};
    traits.forEach(trait => {
      maxes[trait] = 0;
      Object.values(stats.byTribe).forEach(tribe => {
        const value = tribe.mean[trait as keyof typeof tribe.mean];
        if (value > maxes[trait]) maxes[trait] = value;
      });
      // Add some padding to max values
      maxes[trait] = maxes[trait] * 1.2 || 1;
    });
    return maxes;
  }, [stats.byTribe]);

  const centerX = 120;
  const centerY = 120;
  const radius = 80;
  const angleStep = (Math.PI * 2) / traits.length;

  // Calculate polygon points for each tribe
  const getPolygonPoints = (tribe: typeof stats.byTribe[string]) => {
    return traits.map((trait, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const value = tribe.mean[trait as keyof typeof tribe.mean];
      const normalized = Math.min(value / maxValues[trait], 1);
      const r = radius * normalized;
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;
      return `${x},${y}`;
    }).join(' ');
  };

  // Draw grid lines
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1];
  
  return (
    <div style={{ 
      padding: '10px',
      background: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '6px',
      marginTop: '10px',
    }}>
      <h4 style={{ 
        margin: '0 0 10px 0', 
        fontSize: '12px', 
        color: '#888',
        textAlign: 'center' 
      }}>
        Trait Comparison
      </h4>
      
      <svg width="240" height="240" style={{ display: 'block', margin: '0 auto' }}>
        {/* Background grid */}
        <g opacity={0.2}>
          {gridLevels.map(level => (
            <polygon
              key={level}
              points={traits.map((_, i) => {
                const angle = i * angleStep - Math.PI / 2;
                const r = radius * level;
                const x = centerX + Math.cos(angle) * r;
                const y = centerY + Math.sin(angle) * r;
                return `${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="#444"
              strokeWidth="1"
            />
          ))}
        </g>
        
        {/* Axis lines */}
        <g opacity={0.3}>
          {traits.map((_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const x2 = centerX + Math.cos(angle) * radius;
            const y2 = centerY + Math.sin(angle) * radius;
            return (
              <line
                key={i}
                x1={centerX}
                y1={centerY}
                x2={x2}
                y2={y2}
                stroke="#666"
                strokeWidth="1"
              />
            );
          })}
        </g>
        
        {/* Tribe polygons */}
        {Object.entries(stats.byTribe).map(([name, tribe]) => (
          <polygon
            key={name}
            points={getPolygonPoints(tribe)}
            fill={tribe.color}
            fillOpacity={0.2}
            stroke={tribe.color}
            strokeWidth="2"
            strokeOpacity={0.8}
          />
        ))}
        
        {/* Labels */}
        {traitLabels.map((label, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const labelRadius = radius + 20;
          const x = centerX + Math.cos(angle) * labelRadius;
          const y = centerY + Math.sin(angle) * labelRadius;
          return (
            <text
              key={label}
              x={x}
              y={y}
              fill="#888"
              fontSize="10"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {label}
            </text>
          );
        })}
        
        {/* Legend */}
        {Object.entries(stats.byTribe).map(([name, tribe], i) => (
          <g key={name}>
            <rect
              x={10}
              y={10 + i * 15}
              width={10}
              height={10}
              fill={tribe.color}
              opacity={0.8}
            />
            <text
              x={25}
              y={19 + i * 15}
              fill="#ccc"
              fontSize="11"
            >
              {name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}