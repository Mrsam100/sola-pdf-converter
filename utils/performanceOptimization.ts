/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Performance Optimization Utilities
 * Production-level optimizations for millions of users
 */

// Debounce function to limit rapid calls
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

// Throttle function to ensure minimum time between calls
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Memoization with time-based cache expiry
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  ttl: number = 30000 // 30 seconds default
): T {
  const cache = new Map<string, { value: ReturnType<T>; expiry: number }>();

  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);

    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    const result = func(...args);
    cache.set(key, { value: result, expiry: Date.now() + ttl });

    // Cleanup expired entries
    if (cache.size > 100) {
      const now = Date.now();
      for (const [k, v] of cache.entries()) {
        if (v.expiry < now) {
          cache.delete(k);
        }
      }
    }

    return result;
  }) as T;
}

// Lazy loading with IntersectionObserver
export class LazyLoader {
  private observer: IntersectionObserver;

  constructor(
    onVisible: (element: Element) => void,
    options: IntersectionObserverInit = {}
  ) {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          onVisible(entry.target);
          this.observer.unobserve(entry.target);
        }
      });
    }, options);
  }

  observe(element: Element): void {
    this.observer.observe(element);
  }

  disconnect(): void {
    this.observer.disconnect();
  }
}

// Virtual scrolling helper
export class VirtualScroller<T> {
  private items: T[];
  private itemHeight: number;
  private visibleCount: number;

  constructor(items: T[], itemHeight: number, containerHeight: number) {
    this.items = items;
    this.itemHeight = itemHeight;
    this.visibleCount = Math.ceil(containerHeight / itemHeight) + 2; // Buffer
  }

  getVisibleItems(scrollTop: number): { items: T[]; offset: number } {
    const startIndex = Math.floor(scrollTop / this.itemHeight);
    const endIndex = Math.min(
      startIndex + this.visibleCount,
      this.items.length
    );

    return {
      items: this.items.slice(startIndex, endIndex),
      offset: startIndex * this.itemHeight,
    };
  }

  getTotalHeight(): number {
    return this.items.length * this.itemHeight;
  }
}

// Web Worker pool for CPU-intensive tasks
export class WorkerPool {
  private workers: Worker[] = [];
  private queue: Array<{
    task: any;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }> = [];
  private maxWorkers: number;

  constructor(workerScript: string, maxWorkers: number = navigator.hardwareConcurrency || 4) {
    this.maxWorkers = maxWorkers;

    for (let i = 0; i < maxWorkers; i++) {
      const worker = new Worker(workerScript);
      this.workers.push(worker);
    }
  }

  async execute<T>(task: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const worker = this.workers.find((w) => !(w as any).busy);

      if (worker) {
        this.runTask(worker, task, resolve, reject);
      } else {
        this.queue.push({ task, resolve, reject });
      }
    });
  }

  private runTask(
    worker: Worker,
    task: any,
    resolve: (value: any) => void,
    reject: (reason?: any) => void
  ): void {
    (worker as any).busy = true;

    const handleMessage = (e: MessageEvent) => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      (worker as any).busy = false;
      resolve(e.data);
      this.processQueue();
    };

    const handleError = (e: ErrorEvent) => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      (worker as any).busy = false;
      reject(e.error);
      this.processQueue();
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    worker.postMessage(task);
  }

  private processQueue(): void {
    if (this.queue.length === 0) return;

    const worker = this.workers.find((w) => !(w as any).busy);
    if (worker) {
      const { task, resolve, reject } = this.queue.shift()!;
      this.runTask(worker, task, resolve, reject);
    }
  }

  terminate(): void {
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
    this.queue = [];
  }
}

// Request Animation Frame throttle for smooth animations
export function rafThrottle<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;

  return function executedFunction(...args: Parameters<T>) {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }

    rafId = requestAnimationFrame(() => {
      func(...args);
      rafId = null;
    });
  };
}

// Idle callback for non-critical tasks
export function runWhenIdle(
  callback: () => void,
  options: IdleRequestOptions = { timeout: 1000 }
): number {
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, options);
  }
  // Fallback for browsers without requestIdleCallback
  return window.setTimeout(callback, 0) as any;
}

// Cancel idle callback
export function cancelIdle(id: number): void {
  if ('cancelIdleCallback' in window) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

// Chunk large arrays for processing
export async function processInChunks<T, R>(
  items: T[],
  chunkSize: number,
  processor: (item: T) => Promise<R>,
  onProgress?: (processed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = [];
  let processed = 0;

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(chunk.map(processor));
    results.push(...chunkResults);

    processed += chunk.length;
    onProgress?.(processed, items.length);

    // Yield to browser between chunks
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return results;
}

// Memory-efficient file reader
export async function readFileInChunks(
  file: File,
  chunkSize: number = 1024 * 1024, // 1MB chunks
  onChunk: (chunk: ArrayBuffer, progress: number) => void | Promise<void>
): Promise<void> {
  const totalChunks = Math.ceil(file.size / chunkSize);
  let currentChunk = 0;

  while (currentChunk < totalChunks) {
    const start = currentChunk * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const blob = file.slice(start, end);
    const arrayBuffer = await blob.arrayBuffer();

    await onChunk(arrayBuffer, ((currentChunk + 1) / totalChunks) * 100);
    currentChunk++;
  }
}

// Prefetch resources
export function prefetch(url: string): void {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  document.head.appendChild(link);
}

// Preload critical resources
export function preload(url: string, as: string = 'fetch'): void {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;
  link.as = as;
  document.head.appendChild(link);
}

// Performance monitor
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();

  start(label: string): void {
    this.marks.set(label, performance.now());
  }

  end(label: string): number {
    const start = this.marks.get(label);
    if (!start) {
      console.warn(`No start mark found for "${label}"`);
      return 0;
    }

    const duration = performance.now() - start;
    this.marks.delete(label);

    // Log slow operations in development
    if (process.env.NODE_ENV === 'development' && duration > 1000) {
      console.warn(`Slow operation "${label}": ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  measure(label: string, fn: () => void): number {
    this.start(label);
    fn();
    return this.end(label);
  }

  async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    this.start(label);
    const result = await fn();
    const duration = this.end(label);
    return { result, duration };
  }
}

// Bundle size optimization - dynamic imports
export async function lazyImport<T>(
  importFn: () => Promise<{ default: T }>
): Promise<T> {
  const module = await importFn();
  return module.default;
}

// Cache API helper for offline support
export class CacheManager {
  private cacheName: string;

  constructor(cacheName: string = 'app-cache-v1') {
    this.cacheName = cacheName;
  }

  async cache(url: string, response: Response): Promise<void> {
    if ('caches' in window) {
      const cache = await caches.open(this.cacheName);
      await cache.put(url, response.clone());
    }
  }

  async getCached(url: string): Promise<Response | undefined> {
    if ('caches' in window) {
      const cache = await caches.open(this.cacheName);
      return await cache.match(url);
    }
    return undefined;
  }

  async clearOldCaches(currentVersion: string): Promise<void> {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== currentVersion).map((key) => caches.delete(key))
      );
    }
  }
}

// Image optimization
export async function optimizeImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.9
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // Calculate new dimensions
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

// Singleton pattern for expensive resources
export function singleton<T>(factory: () => T): () => T {
  let instance: T | null = null;

  return () => {
    if (!instance) {
      instance = factory();
    }
    return instance;
  };
}

// Export all utilities
export const perf = new PerformanceMonitor();
