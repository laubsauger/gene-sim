import { useEffect, useRef, useState } from 'react';
import type { SimClient } from '../client/setupSimClientHybrid';

interface PopulationGraphProps {
  client: SimClient;
  maxHistory?: number;
}

interface HistoryPoint {
  time: number;
  tribes: Record<string, { count: number; color: string }>;
  total: number;
}

export function PopulationGraph({ client, maxHistory = 100 }: PopulationGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    const unsubscribe = client.onMessage(m => {
      if (m.type === 'stats') {
        const now = Date.now();
        // Only update graph every 1 second
        if (now - lastUpdateRef.current < 1000) return;
        lastUpdateRef.current = now;
        
        setHistory(prev => {
          const point: HistoryPoint = {
            time: m.payload.t,
            tribes: Object.entries(m.payload.byTribe).reduce((acc, [name, data]) => {
              acc[name] = { count: data.count, color: data.color };
              return acc;
            }, {} as Record<string, { count: number; color: string }>),
            total: m.payload.population,
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

    // Clear canvas with darker background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Find max population for scaling
    const maxPop = Math.max(...history.map(h => h.total));
    const minTime = history[0].time;
    const maxTime = history[history.length - 1].time;
    const timeRange = maxTime - minTime || 1;

    // Draw grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 0.5;
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (i / 5) * graphHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      
      // Y-axis labels
      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      const value = Math.round(maxPop * (1 - i / 5));
      ctx.fillText(value.toString(), padding.left - 5, y + 3);
    }

    // Get all tribe names and sort for consistent stacking
    const tribeNames = Array.from(new Set(
      history.flatMap(h => Object.keys(h.tribes))
    )).sort();

    // Draw individual line charts instead of stacked areas for clarity
    tribeNames.forEach((tribeName) => {
      // Find the latest tribe data for color
      let tribeColor = '#888';
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].tribes[tribeName]) {
          tribeColor = history[i].tribes[tribeName].color;
          break;
        }
      }

      // Draw tribe line
      ctx.strokeStyle = tribeColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      
      let started = false;
      history.forEach((point) => {
        const tribeData = point.tribes[tribeName];
        if (!tribeData) return;
        
        const x = padding.left + ((point.time - minTime) / timeRange) * graphWidth;
        const y = padding.top + graphHeight - (tribeData.count / maxPop) * graphHeight;
        
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
      
      // Draw dots at data points for recent history
      const recentPoints = history.slice(-20);
      recentPoints.forEach(point => {
        const tribeData = point.tribes[tribeName];
        if (!tribeData) return;
        
        const x = padding.left + ((point.time - minTime) / timeRange) * graphWidth;
        const y = padding.top + graphHeight - (tribeData.count / maxPop) * graphHeight;
        
        ctx.fillStyle = tribeColor;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    });

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
    ctx.fillText(`Time: ${minTime.toFixed(0)}s - ${maxTime.toFixed(0)}s`, width / 2, height - 5);
    
    // Y-axis label
    // ctx.save();
    // ctx.translate(12, height / 2);
    // ctx.rotate(-Math.PI / 2);
    // ctx.fillText('Pop', 0, 0);
    // ctx.restore();
    
    // Legend
    const legendY = padding.top + 5;
    let legendX = padding.left + 5;
    tribeNames.forEach(tribeName => {
      const latestData = history[history.length - 1]?.tribes[tribeName];
      if (!latestData) return;
      
      // Draw color box
      ctx.fillStyle = latestData.color;
      ctx.fillRect(legendX, legendY, 10, 10);
      
      // Draw tribe name
      ctx.fillStyle = '#aaa';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(tribeName, legendX + 12, legendY + 8);
      
      legendX += 60;
    });

  }, [history]);

  return (
    <div style={{ marginTop: '16px' }}>
      <h4 style={{ 
        margin: '0 0 8px 0', 
        fontSize: '14px', 
        fontWeight: 'bold',
        color: '#888',
      }}>
        Population Over Time
      </h4>
      <canvas 
        ref={canvasRef}
        width={288}
        height={150}
        style={{ 
          width: '100%',
          borderRadius: '4px',
          background: '#0a0a0a',
          border: '1px solid #222',
        }}
      />
    </div>
  );
}