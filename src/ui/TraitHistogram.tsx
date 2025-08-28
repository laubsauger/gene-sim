import { useMemo, useState } from 'react';
import type { SimStats } from '../sim/types';

interface TraitHistogramProps {
  stats: SimStats | null;
}

export function TraitHistogram({ stats }: TraitHistogramProps) {
  const [selectedTrait, setSelectedTrait] = useState<string>('speed');
  const [selectedTribe, setSelectedTribe] = useState<string>('all');
  
  if (!stats || !stats.byTribe) return null;

  const traits = ['speed', 'vision', 'metabolism', 'reproChance', 'aggression', 'cohesion', 'foodStandards', 'diet'];
  const traitLabels: Record<string, string> = {
    speed: 'Speed',
    vision: 'Vision',
    metabolism: 'Metabolism',
    reproChance: 'Reproduction',
    aggression: 'Aggression',
    cohesion: 'Cohesion',
    foodStandards: 'Food Pickiness',
    diet: 'Diet (Herb←→Carn)'
  };

  // Get distribution data for selected trait and tribe
  const distributionData = useMemo(() => {
    if (selectedTribe === 'all') {
      return stats.global.distribution[selectedTrait as keyof typeof stats.global.distribution];
    } else {
      const tribe = stats.byTribe[selectedTribe];
      if (!tribe) return null;
      return tribe.distribution[selectedTrait as keyof typeof tribe.distribution];
    }
  }, [stats, selectedTrait, selectedTribe]);

  const meanValue = useMemo(() => {
    if (selectedTribe === 'all') {
      return stats.global.mean[selectedTrait as keyof typeof stats.global.mean];
    } else {
      const tribe = stats.byTribe[selectedTribe];
      if (!tribe) return 0;
      return tribe.mean[selectedTrait as keyof typeof tribe.mean];
    }
  }, [stats, selectedTrait, selectedTribe]);

  if (!distributionData) return null;

  // Create histogram bins
  const numBins = 20;
  const range = distributionData.max - distributionData.min;
  const binWidth = range / numBins || 1;
  
  // Create visual histogram using standard deviation
  const generateBins = () => {
    const bins = [];
    const mean = meanValue;
    const std = distributionData.std;
    
    // Approximate normal distribution
    for (let i = 0; i < numBins; i++) {
      const x = distributionData.min + (i + 0.5) * binWidth;
      const z = (x - mean) / (std || 1);
      // Normal distribution probability density
      const height = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
      bins.push({
        x: distributionData.min + i * binWidth,
        height: height * 100, // Scale for visualization
        value: x
      });
    }
    return bins;
  };

  const bins = generateBins();
  const maxHeight = Math.max(...bins.map(b => b.height));

  return (
    <div style={{
      padding: '10px',
      paddingTop: '0px',
      background: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '6px',
    }}>
      <h4 style={{
        margin: '0 0 10px 0',
        fontSize: '12px',
        color: '#888',
        textAlign: 'center'
      }}>
        Trait Distribution
      </h4>

      {/* Controls */}
      <div style={{ 
        display: 'flex', 
        gap: '6px', 
        marginBottom: '10px',
        fontSize: '10px'
      }}>
        <select
          value={selectedTrait}
          onChange={(e) => setSelectedTrait(e.target.value)}
          style={{
            flex: 1,
            padding: '4px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '3px',
            color: '#fff',
            fontSize: '10px',
          }}
        >
          {traits.map(trait => (
            <option key={trait} value={trait}>
              {traitLabels[trait]}
            </option>
          ))}
        </select>
        
        <select
          value={selectedTribe}
          onChange={(e) => setSelectedTribe(e.target.value)}
          style={{
            flex: 1,
            padding: '4px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '3px',
            color: '#fff',
            fontSize: '10px',
          }}
        >
          <option value="all">All Tribes</option>
          {Object.entries(stats.byTribe).map(([name, tribe]) => (
            <option key={name} value={name} style={{ color: tribe.color }}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Histogram */}
      <div style={{ position: 'relative', height: '100px', marginBottom: '10px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'flex-end', 
          height: '100%',
          borderBottom: '1px solid #444',
          borderLeft: '1px solid #444',
        }}>
          {bins.map((bin, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: selectedTribe === 'all' ? '#3b82f6' : 
                  stats.byTribe[selectedTribe]?.color || '#3b82f6',
                opacity: 0.7,
                height: `${(bin.height / maxHeight) * 100}%`,
                marginRight: '1px',
                transition: 'height 0.3s',
              }}
              title={`Value: ${bin.value.toFixed(2)}`}
            />
          ))}
        </div>
        
        {/* Mean line */}
        <div
          style={{
            position: 'absolute',
            left: `${((meanValue - distributionData.min) / range) * 100}%`,
            top: 0,
            bottom: 0,
            width: '2px',
            background: '#fbbf24',
            opacity: 0.8,
            pointerEvents: 'none',
          }}
        />
        
        {/* Std deviation range */}
        <div
          style={{
            position: 'absolute',
            left: `${((meanValue - distributionData.std - distributionData.min) / range) * 100}%`,
            width: `${(distributionData.std * 2 / range) * 100}%`,
            top: 0,
            bottom: 0,
            background: 'rgba(251, 191, 36, 0.1)',
            borderLeft: '1px dashed rgba(251, 191, 36, 0.5)',
            borderRight: '1px dashed rgba(251, 191, 36, 0.5)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Statistics */}
      <div style={{ 
        fontSize: '10px', 
        color: '#888',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px',
        textAlign: 'center',
      }}>
        <div>
          <div style={{ color: '#666' }}>Min</div>
          <div style={{ color: '#fff' }}>{distributionData.min.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ color: '#666' }}>Mean</div>
          <div style={{ color: '#fbbf24' }}>{meanValue.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ color: '#666' }}>Max</div>
          <div style={{ color: '#fff' }}>{distributionData.max.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ color: '#666' }}>σ</div>
          <div style={{ color: '#fff' }}>{distributionData.std.toFixed(3)}</div>
        </div>
      </div>
    </div>
  );
}