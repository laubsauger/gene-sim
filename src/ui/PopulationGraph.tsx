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

// Helper function to aggregate history points when we have too many
function aggregateHistory(history: HistoryPoint[], targetSize: number): HistoryPoint[] {
  if (history.length <= targetSize) return history;
  
  const aggregated: HistoryPoint[] = [];
  const bucketSize = Math.ceil(history.length / targetSize);
  
  for (let i = 0; i < history.length; i += bucketSize) {
    const bucket = history.slice(i, Math.min(i + bucketSize, history.length));
    if (bucket.length === 0) continue;
    
    // Average the values in this bucket
    const avgTime = bucket.reduce((sum, p) => sum + p.time, 0) / bucket.length;
    const avgTotal = bucket.reduce((sum, p) => sum + p.total, 0) / bucket.length;
    
    // Average tribes data
    const tribesData: Record<string, { count: number; color: string }> = {};
    const tribeNames = new Set<string>();
    bucket.forEach(p => Object.keys(p.tribes).forEach(name => tribeNames.add(name)));
    
    tribeNames.forEach(name => {
      const counts = bucket.map(p => p.tribes[name]?.count || 0);
      const avgCount = counts.reduce((sum, c) => sum + c, 0) / counts.length;
      const color = bucket.find(p => p.tribes[name])?.tribes[name]?.color || '#888';
      tribesData[name] = { count: avgCount, color };
    });
    
    aggregated.push({
      time: avgTime,
      tribes: tribesData,
      total: avgTotal
    });
  }
  
  return aggregated;
}

