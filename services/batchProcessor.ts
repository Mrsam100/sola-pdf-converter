/**
 * Production-Grade Batch Processing Queue System
 *
 * Features:
 * - FIFO queue with priority levels
 * - Concurrent processing with configurable limits
 * - Per-file and overall progress tracking
 * - Cancel/pause/resume support
 * - Graceful error handling per file
 * - Automatic memory management and cleanup
 * - TypeScript generics for type safety
 * - Optimized for millions of users
 */

import EventEmitter from 'events';

/**
 * Priority levels for queue items
 */
export enum ProcessingPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Status of a queue item
 */
export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused'
}

/**
 * Status of the batch processor
 */
export enum BatchStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  STOPPED = 'stopped'
}

/**
 * Configuration for batch processor
 */
export interface BatchProcessorConfig {
  maxConcurrent?: number;
  memoryThresholdMB?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  enableMemoryMonitoring?: boolean;
  cleanupAfterProcessing?: boolean;
}

/**
 * Queue item representing a file to be processed
 */
export interface QueueItem<T = any> {
  id: string;
  data: T;
  priority: ProcessingPriority;
  status: ProcessingStatus;
  progress: number;
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: Error;
  retryCount: number;
  metadata?: Record<string, any>;
}

/**
 * Progress information for tracking
 */
export interface ProgressInfo {
  itemId: string;
  progress: number;
  status: ProcessingStatus;
  message?: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  processingItems: number;
  overallProgress: number;
}

/**
 * Result of processing an item
 */
export interface ProcessingResult<R = any> {
  success: boolean;
  data?: R;
  error?: Error;
  processingTime: number;
  memoryUsed?: number;
}

/**
 * Processing function signature
 */
export type ProcessingFunction<T, R> = (
  data: T,
  progressCallback: (progress: number, message?: string) => void
) => Promise<R>;

/**
 * Event types emitted by BatchProcessor
 */
export interface BatchProcessorEvents<T, R> {
  'item:added': (item: QueueItem<T>) => void;
  'item:started': (item: QueueItem<T>) => void;
  'item:progress': (progressInfo: ProgressInfo) => void;
  'item:completed': (item: QueueItem<T>, result: R) => void;
  'item:failed': (item: QueueItem<T>, error: Error) => void;
  'item:cancelled': (item: QueueItem<T>) => void;
  'batch:started': () => void;
  'batch:paused': () => void;
  'batch:resumed': () => void;
  'batch:completed': () => void;
  'batch:progress': (progressInfo: ProgressInfo) => void;
  'memory:warning': (usedMB: number, thresholdMB: number) => void;
  'error': (error: Error) => void;
}

/**
 * Production-grade batch processing queue system
 */
export class BatchProcessor<T = any, R = any> extends EventEmitter {
  private queue: QueueItem<T>[] = [];
  private processing: Map<string, QueueItem<T>> = new Map();
  private completed: Map<string, ProcessingResult<R>> = new Map();
  private failed: Map<string, QueueItem<T>> = new Map();

  private processingFunction: ProcessingFunction<T, R>;
  private config: Required<BatchProcessorConfig>;
  private status: BatchStatus = BatchStatus.IDLE;

  private memoryCheckInterval?: NodeJS.Timeout;
  private idCounter = 0;

  constructor(
    processingFunction: ProcessingFunction<T, R>,
    config: BatchProcessorConfig = {}
  ) {
    super();
    this.processingFunction = processingFunction;
    this.config = {
      maxConcurrent: config.maxConcurrent ?? 3,
      memoryThresholdMB: config.memoryThresholdMB ?? 500,
      retryAttempts: config.retryAttempts ?? 2,
      retryDelayMs: config.retryDelayMs ?? 1000,
      enableMemoryMonitoring: config.enableMemoryMonitoring ?? true,
      cleanupAfterProcessing: config.cleanupAfterProcessing ?? true
    };

    if (this.config.enableMemoryMonitoring) {
      this.startMemoryMonitoring();
    }
  }

