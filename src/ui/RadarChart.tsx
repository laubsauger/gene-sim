import { useMemo } from 'react';
import type { SimStats } from '../sim/types';

interface RadarChartProps {
  stats: SimStats | null;
}

export function RadarChart({ stats }: RadarChartProps) {
  if (!stats || !stats.byTribe) return null;

  const traits = ['speed', 'vision', 'metabolism', 'reproChance', 'aggression', 'cohesion', 'foodStandards', 'diet', 'viewAngle'];
  const traitLabels = ['Speed', 'Vision', 'Metabolism', 'Reproduce', 'Aggression', 'Cohesion', 'Pickiness', 'Diet', 'View'];
  
  // Calculate max values for normalization
  const maxValues = useMemo(() => {
    const maxes: Record<string, number> = {};
    traits.forEach(trait => {
      maxes[trait] = 0;
      Object.values(stats.byTribe).forEach(tribe => {
        const value = tribe.mean[trait as keyof typeof tribe.mean] || (trait === 'foodStandards' ? 0.3 : trait === 'diet' ? -0.5 : trait === 'viewAngle' ? 120 : 0);
        // For diet, use absolute value since it ranges from -1 to 1
        const normalizedValue = trait === 'diet' ? Math.abs(value) : value;
        if (normalizedValue > maxes[trait]) maxes[trait] = normalizedValue;
      });
      // Add some padding to max values, special cases for diet and viewAngle
      if (trait === 'diet') {
        maxes[trait] = 1; // Diet ranges from -1 to 1
      } else if (trait === 'viewAngle') {
        maxes[trait] = 180; // ViewAngle ranges from 30 to 180
      } else {
        maxes[trait] = maxes[trait] * 1.2 || 1;
      }
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
      const value = tribe.mean[trait as keyof typeof tribe.mean] || (trait === 'foodStandards' ? 0.3 : trait === 'diet' ? -0.5 : trait === 'viewAngle' ? 120 : 0);
      // For diet, map -1 to 1 range to 0 to 1 range for visualization
      const displayValue = trait === 'diet' ? (value + 1) / 2 : value;
      const normalized = Math.min(displayValue / maxValues[trait], 1);
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
        
      </svg>
    </div>
  );
}