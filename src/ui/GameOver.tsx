import type { SimStats } from '../sim/types';

interface GameOverProps {
  finalTime: number;
  finalStats: SimStats;
  onRestart: () => void;
  onNewSimulation: () => void;
  seed: number;
}

export function GameOver({ finalTime, finalStats, onRestart, onNewSimulation, seed }: GameOverProps) {
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Calculate comprehensive statistics
  const tribes = Object.entries(finalStats.byTribe);
  const totalKills = tribes.reduce((sum, [_, stats]) => sum + (stats.kills || 0), 0);
  const totalBirths = tribes.reduce((sum, [_, stats]) => sum + (stats.births || 0), 0);
  const totalDeaths = tribes.reduce((sum, [_, stats]) => sum + (stats.deaths || 0), 0);
  const totalStarved = tribes.reduce((sum, [_, stats]) => sum + (stats.starved || 0), 0);
  
  // Find the tribe with most kills
  const mostAggressive = tribes.sort((a, b) => (b[1].kills || 0) - (a[1].kills || 0))[0];
  
  // Find the tribe that survived longest (last to have population > 0)
  const survivorsByTime = tribes
    .filter(([_, stats]) => (stats.deaths || 0) > 0 || (stats.births || 0) > 0)
    .sort((a, b) => (b[1].births || 0) + (b[1].deaths || 0) - (a[1].births || 0) - (a[1].deaths || 0));

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.9)',
      backdropFilter: 'blur(10px)',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.95), rgba(40, 40, 40, 0.95))',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: '40px',
        maxWidth: '600px',
        width: '90%',
        color: '#fff',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
      }}>
        <h1 style={{
          fontSize: '36px',
          fontWeight: 'bold',
          marginBottom: '10px',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #ff4444, #ff8888)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Extinction
        </h1>
        
        <p style={{
          fontSize: '18px',
          color: '#a0aec0',
          textAlign: 'center',
          marginBottom: '30px',
        }}>
          All life has ended after {formatTime(finalTime)}
        </p>

        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '30px',
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '15px',
            color: '#cbd5e0',
          }}>
            Final Statistics
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '15px',
            fontSize: '14px',
          }}>
            <div>
              <span style={{ color: '#718096' }}>Simulation Time:</span>
              <span style={{ float: 'right', color: '#fff' }}>{formatTime(finalTime)}</span>
            </div>
            
            <div>
              <span style={{ color: '#718096' }}>Seed:</span>
              <span style={{ float: 'right', color: '#fff', fontFamily: 'monospace' }}>{seed}</span>
            </div>
            
            <div>
              <span style={{ color: '#718096' }}>Total Births:</span>
              <span style={{ float: 'right', color: '#4ade80' }}>{totalBirths}</span>
            </div>
            
            <div>
              <span style={{ color: '#718096' }}>Total Deaths:</span>
              <span style={{ float: 'right', color: '#ef4444' }}>{totalDeaths}</span>
            </div>
            
            <div>
              <span style={{ color: '#718096' }}>Combat Deaths:</span>
              <span style={{ float: 'right', color: '#f97316' }}>{totalKills}</span>
            </div>
            
            <div>
              <span style={{ color: '#718096' }}>Starvation Deaths:</span>
              <span style={{ float: 'right', color: '#a78bfa' }}>{totalStarved}</span>
            </div>
            
            {mostAggressive && (
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#718096' }}>Most Aggressive:</span>
                <span style={{ float: 'right', color: '#ef4444' }}>
                  {mostAggressive[0]} ({mostAggressive[1].kills} kills)
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Tribe breakdown */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '30px',
          maxHeight: '200px',
          overflowY: 'auto',
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '15px',
            color: '#cbd5e0',
          }}>
            Tribe Performance
          </h3>
          
          <div style={{ fontSize: '13px' }}>
            {tribes.map(([name, stats]) => (
              <div key={name} style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                gap: '10px',
                padding: '8px 0',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              }}>
                <span style={{ color: stats.color || '#fff' }}>{name}</span>
                <span style={{ color: '#718096', textAlign: 'right' }}>B: {stats.births || 0}</span>
                <span style={{ color: '#718096', textAlign: 'right' }}>D: {stats.deaths || 0}</span>
                <span style={{ color: '#718096', textAlign: 'right' }}>K: {stats.kills || 0}</span>
                <span style={{ color: '#718096', textAlign: 'right' }}>S: {stats.starved || 0}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '15px',
          justifyContent: 'center',
        }}>
          <button
            onClick={onRestart}
            style={{
              padding: '12px 24px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#2563eb';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#3b82f6';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Restart (Same Seed)
          </button>
          
          <button
            onClick={onNewSimulation}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            New Simulation
          </button>
        </div>
      </div>
    </div>
  );
}