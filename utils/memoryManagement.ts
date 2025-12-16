/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from './monitoring';

/**
 * Memory Management Utilities
 * Prevents memory leaks and manages resource cleanup
 */

// Track blob URLs for cleanup
const blobURLRegistry = new Set<string>();

// Track timers for cleanup
const timerRegistry = new Set<number>();

// Track event listeners for cleanup
type EventListenerEntry = {
  element: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
};
const eventListenerRegistry = new Set<EventListenerEntry>();

/**
 * Create and register a blob URL for automatic cleanup
 */
export const createBlobURL = (blob: Blob): string => {
  const url = URL.createObjectURL(blob);
  blobURLRegistry.add(url);

  logger.debug('Blob URL created', { url, size: blob.size });

  return url;
};

/**
 * Revoke and unregister a blob URL
 */
export const revokeBlobURL = (url: string): void => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
    blobURLRegistry.delete(url);

    logger.debug('Blob URL revoked', { url });
  }
};

/**
 * Revoke all registered blob URLs
 */
export const revokeAllBlobURLs = (): void => {
  let count = 0;
  blobURLRegistry.forEach(url => {
    URL.revokeObjectURL(url);
    count++;
  });
  blobURLRegistry.clear();

  if (count > 0) {
    logger.info('All blob URLs revoked', { count });
  }
};

/**
 * Register and set a timeout with automatic cleanup
 */
export const registerTimeout = (
  callback: () => void,
  delay: number
): number => {
  const timerId = window.setTimeout(() => {
    callback();
    timerRegistry.delete(timerId);
  }, delay);

  timerRegistry.add(timerId);
  return timerId;
};

/**
 * Register and set an interval with automatic cleanup
 */
export const registerInterval = (
  callback: () => void,
  delay: number
): number => {
  const timerId = window.setInterval(callback, delay);
  timerRegistry.add(timerId);
  return timerId;
};

/**
 * Clear a registered timer
 */
export const clearRegisteredTimer = (timerId: number): void => {
  window.clearTimeout(timerId);
  window.clearInterval(timerId);
  timerRegistry.delete(timerId);
};

/**
 * Clear all registered timers
 */
export const clearAllTimers = (): void => {
  timerRegistry.forEach(timerId => {
    window.clearTimeout(timerId);
    window.clearInterval(timerId);
  });
  timerRegistry.clear();

  logger.debug('All timers cleared');
};

/**
 * Register an event listener for automatic cleanup
 */
export const registerEventListener = (
  element: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions
): void => {
  element.addEventListener(type, listener, options);

  eventListenerRegistry.add({
    element,
    type,
    listener,
    options
  });
};

/**
 * Unregister a specific event listener
 */
export const unregisterEventListener = (
  element: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject
): void => {
  element.removeEventListener(type, listener);

  // Find and remove from registry
  eventListenerRegistry.forEach(entry => {
    if (entry.element === element && entry.type === type && entry.listener === listener) {
      eventListenerRegistry.delete(entry);
    }
  });
};

/**
 * Cleanup all registered event listeners
 */
export const cleanupAllEventListeners = (): void => {
  eventListenerRegistry.forEach(({ element, type, listener }) => {
    element.removeEventListener(type, listener);
  });
  eventListenerRegistry.clear();

  logger.debug('All event listeners cleaned up');
};

/**
 * Clean up a canvas element to free memory
 */
export const cleanupCanvas = (canvas: HTMLCanvasElement): void => {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Reset canvas size to 0 to free memory
  canvas.width = 0;
  canvas.height = 0;

  logger.debug('Canvas cleaned up');
};

/**
 * Clean up an image element
 */
export const cleanupImage = (img: HTMLImageElement): void => {
  if (!img) return;

  // Revoke blob URL if it's a blob
  if (img.src && img.src.startsWith('blob:')) {
    revokeBlobURL(img.src);
  }

  img.src = '';
  img.srcset = '';

  logger.debug('Image cleaned up');
};

/**
 * Clean up a video element
 */
export const cleanupVideo = (video: HTMLVideoElement): void => {
  if (!video) return;

  video.pause();
  video.removeAttribute('src');
  video.load();

  logger.debug('Video cleaned up');
};

/**
 * Clean up an audio element
 */
export const cleanupAudio = (audio: HTMLAudioElement): void => {
  if (!audio) return;

  audio.pause();
  audio.removeAttribute('src');
  audio.load();

  logger.debug('Audio cleaned up');
};

/**
 * Monitor memory usage (if available)
 */
export const getMemoryUsage = (): {
  used?: number;
  total?: number;
  percentage?: number;
} | null => {
  // @ts-ignore - Performance memory is non-standard
  if (performance.memory) {
    // @ts-ignore
    const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = performance.memory;

    return {
      used: usedJSHeapSize,
      total: totalJSHeapSize,
      percentage: (usedJSHeapSize / jsHeapSizeLimit) * 100
    };
  }

  return null;
};

/**
 * Log memory usage
 */
export const logMemoryUsage = (): void => {
  const memory = getMemoryUsage();

  if (memory) {
    logger.info('Memory usage', {
      usedMB: (memory.used! / (1024 * 1024)).toFixed(2),
      totalMB: (memory.total! / (1024 * 1024)).toFixed(2),
      percentage: memory.percentage!.toFixed(2)
    });
  }
};

/**
 * Comprehensive cleanup function
 * Call this when unmounting components or cleaning up resources
 */
export const cleanup = (): void => {
  revokeAllBlobURLs();
  clearAllTimers();
  cleanupAllEventListeners();

  logger.info('Comprehensive cleanup completed');
  logMemoryUsage();
};

/**
 * React hook for automatic cleanup on unmount
 */
export const useCleanup = (cleanupFn: () => void): void => {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // Register cleanup to run before page unload
    window.addEventListener('beforeunload', cleanupFn);

    return () => {
      cleanupFn();
      window.removeEventListener('beforeunload', cleanupFn);
    };
  }
};

/**
 * Force garbage collection (Chrome only, for debugging)
 */
export const forceGC = (): void => {
  // @ts-ignore
  if (typeof window.gc === 'function') {
    // @ts-ignore
    window.gc();
    logger.debug('Forced garbage collection');
  } else {
    logger.warn('Garbage collection not available (Chrome with --js-flags=--expose-gc required)');
  }
};
