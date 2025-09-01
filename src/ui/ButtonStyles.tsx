import React from 'react';

export interface StyledButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  color?: string;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'toggle';
  style?: React.CSSProperties;
  title?: string;
}

const colorMap = {
  blue: '#3b82f6',
  green: '#10b981',
  purple: '#9333ea',
  violet: '#8b5cf6',
  gray: '#6b7280',
  red: '#ef4444',
  emerald: '#059669',
  amber: '#f59e0b',
};

export function StyledButton({
  onClick,
  disabled = false,
  active = false,
  color = 'blue',
  children,
  size = 'small',
  variant = 'primary',
  style = {},
  title,
}: StyledButtonProps) {
  const baseColor = colorMap[color as keyof typeof colorMap] || color;
  const isActive = variant === 'toggle' ? active : true;

  const sizeStyles = {
    small: { padding: '6px 10px', fontSize: '12px', height: '32px' },
    medium: { padding: '8px 14px', fontSize: '13px', height: '36px' },
    large: { padding: '10px 16px', fontSize: '14px', height: '44px' },
  };

  const getBackground = () => {
    if (disabled) return 'rgba(75, 85, 99, 0.2)';
    if (variant === 'toggle' && !active) return 'rgba(75, 85, 99, 0.2)';
    return `${baseColor}20`; // 20 is hex for ~12.5% opacity
  };

  const getBorderColor = () => {
    if (disabled) return '#4b5563';
    if (variant === 'toggle' && !active) return '#4b5563';
    return baseColor;
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        ...sizeStyles[size],
        background: getBackground(),
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: getBorderColor(),
        borderRadius: '4px',
        color: disabled ? '#6b7280' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: '500',
        transition: 'all 0.2s',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        backdropFilter: 'blur(10px)',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          const opacity = variant === 'toggle' && !active ? '0.3' : '0.4';
          e.currentTarget.style.background = `${baseColor}${Math.round(parseFloat(opacity) * 255).toString(16)}`;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = getBackground();
      }}
    >
      {children}
    </button>
  );
}

// Grouped button container for toggle groups
export function ButtonGroup({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const childCount = React.Children.count(children);

  return (
    <div style={{
      display: 'flex',
      gap: '0',
      ...style,
    }}>
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child)) {
          const isFirst = index === 0;
          const isLast = index === childCount - 1;

          // Get the existing border from child props to avoid conflicts
          const childStyle = child.props.style || {};
          const borderStyle = {
            borderTopWidth: '1px',
            borderRightWidth: '1px',
            borderBottomWidth: '1px',
            borderLeftWidth: index > 0 ? '0' : '1px',
            borderStyle: 'solid',
            borderColor: childStyle.borderColor || '#3b82f6',
          };
          
          return React.cloneElement(child as React.ReactElement<any>, {
            style: {
              ...childStyle,
              ...borderStyle,
              borderRadius: isFirst ? '4px 0 0 4px' : isLast ? '0 4px 4px 0' : '0',
              marginLeft: index > 0 ? '-1px' : undefined, // Overlap borders
            },
          });
        }
        return child;
      })}
    </div>
  );
}