  /**
   * Add an item to the processing queue
   */
  public add(
    data: T,
    priority: ProcessingPriority = ProcessingPriority.NORMAL,
    metadata?: Record<string, any>
  ): string {
    const id = this.generateId();
    const item: QueueItem<T> = {
      id,
      data,
      priority,
      status: ProcessingStatus.PENDING,
      progress: 0,
      addedAt: Date.now(),
      retryCount: 0,
      metadata
    };

    // Insert based on priority (higher priority first)
    const insertIndex = this.queue.findIndex(
      (queueItem) => queueItem.priority < priority
    );

    if (insertIndex === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIndex, 0, item);
    }

    this.emit('item:added', item);

    // Auto-start if not running
    if (this.status === BatchStatus.IDLE) {
      this.start();
    }

    return id;
  }

  /**
   * Add multiple items to the queue
   */
  public addBatch(
    items: Array<{
      data: T;
      priority?: ProcessingPriority;
      metadata?: Record<string, any>;
    }>
  ): string[] {
    return items.map((item) =>
      this.add(item.data, item.priority, item.metadata)
    );
  }

  /**
   * Start processing the queue
   */
  public async start(): Promise<void> {
    if (this.status === BatchStatus.RUNNING) {
      return;
    }

    this.status = BatchStatus.RUNNING;
    this.emit('batch:started');

    // Start processing loop
    this.processQueue();
  }

  /**
   * Pause processing
   */
  public pause(): void {
    if (this.status !== BatchStatus.RUNNING) {
      return;
    }

    this.status = BatchStatus.PAUSED;
    this.emit('batch:paused');
  }

  /**
   * Resume processing
   */
  public resume(): void {
    if (this.status !== BatchStatus.PAUSED) {
      return;
    }

    this.status = BatchStatus.RUNNING;
    this.emit('batch:resumed');
    this.processQueue();
  }

  /**
   * Stop processing and clear queue
   */
  public stop(): void {
    this.status = BatchStatus.STOPPED;
    this.queue = [];
    this.stopMemoryMonitoring();
  }

  /**
   * Cancel a specific item
   */
  public cancel(itemId: string): boolean {
    // Check if in queue
    const queueIndex = this.queue.findIndex((item) => item.id === itemId);
    if (queueIndex !== -1) {
      const item = this.queue[queueIndex];
      item.status = ProcessingStatus.CANCELLED;
      this.queue.splice(queueIndex, 1);
      this.emit('item:cancelled', item);
      return true;
    }

    // Check if currently processing
    const processingItem = this.processing.get(itemId);
    if (processingItem) {
      processingItem.status = ProcessingStatus.CANCELLED;
      this.processing.delete(itemId);
      this.emit('item:cancelled', processingItem);
      return true;
    }

    return false;
  }

  /**
   * Cancel all items
   */
  public cancelAll(): void {
    // Cancel queued items
    const queuedItems = [...this.queue];
    queuedItems.forEach((item) => {
      item.status = ProcessingStatus.CANCELLED;
      this.emit('item:cancelled', item);
    });
    this.queue = [];

    // Cancel processing items
    this.processing.forEach((item) => {
      item.status = ProcessingStatus.CANCELLED;
      this.emit('item:cancelled', item);
    });
    this.processing.clear();

    this.status = BatchStatus.IDLE;
  }

  /**
   * Get current status information
   */
  public getStatus(): {
    batchStatus: BatchStatus;
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    overallProgress: number;
  } {
    const total =
      this.queue.length +
      this.processing.size +
      this.completed.size +
      this.failed.size;

    const overallProgress =
      total > 0
        ? ((this.completed.size / total) * 100)
        : 0;

    return {
      batchStatus: this.status,
      total,
      pending: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.size,
      failed: this.failed.size,
      overallProgress: Math.round(overallProgress * 100) / 100
    };
  }

  /**
   * Get item status
   */
  public getItemStatus(itemId: string): QueueItem<T> | undefined {
    // Check queue
    const queueItem = this.queue.find((item) => item.id === itemId);
    if (queueItem) return queueItem;

    // Check processing
    const processingItem = this.processing.get(itemId);
    if (processingItem) return processingItem;

    // Check failed
    const failedItem = this.failed.get(itemId);
    if (failedItem) return failedItem;

    return undefined;
  }

  /**
   * Get processing result for completed item
   */
  public getResult(itemId: string): ProcessingResult<R> | undefined {
    return this.completed.get(itemId);
  }

  /**
   * Get all results
   */
  public getAllResults(): Map<string, ProcessingResult<R>> {
    return new Map(this.completed);
  }

  /**
   * Clear completed items from memory
   */
  public clearCompleted(): void {
    this.completed.clear();
    this.forceGarbageCollection();
  }

  /**
   * Clear failed items from memory
   */
  public clearFailed(): void {
    this.failed.clear();
    this.forceGarbageCollection();
  }

  /**
   * Retry failed items
   */
  public retryFailed(): void {
    this.failed.forEach((item) => {
      item.status = ProcessingStatus.PENDING;
      item.progress = 0;
      item.error = undefined;
      item.retryCount = 0;

      // Re-add to queue with original priority
      const insertIndex = this.queue.findIndex(
        (queueItem) => queueItem.priority < item.priority
      );

      if (insertIndex === -1) {
        this.queue.push(item);
      } else {
        this.queue.splice(insertIndex, 0, item);
      }
    });

    this.failed.clear();

    if (this.status === BatchStatus.IDLE) {
      this.start();
    }
  }

  /**
   * Main processing loop
   */
  private async processQueue(): Promise<void> {
    while (
      this.status === BatchStatus.RUNNING &&
      (this.queue.length > 0 || this.processing.size > 0)
    ) {
      // Check if we can process more items
      if (
        this.processing.size < this.config.maxConcurrent &&
        this.queue.length > 0
      ) {
        const item = this.queue.shift()!;
        this.processItem(item);
      }

      // Wait a bit before checking again
      await this.sleep(100);
    }

    // All items processed
    if (
      this.status === BatchStatus.RUNNING &&
      this.queue.length === 0 &&
      this.processing.size === 0
    ) {
      this.status = BatchStatus.IDLE;
      this.emit('batch:completed');
    }
  }

  /**
   * Process a single item
   */
  private async processItem(item: QueueItem<T>): Promise<void> {
    item.status = ProcessingStatus.PROCESSING;
    item.startedAt = Date.now();
    this.processing.set(item.id, item);

    this.emit('item:started', item);
    this.emitProgress();

    const startTime = Date.now();
    const startMemory = this.getMemoryUsage();

    try {
      // Progress callback for the processing function
      const progressCallback = (progress: number, message?: string) => {
        item.progress = Math.min(100, Math.max(0, progress));
        this.emitItemProgress(item, message);
      };

      // Execute processing function
      const result = await this.processingFunction(
        item.data,
        progressCallback
      );

      // Success
      item.status = ProcessingStatus.COMPLETED;
      item.progress = 100;
      item.completedAt = Date.now();

      const processingResult: ProcessingResult<R> = {
        success: true,
        data: result,
        processingTime: Date.now() - startTime,
        memoryUsed: this.getMemoryUsage() - startMemory
      };

      this.processing.delete(item.id);
      this.completed.set(item.id, processingResult);

      this.emit('item:completed', item, result);
      this.emitProgress();

      // Cleanup if enabled
      if (this.config.cleanupAfterProcessing) {
        this.cleanupAfterItem(item);
      }
    } catch (error) {
      const err = error as Error;

      // Check if we should retry
      if (item.retryCount < this.config.retryAttempts) {
        item.retryCount++;
        item.status = ProcessingStatus.PENDING;
        item.progress = 0;

        this.processing.delete(item.id);

        // Add back to queue with delay
        await this.sleep(this.config.retryDelayMs);

        const insertIndex = this.queue.findIndex(
          (queueItem) => queueItem.priority < item.priority
        );

        if (insertIndex === -1) {
          this.queue.push(item);
        } else {
          this.queue.splice(insertIndex, 0, item);
        }
      } else {
        // Failed after retries
        item.status = ProcessingStatus.FAILED;
        item.error = err;
        item.completedAt = Date.now();

        const processingResult: ProcessingResult<R> = {
          success: false,
          error: err,
          processingTime: Date.now() - startTime,
          memoryUsed: this.getMemoryUsage() - startMemory
        };

        this.processing.delete(item.id);
        this.failed.set(item.id, item);
        this.completed.set(item.id, processingResult);

        this.emit('item:failed', item, err);
        this.emit('error', err);
        this.emitProgress();

        // Cleanup if enabled
        if (this.config.cleanupAfterProcessing) {
          this.cleanupAfterItem(item);
        }
      }
    }
  }

  /**
   * Emit progress for a specific item
   */
  private emitItemProgress(item: QueueItem<T>, message?: string): void {
    const status = this.getStatus();

    const progressInfo: ProgressInfo = {
      itemId: item.id,
      progress: item.progress,
      status: item.status,
      message,
      totalItems: status.total,
      completedItems: status.completed,
      failedItems: status.failed,
      processingItems: status.processing,
      overallProgress: status.overallProgress
    };

    this.emit('item:progress', progressInfo);
  }

  /**
   * Emit overall batch progress
   */
  private emitProgress(): void {
    const status = this.getStatus();

    const progressInfo: ProgressInfo = {
      itemId: '',
      progress: 0,
      status: ProcessingStatus.PROCESSING,
      totalItems: status.total,
      completedItems: status.completed,
      failedItems: status.failed,
      processingItems: status.processing,
      overallProgress: status.overallProgress
    };

    this.emit('batch:progress', progressInfo);
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.memoryCheckInterval = setInterval(() => {
      const usedMB = this.getMemoryUsage();

      if (usedMB > this.config.memoryThresholdMB) {
        this.emit('memory:warning', usedMB, this.config.memoryThresholdMB);

        // Auto-pause if threshold exceeded
        if (this.status === BatchStatus.RUNNING) {
          this.pause();

          // Auto-cleanup and resume
          this.clearCompleted();

          setTimeout(() => {
            if (this.status === BatchStatus.PAUSED) {
              this.resume();
            }
          }, 2000);
        }
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop memory monitoring
   */
  private stopMemoryMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = undefined;
    }
  }

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return Math.round(usage.heapUsed / 1024 / 1024);
    }
    return 0;
  }

  /**
   * Cleanup after processing an item
   */
  private cleanupAfterItem(item: QueueItem<T>): void {
    // Remove data reference to allow GC
    (item as any).data = null;

    // Force garbage collection if available
    this.forceGarbageCollection();
  }

  /**
   * Force garbage collection (if available)
   */
  private forceGarbageCollection(): void {
    if (typeof global !== 'undefined' && (global as any).gc) {
      try {
        (global as any).gc();
      } catch (e) {
        // GC not available
      }
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `item_${Date.now()}_${++this.idCounter}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Destroy the processor and clean up resources
   */
  public destroy(): void {
    this.stop();
    this.stopMemoryMonitoring();
    this.queue = [];
    this.processing.clear();
    this.completed.clear();
    this.failed.clear();
    this.removeAllListeners();
  }
}

/**
 * Simplified batch processor for common use cases
 */
export class SimpleBatchProcessor<T = any, R = any> {
  private processor: BatchProcessor<T, R>;

  constructor(
    processingFunction: ProcessingFunction<T, R>,
    maxConcurrent: number = 3
  ) {
    this.processor = new BatchProcessor(processingFunction, {
      maxConcurrent,
      enableMemoryMonitoring: true,
      cleanupAfterProcessing: true
    });
  }

  /**
   * Process multiple items and return results
   */
  public async processAll(
    items: T[],
    onProgress?: (progress: ProgressInfo) => void
  ): Promise<Map<string, ProcessingResult<R>>> {
    return new Promise((resolve, reject) => {
      const itemIds: string[] = [];

      // Add progress listener
      if (onProgress) {
        this.processor.on('batch:progress', onProgress);
      }

      // Add completion listener
      this.processor.once('batch:completed', () => {
        const results = this.processor.getAllResults();
        this.processor.destroy();
        resolve(results);
      });

      // Add error listener (non-fatal errors are already handled)
      this.processor.on('error', (error) => {
        // Errors are per-item, so we don't reject the whole batch
        console.error('Item processing error:', error);
      });

      // Add all items
      items.forEach((item) => {
        const id = this.processor.add(item);
        itemIds.push(id);
      });
    });
  }

  /**
   * Get the underlying processor for advanced control
   */
  public getProcessor(): BatchProcessor<T, R> {
    return this.processor;
  }
}

/**
 * Priority queue utility for batch processing
 */
export class PriorityQueue<T> {
  private items: Array<{ data: T; priority: number }> = [];

  public enqueue(data: T, priority: number): void {
    const insertIndex = this.items.findIndex(
      (item) => item.priority < priority
    );

    if (insertIndex === -1) {
      this.items.push({ data, priority });
    } else {
      this.items.splice(insertIndex, 0, { data, priority });
    }
  }

  public dequeue(): T | undefined {
    const item = this.items.shift();
    return item?.data;
  }

  public peek(): T | undefined {
    return this.items[0]?.data;
  }

  public get length(): number {
    return this.items.length;
  }

  public clear(): void {
    this.items = [];
  }

  public toArray(): T[] {
    return this.items.map((item) => item.data);
  }
}

/**
 * Batch processor factory for creating pre-configured processors
 */
export class BatchProcessorFactory {
  /**
   * Create a processor optimized for large files
   */
  static forLargeFiles<T, R>(
    processingFunction: ProcessingFunction<T, R>
  ): BatchProcessor<T, R> {
    return new BatchProcessor(processingFunction, {
      maxConcurrent: 2,
      memoryThresholdMB: 800,
      retryAttempts: 1,
      retryDelayMs: 2000,
      enableMemoryMonitoring: true,
      cleanupAfterProcessing: true
    });
  }

  /**
   * Create a processor optimized for small files
   */
  static forSmallFiles<T, R>(
    processingFunction: ProcessingFunction<T, R>
  ): BatchProcessor<T, R> {
    return new BatchProcessor(processingFunction, {
      maxConcurrent: 5,
      memoryThresholdMB: 500,
      retryAttempts: 3,
      retryDelayMs: 500,
      enableMemoryMonitoring: true,
      cleanupAfterProcessing: true
    });
  }

  /**
   * Create a processor optimized for high-priority tasks
   */
  static forHighPriority<T, R>(
    processingFunction: ProcessingFunction<T, R>
  ): BatchProcessor<T, R> {
    return new BatchProcessor(processingFunction, {
      maxConcurrent: 3,
      memoryThresholdMB: 600,
      retryAttempts: 5,
      retryDelayMs: 1000,
      enableMemoryMonitoring: true,
      cleanupAfterProcessing: true
    });
  }

  /**
   * Create a processor with custom configuration
   */
  static create<T, R>(
    processingFunction: ProcessingFunction<T, R>,
    config: BatchProcessorConfig
  ): BatchProcessor<T, R> {
    return new BatchProcessor(processingFunction, config);
  }
}

// Export types for external use
export type { BatchProcessorConfig, QueueItem, ProgressInfo, ProcessingResult, ProcessingFunction };