export function PopulationGraph({ client, maxHistory = 100 }: PopulationGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [rawHistory, setRawHistory] = useState<HistoryPoint[]>([]);
  const [showCumulative, setShowCumulative] = useState<boolean>(true);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    const unsubscribe = client.onMessage(m => {
      if (m.type === 'stats') {
        const now = Date.now();
        // Only update graph every 1 second
        if (now - lastUpdateRef.current < 1000) return;
        lastUpdateRef.current = now;
        
        // Defensive checks to prevent crashes
        if (!m.payload || typeof m.payload.time !== 'number' || !m.payload.byTribe || typeof m.payload.population !== 'number') {
          console.warn('[PopulationGraph] Invalid stats payload:', m.payload);
          return;
        }
        
        // Only update raw history, aggregated history will be updated via effect
        setRawHistory(prev => {
          try {
            const tribes: Record<string, { count: number; color: string }> = {};
            
            // Safely process tribes data
            Object.entries(m.payload.byTribe).forEach(([name, data]) => {
              // data has the structure like {population, avgEnergy, births, deaths, avgSpeed, avgVision, colorHue, color}
              if (name && data && typeof data.population === 'number') {
                // Use the color directly from stats if available, otherwise calculate from colorHue
                let color = data.color;
                if (!color) {
                  const hue = data.colorHue || 0;
                  color = `hsl(${Math.round(hue)}, 70%, 50%)`;
                }
                tribes[name] = { 
                  count: Math.max(0, data.population || 0), 
                  color: color 
                };
              }
            });
            
            const point: HistoryPoint = {
              time: m.payload.time,
              tribes,
              total: Math.max(0, m.payload.population || 0),
            };
            
            
            const newRawHistory = [...prev, point];
            
            // Keep raw history up to 5x the display size for smooth aggregation
            if (newRawHistory.length > maxHistory * 5) {
              // Remove oldest 20% when we hit the limit
              const toRemove = Math.floor(maxHistory);
              newRawHistory.splice(0, toRemove);
            }
            
            return newRawHistory;
          } catch (error) {
            console.error('[PopulationGraph] Error processing stats:', error, m.payload);
            return prev; // Keep previous history on error
          }
        });
      }
    });
    return unsubscribe;
  }, [client, maxHistory]);
  
  // Update aggregated history when raw history changes
  useEffect(() => {
    setHistory(aggregateHistory(rawHistory, maxHistory));
  }, [rawHistory, maxHistory]);

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

    // Find max population for scaling - with defensive checks
    const validTotals = history.map(h => h.total || 0).filter(t => typeof t === 'number' && !isNaN(t));
    const maxPop = Math.max(1, ...validTotals); // Ensure minimum of 1 to avoid division by 0
    const minTime = history[0]?.time || 0;
    const maxTime = history[history.length - 1]?.time || 0;
    const timeRange = Math.max(1, maxTime - minTime); // Ensure minimum range of 1

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

    // Get all tribe names and sort for consistent stacking - with defensive checks
    const tribeNames = Array.from(new Set(
      history.filter(h => h && h.tribes).flatMap(h => Object.keys(h.tribes || {}))
    )).filter(name => typeof name === 'string' && name.length > 0).sort();
    

    // Draw either cumulative (stacked area) or individual line charts
    if (showCumulative) {
      // Stacked area chart
      const stackedData: number[][] = [];
      
      // Build stacked data for each point
      history.forEach((point) => {
        let cumulative = 0;
        const stack: number[] = [];
        tribeNames.forEach(tribeName => {
          const count = point.tribes[tribeName]?.count || 0;
          cumulative += count;
          stack.push(cumulative);
        });
        stackedData.push(stack);
      });
      
      // Draw areas from top to bottom (reverse order)
      for (let tribeIdx = tribeNames.length - 1; tribeIdx >= 0; tribeIdx--) {
        const tribeName = tribeNames[tribeIdx];
        
        // Get tribe color
        let tribeColor = '#888';
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].tribes[tribeName]) {
            tribeColor = history[i].tribes[tribeName].color;
            break;
          }
        }
        
        ctx.fillStyle = tribeColor;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        
        // Draw the area
        history.forEach((point, pointIdx) => {
          const x = padding.left + ((point.time - minTime) / timeRange) * graphWidth;
          const yBottom = padding.top + graphHeight - (stackedData[pointIdx][tribeIdx] / maxPop) * graphHeight;
          
          if (pointIdx === 0) {
            ctx.moveTo(x, yBottom);
          } else {
            ctx.lineTo(x, yBottom);
          }
        });
        
        // Draw back along the bottom of this area
        for (let i = history.length - 1; i >= 0; i--) {
          const x = padding.left + ((history[i].time - minTime) / timeRange) * graphWidth;
          const yTop = tribeIdx > 0 ? 
            padding.top + graphHeight - (stackedData[i][tribeIdx - 1] / maxPop) * graphHeight :
            padding.top + graphHeight;
          ctx.lineTo(x, yTop);
        }
        
        ctx.closePath();
        ctx.fill();
        
        // Draw border line
        ctx.strokeStyle = tribeColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        history.forEach((point, i) => {
          const x = padding.left + ((point.time - minTime) / timeRange) * graphWidth;
          const y = padding.top + graphHeight - (stackedData[i][tribeIdx] / maxPop) * graphHeight;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
      }
      
      ctx.globalAlpha = 1;
    } else {
      // Individual line charts
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
      });
    }
    
    // Draw dots at data points for recent history (only for line chart)
    if (!showCumulative) {
      tribeNames.forEach((tribeName) => {
        // Find the latest tribe data for color
        let tribeColor = '#888';
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].tribes[tribeName]) {
            tribeColor = history[i].tribes[tribeName].color;
            break;
          }
        }
      
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
    }

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
    

  }, [history, showCumulative]);

  return (
    <div style={{ marginTop: '16px', position: 'relative' }}>
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
      <button
        onClick={() => setShowCumulative(!showCumulative)}
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          padding: '2px 6px',
          fontSize: '10px',
          background: 'rgba(0, 0, 0, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '3px',
          color: '#aaa',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          zIndex: 10,
        }}
        title={showCumulative ? 'Switch to line chart' : 'Switch to stacked area chart'}
      >
        {showCumulative ? '📈' : '📊'}
      </button>
    </div>
  );
}