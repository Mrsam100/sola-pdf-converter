/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';

/**
 * Detect if user is on mobile device
 */
export const useIsMobile = (): boolean => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
            const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
            const isMobileUA = mobileRegex.test(userAgent);
            const isMobileWidth = window.innerWidth <= 768;
            const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

            setIsMobile(isMobileUA || (isMobileWidth && isTouchDevice));
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return isMobile;
};

/**
 * Get device capabilities
 */
export const useDeviceCapabilities = () => {
    const [capabilities, setCapabilities] = useState({
        camera: false,
        fileInput: true,
        vibration: false,
        orientation: false,
        battery: false
    });

    useEffect(() => {
        const checkCapabilities = async () => {
            const caps = {
                camera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
                fileInput: true,
                vibration: !!navigator.vibrate,
                orientation: 'orientation' in window || 'onorientationchange' in window,
                battery: !!(navigator as any).getBattery
            };
            setCapabilities(caps);
        };

        checkCapabilities();
    }, []);

    return capabilities;
};

/**
 * Detect screen orientation
 */
export const useOrientation = () => {
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
        window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
    );

    useEffect(() => {
        const handleOrientationChange = () => {
            setOrientation(
                window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
            );
        };

        window.addEventListener('resize', handleOrientationChange);
        window.addEventListener('orientationchange', handleOrientationChange);

        return () => {
            window.removeEventListener('resize', handleOrientationChange);
            window.removeEventListener('orientationchange', handleOrientationChange);
        };
    }, []);

    return orientation;
};

/**
 * Prevent zoom on double tap (iOS Safari)
 */
export const usePreventZoom = () => {
    useEffect(() => {
        let lastTouchEnd = 0;

        const preventDoubleTapZoom = (e: TouchEvent) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        };

        document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });

        return () => {
            document.removeEventListener('touchend', preventDoubleTapZoom);
        };
    }, []);
};

/**
 * Handle mobile keyboard visibility
 */
export const useKeyboardVisible = () => {
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

    useEffect(() => {
        let initialHeight = window.innerHeight;

        const handleResize = () => {
            const currentHeight = window.innerHeight;
            setIsKeyboardVisible(currentHeight < initialHeight - 100);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return isKeyboardVisible;
};

/**
 * Add haptic feedback on mobile
 */
export const useHapticFeedback = () => {
    const vibrate = (pattern: number | number[]) => {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    };

    return {
        light: () => vibrate(10),
        medium: () => vibrate(20),
        heavy: () => vibrate(30),
        success: () => vibrate([10, 50, 10]),
        error: () => vibrate([20, 100, 20, 100, 20]),
        pattern: vibrate
    };
};

/**
 * Network status detection
 */
export const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [connectionType, setConnectionType] = useState<string>('unknown');

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Check connection type
        const connection = (navigator as any).connection ||
                          (navigator as any).mozConnection ||
                          (navigator as any).webkitConnection;

        if (connection) {
            setConnectionType(connection.effectiveType || 'unknown');

            const handleConnectionChange = () => {
                setConnectionType(connection.effectiveType || 'unknown');
            };

            connection.addEventListener('change', handleConnectionChange);

            return () => {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
                connection.removeEventListener('change', handleConnectionChange);
            };
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return { isOnline, connectionType };
};

/**
 * Battery status
 */
export const useBatteryStatus = () => {
    const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
    const [isCharging, setIsCharging] = useState<boolean>(false);

    useEffect(() => {
        const updateBatteryInfo = (battery: any) => {
            setBatteryLevel(battery.level * 100);
            setIsCharging(battery.charging);

            battery.addEventListener('levelchange', () => {
                setBatteryLevel(battery.level * 100);
            });

            battery.addEventListener('chargingchange', () => {
                setIsCharging(battery.charging);
            });
        };

        if ((navigator as any).getBattery) {
            (navigator as any).getBattery().then(updateBatteryInfo);
        }
    }, []);

    return { batteryLevel, isCharging };
};
