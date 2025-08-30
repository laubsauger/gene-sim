import { useState, useEffect } from 'react';
import type { SimMode } from '../client/setupSimClientHybrid';
import { isWasmAvailable } from '../sim/wasmLoader';

interface ModeSelectorProps {
  currentMode: SimMode;
  onModeChange: (mode: SimMode) => void;
  disabled?: boolean;
}

export function ModeSelector({ currentMode, onModeChange, disabled }: ModeSelectorProps) {
  const [loading, setLoading] = useState(true);
  const [capabilities, setCapabilities] = useState({
    hasWasm: false,
    wasmBuilt: false,
    hasSAB: false,
    cores: 1,
  });
  
  useEffect(() => {
    // Check browser capabilities
    const checkCapabilities = async () => {
      const hasWasm = typeof WebAssembly !== 'undefined';
      const hasSAB = typeof SharedArrayBuffer !== 'undefined';
      const cores = navigator.hardwareConcurrency || 1;
      const wasmBuilt = await isWasmAvailable();
      
      setCapabilities({ hasWasm, wasmBuilt, hasSAB, cores });
      setLoading(false);
    };
    
    checkCapabilities();
  }, []);
  
  const modes: { value: SimMode; label: string; description: string; available: boolean }[] = [
    {
      value: 'js',
      label: 'Single Threaded',
      description: 'Standard JS implementation (baseline)',
      available: true,
    },
    {
      value: 'multi-worker',
      label: 'Multi Threaded',
      description: `${capabilities.cores} cores (4-8x faster)`,
      available: capabilities.hasSAB && capabilities.cores >= 4,
    },
  ];
  
  // Show loading state with same dimensions to prevent layout shift
  if (loading) {
    return (
      <div style={{
        marginBottom: '16px',
        padding: '12px',
        background: 'rgba(0, 0, 0, 0.6)',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        minHeight: '120px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ color: '#666', fontSize: '12px' }}>Checking capabilities...</div>
      </div>
    );
  }
  
  return (
    <div style={{
      marginBottom: '16px',
    }}>
      <div style={{
        fontSize: '12px',
        fontWeight: 'bold',
        marginBottom: '8px',
        color: '#a0aec0',
      }}>
        Simulation Mode
      </div>
      
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {modes.map(mode => (
          <button
            key={mode.value}
            onClick={() => onModeChange(mode.value)}
            disabled={disabled || !mode.available}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: '2px solid transparent',
              borderColor: currentMode === mode.value ? '#4CAF50' : 'rgba(255, 255, 255, 0.1)',
              background: currentMode === mode.value ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              color: mode.available ? '#fff' : '#666',
              cursor: mode.available && !disabled ? 'pointer' : 'not-allowed',
              fontSize: '12px',
              transition: 'all 0.2s',
              flex: '1 1 auto',
              minWidth: '100px',
            }}
            title={mode.description}
          >
            <div style={{ fontWeight: 'bold' }}>{mode.label}</div>
            {currentMode === mode.value && (
              <div style={{ fontSize: '10px', marginTop: '2px', color: '#4CAF50' }}>
                Active
              </div>
            )}
            {!mode.available && (
              <div style={{ fontSize: '10px', marginTop: '2px', color: '#f44336' }}>
                Not Available
              </div>
            )}
          </button>
        ))}
      </div>
      
      <div style={{
        marginTop: '8px',
        fontSize: '11px',
        color: '#666',
      }}>
        {currentMode === 'js' && 'Using standard JavaScript implementation'}
        {currentMode === 'multi-worker' && `Using ${capabilities.cores} worker threads`}
      </div>
      
      {!capabilities.hasSAB && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: 'rgba(255, 152, 0, 0.1)',
          border: '1px solid rgba(255, 152, 0, 0.3)',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#ff9800',
        }}>
          ⚠️ SharedArrayBuffer not available. WASM and multi-worker modes disabled.
          <br />
          Ensure HTTPS and COOP/COEP headers are set.
        </div>
      )}
      
      {capabilities.hasSAB && !capabilities.wasmBuilt && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: 'rgba(33, 150, 243, 0.1)',
          border: '1px solid rgba(33, 150, 243, 0.3)',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#2196F3',
        }}>
          ℹ️ WASM module not built. Run <code>yarn build:wasm</code> to enable acceleration.
        </div>
      )}
      
      {capabilities.cores < 4 && capabilities.hasSAB && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: 'rgba(33, 150, 243, 0.1)',
          border: '1px solid rgba(33, 150, 243, 0.3)',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#2196F3',
        }}>
          ℹ️ Only {capabilities.cores} CPU cores detected. Multi-worker mode requires 4+ cores.
        </div>
      )}
    </div>
  );
}