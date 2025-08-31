import React from 'react';

interface CompactSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  color?: string;
  displayValue?: string | number;
  labelWidth?: number;
  valueWidth?: number;
}

export function CompactSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  color = '#3b82f6',
  displayValue,
  labelWidth = 32,
  valueWidth = 28,
}: CompactSliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  const colorWithOpacity = `${color}30`; // 30 is hex for ~19% opacity
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ 
        color: '#888', 
        fontSize: '10px',
        fontWeight: '500',
        minWidth: `${labelWidth}px`,
      }}>
        {label}
      </span>
      <div style={{
        flex: 1,
        position: 'relative',
        height: '14px',
        display: 'flex',
        alignItems: 'center',
      }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            width: '100%',
            height: '14px',
            background: `linear-gradient(to right, ${colorWithOpacity} 0%, ${colorWithOpacity} ${percentage}%, rgba(45, 55, 72, 0.2) ${percentage}%, rgba(45, 55, 72, 0.2) 100%)`,
            border: `1px solid ${color}`,
            borderRadius: '3px',
            outline: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            appearance: 'none',
            backdropFilter: 'blur(10px)',
          }}
          className="compact-slider"
        />
      </div>
      <span style={{ 
        color,
        fontSize: '11px',
        fontWeight: '600',
        minWidth: `${valueWidth}px`,
        textAlign: 'right',
      }}>
        {displayValue ?? value}
      </span>
    </div>
  );
}

// Add global styles for the slider thumb
if (typeof document !== 'undefined' && !document.getElementById('compact-slider-styles')) {
  const style = document.createElement('style');
  style.id = 'compact-slider-styles';
  style.textContent = `
    .compact-slider::-webkit-slider-thumb {
      appearance: none;
      width: 12px;
      height: 12px;
      background: rgba(255, 255, 255, 0.9);
      border: 1.5px solid currentColor;
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.15s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
    .compact-slider::-moz-range-thumb {
      width: 12px;
      height: 12px;
      background: rgba(255, 255, 255, 0.9);
      border: 1.5px solid currentColor;
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.15s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
    .compact-slider:hover::-webkit-slider-thumb {
      transform: scale(1.15);
      background: white;
    }
    .compact-slider:hover::-moz-range-thumb {
      transform: scale(1.15);
      background: white;
    }
  `;
  document.head.appendChild(style);
}