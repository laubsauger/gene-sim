import { useState, type ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleSection({ title, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div style={{
      marginBottom: '8px',
      background: 'rgba(0, 0, 0, 0.5)',
      borderRadius: '6px',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: 'none',
          color: '#e0e0e0',
          fontSize: '13px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }}
      >
        <span>{title}</span>
        <span style={{
          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          fontSize: '10px',
        }}>
          ▶
        </span>
      </button>
      
      {isOpen && (
        <div style={{
          padding: '8px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}