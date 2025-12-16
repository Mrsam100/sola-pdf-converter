/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';

/**
 * Hook to track page visibility state
 * Handles browser tab switching and window focus changes
 */
export const usePageVisibility = () => {
    const [isVisible, setIsVisible] = useState(!document.hidden);

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsVisible(!document.hidden);
        };

        // Listen for visibility changes
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Also listen for focus/blur as backup
        window.addEventListener('focus', () => setIsVisible(true));
        window.addEventListener('blur', () => setIsVisible(false));

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', () => setIsVisible(true));
            window.removeEventListener('blur', () => setIsVisible(false));
        };
    }, []);

    return isVisible;
};

/**
 * Hook to prevent tab suspension during processing
 * Uses Wake Lock API when available
 */
export const useWakeLock = (active: boolean) => {
    useEffect(() => {
        let wakeLock: any = null;

        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator && active) {
                    wakeLock = await (navigator as any).wakeLock.request('screen');
                    console.log('Wake Lock acquired');
                }
            } catch (err) {
                console.warn('Wake Lock not supported or failed:', err);
            }
        };

        const releaseWakeLock = async () => {
            if (wakeLock !== null) {
                try {
                    await wakeLock.release();
                    wakeLock = null;
                    console.log('Wake Lock released');
                } catch (err) {
                    console.warn('Wake Lock release failed:', err);
                }
            }
        };

        if (active) {
            requestWakeLock();
        } else {
            releaseWakeLock();
        }

        // Handle visibility change
        const handleVisibilityChange = () => {
            if (document.hidden && wakeLock !== null) {
                // Re-acquire wake lock when page becomes visible again
                releaseWakeLock().then(() => {
                    if (active) requestWakeLock();
                });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            releaseWakeLock();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [active]);
};
