import { useEffect, useRef, useState } from 'react';
import type { SimClient } from '../client/setupSimClient';

interface PerformanceGraphProps {
  client: SimClient;
  maxHistory?: number;
}

interface PerfPoint {
  time: number;
  total: number;
  movement: number;
  entityUpdate: number;
  spatialHash: number;
  foodRegrow: number;
  foodConsume: number;
  physics: number;
  entities: number;
}

export function PerformanceGraph({ client, maxHistory = 100 }: PerformanceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [history, setHistory] = useState<PerfPoint[]>([]);
  const lastUpdateRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const unsubscribe = client.onMessage(m => {
      if (m.type === 'perfBreakdown') {
        const now = Date.now();
        // Update when we get performance data (every 2 seconds from worker)
        if (now - lastUpdateRef.current < 100) return; // Debounce
        lastUpdateRef.current = now;
        timeRef.current += 2; // Increment by 2 seconds per update
        
        setHistory(prev => {
          const point: PerfPoint = {
            time: timeRef.current,
            total: parseFloat(m.payload.total),
            movement: parseFloat(m.payload.movement),
            entityUpdate: parseFloat(m.payload.entityUpdate),
            spatialHash: parseFloat(m.payload.spatialHash),
            foodRegrow: parseFloat(m.payload.foodRegrow),
            foodConsume: parseFloat(m.payload.foodConsume),
            physics: parseFloat(m.payload.physics),
            entities: m.payload.entities
          };
          
          const newHistory = [...prev, point];
          if (newHistory.length > maxHistory) {
            newHistory.shift();
          }
          return newHistory;
        });
      }
    });
    return unsubscribe;
  }, [client, maxHistory]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const padding = { top: 10, right: 10, bottom: 30, left: 40 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Find max values for scaling
    const maxTime = Math.max(...history.map(h => h.total));
    const maxValue = Math.max(maxTime, 100); // At least 100ms scale
    const minTime = history[0].time;
    const maxTimeX = history[history.length - 1].time;
    const timeRange = maxTimeX - minTime || 1;

    // Draw grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 0.5;
    
    // Horizontal grid lines with ms labels
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (i / 5) * graphHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      
      // Y-axis labels (milliseconds)
      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      const value = Math.round(maxValue * (1 - i / 5));
      ctx.fillText(`${value}ms`, padding.left - 5, y + 3);
    }

    // Performance metrics to plot - ordered for stacking (bottom to top)
    const metrics = [
      { key: 'spatialHash', color: '#ffe66d', label: 'Spatial Hash' },
      { key: 'foodRegrow', color: '#c4c4c4', label: 'Food Regrow' },
      { key: 'foodConsume', color: '#ff8b94', label: 'Food Consume' },
      { key: 'physics', color: '#a8e6cf', label: 'Physics' },
      { key: 'movement', color: '#4ecdc4', label: 'Movement' },
    ];

    // Draw stacked area chart
    metrics.forEach((metric, metricIndex) => {
      ctx.fillStyle = metric.color;
      ctx.strokeStyle = metric.color;
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.8;
      
      ctx.beginPath();
      
      // Start from bottom left
      ctx.moveTo(padding.left, padding.top + graphHeight);
      
      history.forEach((point, i) => {
        // Calculate cumulative value up to this metric
        let cumulativeValue = 0;
        for (let j = 0; j <= metricIndex; j++) {
          cumulativeValue += point[metrics[j].key as keyof PerfPoint] as number;
        }
        
        const x = padding.left + ((point.time - minTime) / timeRange) * graphWidth;
        const y = padding.top + graphHeight - (cumulativeValue / maxValue) * graphHeight;
        
        if (i === 0) {
          ctx.lineTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      // Draw back down along the previous metric's line (or bottom if first)
      if (metricIndex > 0) {
        for (let i = history.length - 1; i >= 0; i--) {
          const point = history[i];
          let prevCumulative = 0;
          for (let j = 0; j < metricIndex; j++) {
            prevCumulative += point[metrics[j].key as keyof PerfPoint] as number;
          }
          const x = padding.left + ((point.time - minTime) / timeRange) * graphWidth;
          const y = padding.top + graphHeight - (prevCumulative / maxValue) * graphHeight;
          ctx.lineTo(x, y);
        }
      } else {
        // First metric - draw along bottom
        ctx.lineTo(padding.left + graphWidth, padding.top + graphHeight);
        ctx.lineTo(padding.left, padding.top + graphHeight);
      }
      
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    
    // Draw total line on top
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    history.forEach((point, i) => {
      const x = padding.left + ((point.time - minTime) / timeRange) * graphWidth;
      const y = padding.top + graphHeight - (point.total / maxValue) * graphHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();

    // Draw axes
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Time label
    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Time: ${minTime}s - ${maxTimeX}s`, width / 2, height - 5);
    
    // Legend
    const legendY = padding.top + 5;
    let legendX = padding.left + 5;
    
    // Draw entity count in top right
    const lastPoint = history[history.length - 1];
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Entities: ${lastPoint.entities.toLocaleString()}`, width - padding.right - 5, legendY + 10);
    
    // Draw metric legend for stacked chart
    ctx.textAlign = 'left';
    ctx.font = '9px monospace';
    
    // Draw total first (most important)
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(legendX, legendY, 8, 8);
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`Total: ${lastPoint.total.toFixed(1)}ms`, legendX + 10, legendY + 7);
    
    // Draw stacked metrics below
    ctx.font = '9px monospace';
    metrics.forEach((metric, i) => {
      const x = legendX + Math.floor((i + 1) / 3) * 95;
      const y = legendY + ((i + 1) % 3) * 12 + 12;
      
      // Draw color box
      ctx.fillStyle = metric.color;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(x, y, 8, 8);
      ctx.globalAlpha = 1;
      
      // Draw label with current value
      const currentValue = lastPoint[metric.key as keyof PerfPoint] as number;
      ctx.fillStyle = '#999';
      ctx.fillText(`${metric.label}: ${currentValue.toFixed(1)}`, x + 10, y + 7);
    });

    // Draw target line at 16.67ms (60 FPS) - more prominent
    const targetY = padding.top + graphHeight - (16.67 / maxValue) * graphHeight;
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, targetY);
    ctx.lineTo(width - padding.right, targetY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw background for text
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(width - padding.right - 45, targetY - 10, 40, 12);
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('60 FPS', width - padding.right - 40, targetY + 1);

  }, [history]);

  return (
    <div style={{ marginTop: '16px' }}>
      <h4 style={{ 
        margin: '0 0 8px 0', 
        fontSize: '14px', 
        fontWeight: 'bold',
        color: '#888',
      }}>
        Performance Metrics
      </h4>
      <canvas 
        ref={canvasRef}
        width={380}
        height={200}
        style={{ 
          width: '100%',
          borderRadius: '4px',
          background: '#0a0a0a',
          border: '1px solid #222',
        }}
      />
      {history.length === 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#666',
          fontSize: '12px',
        }}>
          Waiting for performance data...
        </div>
      )}
    </div>
  );
}