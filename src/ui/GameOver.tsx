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

  // Find the last surviving tribe
  const lastTribe = Object.entries(finalStats.byTribe)
    .filter(([_, stats]) => stats.count > 0)
    .sort((a, b) => b[1].count - a[1].count)[0];

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
            
            {lastTribe && (
              <>
                <div>
                  <span style={{ color: '#718096' }}>Last Survivor:</span>
                  <span style={{ float: 'right', color: '#fff' }}>{lastTribe[0]}</span>
                </div>
                
                <div>
                  <span style={{ color: '#718096' }}>Peak Population:</span>
                  <span style={{ float: 'right', color: '#fff' }}>
                    {Math.max(...Object.values(finalStats.byTribe).map(t => t.count))}
                  </span>
                </div>
              </>
            )}
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