import { useEffect, useState } from 'react';

export function COIStatus() {
  const [status, setStatus] = useState<'checking' | 'enabled' | 'disabled' | 'enabling'>('checking');
  
  useEffect(() => {
    const checkStatus = () => {
      if (window.crossOriginIsolated) {
        setStatus('enabled');
      } else if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        setStatus('enabling');
        // Check again in a moment
        setTimeout(checkStatus, 1000);
      } else {
        setStatus('disabled');
      }
    };
    
    checkStatus();
    
    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', checkStatus);
      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', checkStatus);
      };
    }
  }, []);
  
  // Only show on production (GitHub Pages)
  const hostname = window.location.hostname;
  const isProduction = hostname !== 'localhost' && hostname !== '127.0.0.1';
  
  if (!isProduction) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      padding: '6px 10px',
      borderRadius: '4px',
      fontSize: '11px',
      fontFamily: 'monospace',
      background: status === 'enabled' ? 'rgba(76, 175, 80, 0.1)' : 
                 status === 'enabling' ? 'rgba(255, 152, 0, 0.1)' :
                 'rgba(244, 67, 54, 0.1)',
      border: `1px solid ${
        status === 'enabled' ? 'rgba(76, 175, 80, 0.3)' : 
        status === 'enabling' ? 'rgba(255, 152, 0, 0.3)' :
        'rgba(244, 67, 54, 0.3)'
      }`,
      color: status === 'enabled' ? '#4CAF50' : 
             status === 'enabling' ? '#FF9800' :
             '#F44336',
      zIndex: 1000,
      transition: 'all 0.3s ease',
    }}>
      {status === 'enabled' && '🟢 COI Enabled'}
      {status === 'enabling' && '🟡 Enabling COI...'}
      {status === 'disabled' && '🔴 COI Disabled'}
      {status === 'checking' && '⏳ Checking...'}
    </div>
  );
}