import React, { useState, useEffect } from 'react';
import { CollapsibleSection } from './CollapsibleSection';
import type { SimClient } from '../client/setupSimClientHybrid';

interface PerfBreakdown {
  spatialHash: string;
  foodRegrow: string;
  entityUpdate: string;
  foodConsume: string;
  movement: string;
  physics: string;
  total: string;
  entities: number;
}

export function PerformancePanel({ client }: { client: SimClient }) {
  const [perfData] = useState<PerfBreakdown | null>(null);

  useEffect(() => {
    const unsubscribe = client.onMessage(() => {
      // Performance breakdown messages are not currently implemented
      // This is placeholder code for future performance monitoring
    });

    return unsubscribe;
  }, [client]);

  if (!perfData) return null;

  const items = [
    { label: 'Spatial Hash', value: `${perfData.spatialHash}ms` },
    { label: 'Food Regrow', value: `${perfData.foodRegrow}ms` },
    { label: 'Food Consume', value: `${perfData.foodConsume}ms` },
    { label: 'Movement', value: `${perfData.movement}ms` },
    { label: 'Physics', value: `${perfData.physics}ms` },
    { label: 'Entity Update', value: `${perfData.entityUpdate}ms` },
    { label: 'Total', value: `${perfData.total}ms`, highlight: true },
    { label: 'Entities', value: perfData.entities.toLocaleString() },
  ];

  return (
    <CollapsibleSection title="Performance Breakdown" defaultOpen={false}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '8px',
        fontSize: '12px',
        padding: '8px',
      }}>
        {items.map((item) => (
          <React.Fragment key={item.label}>
            <div style={{ color: '#999' }}>{item.label}:</div>
            <div style={{ 
              color: item.highlight ? '#ff9800' : '#fff',
              fontWeight: item.highlight ? 'bold' : 'normal',
              fontFamily: 'monospace' 
            }}>
              {item.value}
            </div>
          </React.Fragment>
        ))}
      </div>
    </CollapsibleSection>
  );
}