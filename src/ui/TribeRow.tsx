import { memo } from 'react';
import type { TribeStats } from '../sim/types';

interface TribeRowProps {
  name: string;
  tribe: TribeStats;
  isExtinct: boolean;
}

// Memoized tribe row component to prevent unnecessary re-renders
export const TribeRow = memo(function TribeRow({ name, tribe, isExtinct }: TribeRowProps) {
  return (
    <tr style={{ opacity: isExtinct ? 0.4 : 1 }}>
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
      <td style={{ textAlign: 'center', color: isExtinct ? '#666' : '#bbb', padding: '2px' }}>
        {tribe.mean.viewAngle?.toFixed(0) || '120'}
      </td>
      <td style={{ textAlign: 'center', color: '#999', padding: '2px', fontSize: '10px' }}>
        {tribe.kills || 0}/{tribe.starved || 0}
      </td>
    </tr>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function - only re-render if actual data changed
  return prevProps.name === nextProps.name &&
    prevProps.isExtinct === nextProps.isExtinct &&
    prevProps.tribe.count === nextProps.tribe.count &&
    prevProps.tribe.mean.speed === nextProps.tribe.mean.speed &&
    prevProps.tribe.mean.vision === nextProps.tribe.mean.vision &&
    prevProps.tribe.mean.metabolism === nextProps.tribe.mean.metabolism &&
    prevProps.tribe.mean.reproChance === nextProps.tribe.mean.reproChance &&
    prevProps.tribe.mean.aggression === nextProps.tribe.mean.aggression &&
    prevProps.tribe.mean.foodStandards === nextProps.tribe.mean.foodStandards &&
    prevProps.tribe.mean.diet === nextProps.tribe.mean.diet &&
    prevProps.tribe.mean.viewAngle === nextProps.tribe.mean.viewAngle &&
    prevProps.tribe.kills === nextProps.tribe.kills &&
    prevProps.tribe.starved === nextProps.tribe.starved;
});