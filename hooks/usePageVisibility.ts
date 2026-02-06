/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to track page visibility state
 * Handles browser tab switching and window focus changes
 */
export const usePageVisibility = () => {
    const [isVisible, setIsVisible] = useState(!document.hidden);

    // Stable function references for proper cleanup
    const handleVisible = useCallback(() => setIsVisible(true), []);
    const handleHidden = useCallback(() => setIsVisible(false), []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsVisible(!document.hidden);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleVisible);
        window.addEventListener('blur', handleHidden);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleVisible);
            window.removeEventListener('blur', handleHidden);
        };
    }, [handleVisible, handleHidden]);

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

        // Re-acquire wake lock when page becomes visible (browsers release it on tab hide)
        const handleVisibilityChange = () => {
            if (!document.hidden && active) {
                requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            releaseWakeLock();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [active]);
};
