import { BiomeType, BIOME_CONFIGS, BIOME_HIGHLIGHT_COLORS } from '../sim/biomes';

interface BiomeLegendProps {
  biomeMode: 'hidden' | 'natural' | 'highlight';
}

const BIOME_INFO: Record<BiomeType, { icon: string; effect: string }> = {
  [BiomeType.OCEAN]: { 
    icon: '🌊', 
    effect: 'Non-traversable • No food' 
  },
  [BiomeType.MOUNTAIN]: { 
    icon: '⛰️', 
    effect: 'Non-traversable • No food' 
  },
  [BiomeType.FOREST]: { 
    icon: '🌲', 
    effect: 'Traversable • 3× food' 
  },
  [BiomeType.GRASSLAND]: { 
    icon: '🌾', 
    effect: 'Traversable • 1.5× food' 
  },
  [BiomeType.DESERT]: { 
    icon: '🏜️', 
    effect: 'Traversable • 0.15× food' 
  },
  [BiomeType.SAVANNA]: { 
    icon: '🦒', 
    effect: 'Traversable • 0.8× food' 
  },
};

export function BiomeLegend({ biomeMode }: BiomeLegendProps) {
  if (biomeMode === 'hidden') return null;
  
  const biomeTypes = Object.values(BiomeType);
  const colors = biomeMode === 'highlight' ? BIOME_HIGHLIGHT_COLORS : BIOME_CONFIGS;
  
  return (
    <div style={{
      position: 'absolute',
      bottom: '16px',
      left: '16px',
      background: 'rgba(0, 0, 0, 0.8)',
      borderRadius: '8px',
      padding: '12px',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      maxWidth: '280px',
      zIndex: 10,
    }}>
      <div style={{
        color: 'white',
        fontSize: '13px',
        fontWeight: '600',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span>🗺️</span>
        <span>Biome Types</span>
      </div>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}>
        {biomeTypes.map(type => {
          const info = BIOME_INFO[type];
          const colorConfig = biomeMode === 'highlight' ? 
            colors[type] : 
            colors[type as keyof typeof BIOME_CONFIGS].color;
          const colorHex = `#${colorConfig.getHexString()}`;
          
          return (
            <div
              key={type}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                color: '#d1d5db',
              }}
            >
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  backgroundColor: colorHex,
                  borderRadius: '2px',
                  flexShrink: 0,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              />
              <span style={{ fontSize: '12px', flexShrink: 0 }}>
                {info.icon}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ 
                  color: 'white', 
                  fontSize: '11px',
                  fontWeight: '500',
                  textTransform: 'capitalize' 
                }}>
                  {type}
                </span>
                <span style={{ 
                  fontSize: '10px', 
                  color: '#9ca3af',
                  lineHeight: '1.2'
                }}>
                  {info.effect}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}