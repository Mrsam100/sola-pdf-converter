/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { useIsMobile, useNetworkStatus, useHapticFeedback, useBatteryStatus } from '../hooks/useMobile';
import { logger } from '../utils/monitoring';

interface MobileOptimizedProps {
  children: React.ReactNode;
}

/**
 * Wrapper component for mobile optimizations
 */
export const MobileOptimized: React.FC<MobileOptimizedProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const { isOnline, connectionType } = useNetworkStatus();
  const { batteryLevel, isCharging } = useBatteryStatus();
  const haptic = useHapticFeedback();

  useEffect(() => {
    if (isMobile) {
      logger.info('Mobile device detected', {
        connectionType,
        batteryLevel,
        isCharging
      });

      // Warn on slow connection
      if (connectionType === '2g' || connectionType === 'slow-2g') {
        logger.warn('Slow connection detected', { connectionType });
      }

      // Warn on low battery
      if (batteryLevel && batteryLevel < 20 && !isCharging) {
        logger.warn('Low battery detected', { batteryLevel });
      }
    }
  }, [isMobile, connectionType, batteryLevel, isCharging]);

  // Add mobile-specific class
  useEffect(() => {
    if (isMobile) {
      document.body.classList.add('mobile-device');
    } else {
      document.body.classList.remove('mobile-device');
    }

    return () => {
      document.body.classList.remove('mobile-device');
    };
  }, [isMobile]);

  // Handle connection status
  useEffect(() => {
    const offlineIndicator = document.getElementById('offline-indicator');
    if (offlineIndicator) {
      offlineIndicator.style.display = isOnline ? 'none' : 'block';
    }

    if (!isOnline && isMobile) {
      haptic.error();
    }
  }, [isOnline, isMobile, haptic]);

  return <>{children}</>;
};

/**
 * Mobile-optimized file input component
 */
interface MobileFileInputProps {
  accept: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  children: React.ReactNode;
  className?: string;
}

export const MobileFileInput: React.FC<MobileFileInputProps> = ({
  accept,
  onChange,
  children,
  className
}) => {
  const isMobile = useIsMobile();
  const haptic = useHapticFeedback();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (isMobile) {
      haptic.light();
    }
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isMobile && e.target.files && e.target.files.length > 0) {
      haptic.success();
    }
    onChange(e);
  };

  return (
    <div onClick={handleClick} className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: 'none' }}
        // Mobile-specific attributes
        capture={isMobile ? 'environment' : undefined}
        multiple={false}
      />
      {children}
    </div>
  );
};

/**
 * Mobile-optimized button with haptic feedback
 */
interface MobileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  hapticType?: 'light' | 'medium' | 'heavy' | 'success' | 'error';
  children: React.ReactNode;
}

export const MobileButton: React.FC<MobileButtonProps> = ({
  hapticType = 'light',
  children,
  onClick,
  ...props
}) => {
  const isMobile = useIsMobile();
  const haptic = useHapticFeedback();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isMobile) {
      haptic[hapticType]();
    }
    onClick?.(e);
  };

  return (
    <button {...props} onClick={handleClick}>
      {children}
    </button>
  );
};

/**
 * Show warning for low battery
 */
export const LowBatteryWarning: React.FC = () => {
  const { batteryLevel, isCharging } = useBatteryStatus();
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed || isCharging || !batteryLevel || batteryLevel > 20) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#ff9800',
        color: 'white',
        padding: '0.75rem 1.5rem',
        borderRadius: '2rem',
        fontSize: '0.875rem',
        zIndex: 10001,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}
    >
      🔋 Low battery ({Math.round(batteryLevel)}%) - Consider charging
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          padding: '0 0.5rem',
          fontSize: '1.2rem'
        }}
      >
        ×
      </button>
    </div>
  );
};

/**
 * Slow connection warning
 */
export const SlowConnectionWarning: React.FC = () => {
  const { connectionType } = useNetworkStatus();
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed || (connectionType !== '2g' && connectionType !== 'slow-2g')) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '70px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#ff6b6b',
        color: 'white',
        padding: '0.75rem 1.5rem',
        borderRadius: '2rem',
        fontSize: '0.875rem',
        zIndex: 10001,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        maxWidth: '90%'
      }}
    >
      🐌 Slow connection detected - Processing may take longer
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          padding: '0 0.5rem',
          fontSize: '1.2rem'
        }}
      >
        ×
      </button>
    </div>
  );
};
