/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    leaving?: boolean;
}

let globalToastFn: ((message: string, type?: ToastType) => void) | null = null;

/** Fire a toast from anywhere (after ToastProvider mounts) */
export const toast = (message: string, type: ToastType = 'info') => {
    globalToastFn?.(message, type);
};

toast.success = (msg: string) => toast(msg, 'success');
toast.error = (msg: string) => toast(msg, 'error');
toast.info = (msg: string) => toast(msg, 'info');
toast.warning = (msg: string) => toast(msg, 'warning');

export const useToast = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const counterRef = useRef(0);

    const addToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = `toast-${++counterRef.current}`;
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto-dismiss after 4s
        setTimeout(() => {
            setToasts(prev =>
                prev.map(t => t.id === id ? { ...t, leaving: true } : t)
            );
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 300);
        }, 4000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev =>
            prev.map(t => t.id === id ? { ...t, leaving: true } : t)
        );
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 300);
    }, []);

    // Register as the global handler
    globalToastFn = addToast;

    return { toasts, addToast, removeToast };
};
