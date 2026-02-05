/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger, performanceMonitor } from './monitoring';
import { scanFileContent } from './inputValidation';

/**
 * Production-Level File Size Validation and Warning System
 * Optimized for millions of concurrent users
 *
 * Features:
 * - Intelligent file size limits based on operation type and user tier
 * - Memory-aware batch operation validation
 * - Browser capability detection and adaptation
 * - Real-time progress estimation
 * - Efficient memory cleanup utilities
 * - Performance monitoring and optimization
 */

// ============================================
// CONSTANTS AND CONFIGURATION
// ============================================

/**
 * User tier definitions for quota management
 */
export enum UserTier {
  FREE = 'free',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

/**
 * Operation types with different resource requirements
 */
export enum OperationType {
  // Image operations - generally lighter
  IMAGE_TO_PDF = 'image_to_pdf',
  PDF_TO_IMAGE = 'pdf_to_image',
  IMAGE_COMPRESS = 'image_compress',

  // PDF operations - moderate resource usage
  PDF_MERGE = 'pdf_merge',
  PDF_SPLIT = 'pdf_split',
  PDF_COMPRESS = 'pdf_compress',
  PDF_ROTATE = 'pdf_rotate',

  // Heavy operations - high resource usage
  PDF_TO_WORD = 'pdf_to_word',
  WORD_TO_PDF = 'word_to_pdf',
  OCR = 'ocr',

  // Generic operations
  UPLOAD = 'upload',
  PREVIEW = 'preview'
}

/**
 * File size limits per user tier and operation type (in bytes)
 * Optimized for server load distribution and user experience
 */
export const FILE_SIZE_LIMITS: Record<UserTier, Record<OperationType, number>> = {
  [UserTier.FREE]: {
    [OperationType.IMAGE_TO_PDF]: 10 * 1024 * 1024,      // 10MB per image
    [OperationType.PDF_TO_IMAGE]: 50 * 1024 * 1024,      // 50MB PDF
    [OperationType.IMAGE_COMPRESS]: 10 * 1024 * 1024,    // 10MB per image
    [OperationType.PDF_MERGE]: 50 * 1024 * 1024,         // 50MB per PDF
    [OperationType.PDF_SPLIT]: 50 * 1024 * 1024,         // 50MB PDF
    [OperationType.PDF_COMPRESS]: 50 * 1024 * 1024,      // 50MB PDF
    [OperationType.PDF_ROTATE]: 50 * 1024 * 1024,        // 50MB PDF
    [OperationType.PDF_TO_WORD]: 25 * 1024 * 1024,       // 25MB PDF
    [OperationType.WORD_TO_PDF]: 25 * 1024 * 1024,       // 25MB DOCX
    [OperationType.OCR]: 25 * 1024 * 1024,               // 25MB per file
    [OperationType.UPLOAD]: 10 * 1024 * 1024,            // 10MB generic
    [OperationType.PREVIEW]: 5 * 1024 * 1024             // 5MB preview
  },
  [UserTier.PREMIUM]: {
    [OperationType.IMAGE_TO_PDF]: 100 * 1024 * 1024,     // 100MB per image
    [OperationType.PDF_TO_IMAGE]: 200 * 1024 * 1024,     // 200MB PDF
    [OperationType.IMAGE_COMPRESS]: 100 * 1024 * 1024,   // 100MB per image
    [OperationType.PDF_MERGE]: 200 * 1024 * 1024,        // 200MB per PDF
    [OperationType.PDF_SPLIT]: 200 * 1024 * 1024,        // 200MB PDF
    [OperationType.PDF_COMPRESS]: 200 * 1024 * 1024,     // 200MB PDF
    [OperationType.PDF_ROTATE]: 200 * 1024 * 1024,       // 200MB PDF
    [OperationType.PDF_TO_WORD]: 100 * 1024 * 1024,      // 100MB PDF
    [OperationType.WORD_TO_PDF]: 100 * 1024 * 1024,      // 100MB DOCX
    [OperationType.OCR]: 100 * 1024 * 1024,              // 100MB per file
    [OperationType.UPLOAD]: 100 * 1024 * 1024,           // 100MB generic
    [OperationType.PREVIEW]: 50 * 1024 * 1024            // 50MB preview
  },
  [UserTier.ENTERPRISE]: {
    [OperationType.IMAGE_TO_PDF]: 500 * 1024 * 1024,     // 500MB per image
    [OperationType.PDF_TO_IMAGE]: 1024 * 1024 * 1024,    // 1GB PDF
    [OperationType.IMAGE_COMPRESS]: 500 * 1024 * 1024,   // 500MB per image
    [OperationType.PDF_MERGE]: 1024 * 1024 * 1024,       // 1GB per PDF
    [OperationType.PDF_SPLIT]: 1024 * 1024 * 1024,       // 1GB PDF
    [OperationType.PDF_COMPRESS]: 1024 * 1024 * 1024,    // 1GB PDF
    [OperationType.PDF_ROTATE]: 1024 * 1024 * 1024,      // 1GB PDF
    [OperationType.PDF_TO_WORD]: 500 * 1024 * 1024,      // 500MB PDF
    [OperationType.WORD_TO_PDF]: 500 * 1024 * 1024,      // 500MB DOCX
    [OperationType.OCR]: 500 * 1024 * 1024,              // 500MB per file
    [OperationType.UPLOAD]: 500 * 1024 * 1024,           // 500MB generic
    [OperationType.PREVIEW]: 100 * 1024 * 1024           // 100MB preview
  }
};

/**
 * Batch operation limits per user tier
 * Prevents memory exhaustion from processing too many files simultaneously
 */
export const BATCH_LIMITS: Record<UserTier, {
  maxFiles: number;
  maxTotalSize: number;
  maxConcurrent: number;
}> = {
  [UserTier.FREE]: {
    maxFiles: 20,                          // Max 20 files per batch
    maxTotalSize: 100 * 1024 * 1024,       // Max 100MB total
    maxConcurrent: 3                       // Process 3 files concurrently
  },
  [UserTier.PREMIUM]: {
    maxFiles: 100,                         // Max 100 files per batch
    maxTotalSize: 500 * 1024 * 1024,       // Max 500MB total
    maxConcurrent: 5                       // Process 5 files concurrently
  },
  [UserTier.ENTERPRISE]: {
    maxFiles: 500,                         // Max 500 files per batch
    maxTotalSize: 5 * 1024 * 1024 * 1024,  // Max 5GB total
    maxConcurrent: 10                      // Process 10 files concurrently
  }
};

/**
 * Memory estimation multipliers for different operations
 * Used to predict memory usage before processing
 */
export const MEMORY_MULTIPLIERS: Record<OperationType, number> = {
  [OperationType.IMAGE_TO_PDF]: 3,         // Images expand 3x in memory (decoding)
  [OperationType.PDF_TO_IMAGE]: 4,         // PDFs expand 4x (rendering)
  [OperationType.IMAGE_COMPRESS]: 2.5,     // Compression needs working memory
  [OperationType.PDF_MERGE]: 2,            // Multiple PDFs in memory
  [OperationType.PDF_SPLIT]: 1.5,          // Read + write buffers
  [OperationType.PDF_COMPRESS]: 2,         // Original + compressed versions
  [OperationType.PDF_ROTATE]: 1.2,         // Minimal overhead
  [OperationType.PDF_TO_WORD]: 5,          // OCR and layout analysis
  [OperationType.WORD_TO_PDF]: 3,          // Document parsing and rendering
  [OperationType.OCR]: 6,                  // Image processing + text recognition
  [OperationType.UPLOAD]: 1,               // Just file data
  [OperationType.PREVIEW]: 1.5             // Thumbnail generation
};

/**
 * Browser capability thresholds
 */
export const BROWSER_CAPABILITIES = {
  // Minimum available memory to proceed (in bytes)
  MIN_AVAILABLE_MEMORY: 100 * 1024 * 1024,  // 100MB

  // Memory warning threshold (percentage)
  MEMORY_WARNING_THRESHOLD: 75,             // Warn at 75% usage

  // Memory critical threshold (percentage)
  MEMORY_CRITICAL_THRESHOLD: 90,            // Block at 90% usage

  // Concurrent operation limits by device type
  MAX_CONCURRENT_MOBILE: 2,
  MAX_CONCURRENT_TABLET: 4,
  MAX_CONCURRENT_DESKTOP: 8,

  // File processing chunk size (for streaming)
  CHUNK_SIZE: 1024 * 1024,                  // 1MB chunks

  // Maximum chunks to process in memory at once
  MAX_CHUNKS_IN_MEMORY: 10                  // 10MB total
};

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Validation result with detailed information
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
  details?: {
    fileSize: number;
    limit: number;
    estimatedMemory?: number;
    availableMemory?: number;
    processingTime?: number;
  };
}

/**
 * Batch validation result
 */
export interface BatchValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalFiles: number;
    totalSize: number;
    estimatedMemory: number;
    estimatedTime: number;
    canProcess: boolean;
  };
  fileResults: Map<string, ValidationResult>;
}

/**
 * Browser capability information
 */
export interface BrowserCapability {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  availableMemory: number;
  totalMemory: number;
  memoryUsagePercent: number;
  maxConcurrent: number;
  supportsWorkers: boolean;
  supportsWasm: boolean;
  supportsOffscreenCanvas: boolean;
}

/**
 * Progress estimation information
 */
export interface ProgressEstimation {
  currentFile: number;
  totalFiles: number;
  currentFileProgress: number;
  overallProgress: number;
  estimatedTimeRemaining: number;
  bytesProcessed: number;
  totalBytes: number;
  filesCompleted: string[];
  currentFileName: string;
}

// ============================================
// BROWSER CAPABILITY DETECTION
// ============================================

/**
 * Detect browser capabilities and system resources
 * Critical for optimizing performance across different devices
 */
export class BrowserCapabilityDetector {
  private static instance: BrowserCapabilityDetector;
  private cachedCapability: BrowserCapability | null = null;
  private lastCheck: number = 0;
  private readonly CACHE_DURATION = 30000; // Re-check every 30 seconds

  private constructor() {}

  static getInstance(): BrowserCapabilityDetector {
    if (!BrowserCapabilityDetector.instance) {
      BrowserCapabilityDetector.instance = new BrowserCapabilityDetector();
    }
    return BrowserCapabilityDetector.instance;
  }

  /**
   * Get current browser capabilities with intelligent caching
   */
  getCapabilities(): BrowserCapability {
    const now = Date.now();

    // Return cached result if still valid
    if (this.cachedCapability && (now - this.lastCheck) < this.CACHE_DURATION) {
      return this.cachedCapability;
    }

    // Detect device type
    const deviceType = this.detectDeviceType();

    // Get memory information
    const memoryInfo = this.getMemoryInfo();

    // Determine max concurrent operations based on device
    const maxConcurrent = this.getMaxConcurrent(deviceType, memoryInfo.availableMemory);

    // Check feature support
    const supportsWorkers = typeof Worker !== 'undefined';
    const supportsWasm = typeof WebAssembly !== 'undefined';
    const supportsOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';

    this.cachedCapability = {
      deviceType,
      ...memoryInfo,
      maxConcurrent,
      supportsWorkers,
      supportsWasm,
      supportsOffscreenCanvas
    };

    this.lastCheck = now;

    logger.debug('Browser capabilities detected', this.cachedCapability);

    return this.cachedCapability;
  }

  /**
   * Detect device type based on screen size and user agent
   */
  private detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const maxDimension = Math.max(width, height);

    // Check user agent for mobile indicators
    const ua = navigator.userAgent.toLowerCase();
    const isMobileUA = /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);

    if (maxDimension < 768 || (isMobileUA && maxDimension < 1024)) {
      return 'mobile';
    } else if (maxDimension < 1024) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  /**
   * Get memory information with fallback for unsupported browsers
   */
  private getMemoryInfo(): {
    availableMemory: number;
    totalMemory: number;
    memoryUsagePercent: number;
  } {
    // Try to use Performance Memory API (Chrome/Edge)
    // @ts-ignore - Non-standard API
    if (performance.memory) {
      // @ts-ignore
      const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = performance.memory;

      return {
        availableMemory: jsHeapSizeLimit - usedJSHeapSize,
        totalMemory: jsHeapSizeLimit,
        memoryUsagePercent: (usedJSHeapSize / jsHeapSizeLimit) * 100
      };
    }

    // Estimate based on device type for browsers without memory API
    const deviceType = this.detectDeviceType();
    const estimatedTotal = deviceType === 'mobile' ? 512 * 1024 * 1024 :
                          deviceType === 'tablet' ? 1024 * 1024 * 1024 :
                          2048 * 1024 * 1024;

    return {
      availableMemory: estimatedTotal * 0.5, // Assume 50% available
      totalMemory: estimatedTotal,
      memoryUsagePercent: 50
    };
  }

  /**
   * Calculate max concurrent operations based on device and available memory
   */
  private getMaxConcurrent(deviceType: 'mobile' | 'tablet' | 'desktop', availableMemory: number): number {
    const baseLimit = deviceType === 'mobile' ? BROWSER_CAPABILITIES.MAX_CONCURRENT_MOBILE :
                     deviceType === 'tablet' ? BROWSER_CAPABILITIES.MAX_CONCURRENT_TABLET :
                     BROWSER_CAPABILITIES.MAX_CONCURRENT_DESKTOP;

    // Reduce concurrent operations if memory is low
    const memoryGB = availableMemory / (1024 * 1024 * 1024);
    if (memoryGB < 0.5) return Math.min(baseLimit, 2);
    if (memoryGB < 1) return Math.min(baseLimit, 3);

    return baseLimit;
  }

  /**
   * Check if browser can handle the operation
   */
  canHandle(operationType: OperationType, totalSize: number): { canHandle: boolean; reason?: string } {
    const capabilities = this.getCapabilities();
    const estimatedMemory = totalSize * MEMORY_MULTIPLIERS[operationType];

    // Check if enough memory available
    if (estimatedMemory > capabilities.availableMemory) {
      return {
        canHandle: false,
        reason: `Insufficient memory. Estimated ${this.formatBytes(estimatedMemory)} needed, ${this.formatBytes(capabilities.availableMemory)} available.`
      };
    }

    // Check if memory usage is critical
    if (capabilities.memoryUsagePercent > BROWSER_CAPABILITIES.MEMORY_CRITICAL_THRESHOLD) {
      return {
        canHandle: false,
        reason: `Browser memory critically low (${capabilities.memoryUsagePercent.toFixed(1)}% used). Please close some tabs and try again.`
      };
    }

    return { canHandle: true };
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }
}

// ============================================
// FILE SIZE VALIDATOR
// ============================================

/**
 * Main file size validator with comprehensive validation logic
 */
export class FileSizeValidator {
  private userTier: UserTier;
  private browserCapability: BrowserCapabilityDetector;

  constructor(userTier: UserTier = UserTier.FREE) {
    this.userTier = userTier;
    this.browserCapability = BrowserCapabilityDetector.getInstance();
  }

  /**
   * Set user tier for validation
   */
  setUserTier(tier: UserTier): void {
    this.userTier = tier;
    logger.info('User tier updated', { tier });
  }

  /**
   * Validate a single file
   */
  async validateFile(
    file: File,
    operationType: OperationType
  ): Promise<ValidationResult> {
    const endTimer = performanceMonitor.startTimer('file_validation');

    try {
      // Get file size limit for this operation and user tier
      const limit = FILE_SIZE_LIMITS[this.userTier][operationType];
      const fileSize = file.size;

      // Basic size validation
      if (fileSize === 0) {
        return {
          valid: false,
          error: 'File is empty. Please select a valid file.'
        };
      }

      if (fileSize > limit) {
        const limitMB = this.formatBytes(limit);
        const fileMB = this.formatBytes(fileSize);

        return {
          valid: false,
          error: `File size (${fileMB}) exceeds the limit (${limitMB}) for ${this.userTier} users.`,
          details: {
            fileSize,
            limit
          }
        };
      }

      // Estimate memory usage
      const estimatedMemory = fileSize * MEMORY_MULTIPLIERS[operationType];
      const capabilities = this.browserCapability.getCapabilities();

      // Check browser capability
      const canHandle = this.browserCapability.canHandle(operationType, fileSize);
      if (!canHandle.canHandle) {
        return {
          valid: false,
          error: canHandle.reason,
          details: {
            fileSize,
            limit,
            estimatedMemory,
            availableMemory: capabilities.availableMemory
          }
        };
      }

      // Warning for large files
      let warning: string | undefined;
      if (fileSize > limit * 0.8) {
        warning = `File is large (${this.formatBytes(fileSize)}). Processing may take longer than usual.`;
      }

      // Check if memory usage is approaching threshold
      if (capabilities.memoryUsagePercent > BROWSER_CAPABILITIES.MEMORY_WARNING_THRESHOLD) {
        warning = `Browser memory usage is high (${capabilities.memoryUsagePercent.toFixed(1)}%). Consider closing other tabs for better performance.`;
      }

      // Security scan for malicious content
      const securityScan = await scanFileContent(file);
      if (!securityScan.safe) {
        return {
          valid: false,
          error: securityScan.threat || 'File appears to be unsafe.'
        };
      }

      logger.info('File validation passed', {
        fileName: file.name,
        fileSize,
        operationType,
        estimatedMemory
      });

      return {
        valid: true,
        warning,
        details: {
          fileSize,
          limit,
          estimatedMemory,
          availableMemory: capabilities.availableMemory,
          processingTime: this.estimateProcessingTime(fileSize, operationType)
        }
      };

    } catch (error) {
      logger.error('File validation failed', error as Error);
      return {
        valid: false,
        error: 'An error occurred during file validation. Please try again.'
      };
    } finally {
      endTimer();
    }
  }

  /**
   * Validate batch of files
   */
  async validateBatch(
    files: File[],
    operationType: OperationType
  ): Promise<BatchValidationResult> {
    const endTimer = performanceMonitor.startTimer('batch_validation');

    try {
      const batchLimits = BATCH_LIMITS[this.userTier];
      const errors: string[] = [];
      const warnings: string[] = [];
      const fileResults = new Map<string, ValidationResult>();

      // Check number of files
      if (files.length === 0) {
        errors.push('No files selected. Please add files to process.');
        return this.createBatchResult(false, errors, warnings, fileResults, files);
      }

      if (files.length > batchLimits.maxFiles) {
        errors.push(
          `Too many files. Maximum ${batchLimits.maxFiles} files allowed for ${this.userTier} users. You selected ${files.length} files.`
        );
      }

      // Calculate total size
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      if (totalSize > batchLimits.maxTotalSize) {
        errors.push(
          `Total file size (${this.formatBytes(totalSize)}) exceeds the limit (${this.formatBytes(batchLimits.maxTotalSize)}) for ${this.userTier} users.`
        );
      }

      // Validate each file individually
      const validationPromises = files.map(async (file) => {
        const result = await this.validateFile(file, operationType);
        fileResults.set(file.name, result);

        if (!result.valid && result.error) {
          errors.push(`${file.name}: ${result.error}`);
        }
        if (result.warning) {
          warnings.push(`${file.name}: ${result.warning}`);
        }

        return result;
      });

      await Promise.all(validationPromises);

      // Check overall memory requirements
      const estimatedMemory = totalSize * MEMORY_MULTIPLIERS[operationType];
      const capabilities = this.browserCapability.getCapabilities();

      if (estimatedMemory > capabilities.availableMemory) {
        errors.push(
          `Batch requires approximately ${this.formatBytes(estimatedMemory)} of memory, but only ${this.formatBytes(capabilities.availableMemory)} is available. Try processing fewer files at once.`
        );
      }

      // Warnings for large batches
      if (files.length > batchLimits.maxFiles * 0.8) {
        warnings.push(
          `Processing ${files.length} files may take considerable time. Consider splitting into smaller batches for better performance.`
        );
      }

      const canProcess = errors.length === 0;

      if (canProcess) {
        logger.info('Batch validation passed', {
          fileCount: files.length,
          totalSize,
          estimatedMemory,
          operationType
        });
      } else {
        logger.warn('Batch validation failed', { errors });
      }

      return this.createBatchResult(canProcess, errors, warnings, fileResults, files);

    } catch (error) {
      logger.error('Batch validation failed', error as Error);
      return this.createBatchResult(false, ['Batch validation error occurred'], [], new Map(), files);
    } finally {
      endTimer();
    }
  }

  /**
   * Create batch validation result
   */
  private createBatchResult(
    valid: boolean,
    errors: string[],
    warnings: string[],
    fileResults: Map<string, ValidationResult>,
    files: File[]
  ): BatchValidationResult {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const estimatedMemory = totalSize * MEMORY_MULTIPLIERS[OperationType.UPLOAD];
    const estimatedTime = this.estimateBatchProcessingTime(files, OperationType.UPLOAD);

    return {
      valid,
      errors,
      warnings,
      summary: {
        totalFiles: files.length,
        totalSize,
        estimatedMemory,
        estimatedTime,
        canProcess: valid
      },
      fileResults
    };
  }

  /**
   * Estimate processing time for a single file (in milliseconds)
   */
  private estimateProcessingTime(fileSize: number, operationType: OperationType): number {
    // Base processing speed: 10MB per second for simple operations
    const baseSpeed = 10 * 1024 * 1024;

    // Complexity multipliers
    const complexityMultipliers: Record<OperationType, number> = {
      [OperationType.IMAGE_TO_PDF]: 1,
      [OperationType.PDF_TO_IMAGE]: 2,
      [OperationType.IMAGE_COMPRESS]: 1.5,
      [OperationType.PDF_MERGE]: 0.5,
      [OperationType.PDF_SPLIT]: 0.3,
      [OperationType.PDF_COMPRESS]: 2,
      [OperationType.PDF_ROTATE]: 0.2,
      [OperationType.PDF_TO_WORD]: 5,
      [OperationType.WORD_TO_PDF]: 3,
      [OperationType.OCR]: 10,
      [OperationType.UPLOAD]: 0.1,
      [OperationType.PREVIEW]: 0.5
    };

    const multiplier = complexityMultipliers[operationType] || 1;
    return (fileSize / baseSpeed) * multiplier * 1000; // Convert to milliseconds
  }

  /**
   * Estimate total processing time for a batch (in milliseconds)
   */
  private estimateBatchProcessingTime(files: File[], operationType: OperationType): number {
    const capabilities = this.browserCapability.getCapabilities();
    const maxConcurrent = capabilities.maxConcurrent;

    // Calculate time for each file
    const fileTimes = files.map(file => this.estimateProcessingTime(file.size, operationType));

    // Simulate concurrent processing
    let totalTime = 0;
    for (let i = 0; i < fileTimes.length; i += maxConcurrent) {
      const batch = fileTimes.slice(i, i + maxConcurrent);
      totalTime += Math.max(...batch);
    }

    return totalTime;
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  /**
   * Get user-friendly warning message
   */
  getWarningMessage(fileSize: number, operationType: OperationType): string | null {
    const limit = FILE_SIZE_LIMITS[this.userTier][operationType];
    const percentage = (fileSize / limit) * 100;

    if (percentage > 90) {
      return `This file is very close to your size limit (${percentage.toFixed(0)}%). Consider upgrading for larger file support.`;
    }

    if (percentage > 75) {
      return `This file is large (${this.formatBytes(fileSize)}). Processing may take a few moments.`;
    }

    const capabilities = this.browserCapability.getCapabilities();
    if (capabilities.memoryUsagePercent > BROWSER_CAPABILITIES.MEMORY_WARNING_THRESHOLD) {
      return `Your browser memory is ${capabilities.memoryUsagePercent.toFixed(0)}% full. Close unused tabs for better performance.`;
    }

    return null;
  }
}

// ============================================
// PROGRESS TRACKER
// ============================================

/**
 * Track progress of file processing operations
 */
export class ProgressTracker {
  private currentFile: number = 0;
  private totalFiles: number = 0;
  private currentFileProgress: number = 0;
  private bytesProcessed: number = 0;
  private totalBytes: number = 0;
  private startTime: number = 0;
  private filesCompleted: string[] = [];
  private currentFileName: string = '';

  /**
   * Initialize progress tracking
   */
  start(files: File[]): void {
    this.currentFile = 0;
    this.totalFiles = files.length;
    this.currentFileProgress = 0;
    this.bytesProcessed = 0;
    this.totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    this.startTime = Date.now();
    this.filesCompleted = [];
    this.currentFileName = files[0]?.name || '';

    logger.info('Progress tracking started', {
      totalFiles: this.totalFiles,
      totalBytes: this.totalBytes
    });
  }

  /**
   * Update progress for current file
   */
  updateFileProgress(bytesProcessed: number, totalBytes: number): void {
    this.currentFileProgress = (bytesProcessed / totalBytes) * 100;
  }

  /**
   * Mark current file as complete and move to next
   */
  completeFile(fileName: string): void {
    this.filesCompleted.push(fileName);
    this.currentFile++;
    this.currentFileProgress = 0;

    logger.debug('File completed', {
      fileName,
      completed: this.currentFile,
      total: this.totalFiles
    });
  }

  /**
   * Update bytes processed
   */
  updateBytesProcessed(bytes: number): void {
    this.bytesProcessed += bytes;
  }

  /**
   * Set current file name
   */
  setCurrentFile(fileName: string): void {
    this.currentFileName = fileName;
  }

  /**
   * Get current progress estimation
   */
  getProgress(): ProgressEstimation {
    const overallProgress = this.totalFiles > 0
      ? ((this.currentFile + (this.currentFileProgress / 100)) / this.totalFiles) * 100
      : 0;

    const elapsedTime = Date.now() - this.startTime;
    const estimatedTotalTime = overallProgress > 0
      ? (elapsedTime / overallProgress) * 100
      : 0;
    const estimatedTimeRemaining = Math.max(0, estimatedTotalTime - elapsedTime);

    return {
      currentFile: this.currentFile,
      totalFiles: this.totalFiles,
      currentFileProgress: this.currentFileProgress,
      overallProgress,
      estimatedTimeRemaining,
      bytesProcessed: this.bytesProcessed,
      totalBytes: this.totalBytes,
      filesCompleted: [...this.filesCompleted],
      currentFileName: this.currentFileName
    };
  }

  /**
   * Get formatted progress string
   */
  getFormattedProgress(): string {
    const progress = this.getProgress();
    const timeRemaining = this.formatTime(progress.estimatedTimeRemaining);

    return `Processing ${progress.currentFile + 1} of ${progress.totalFiles} files (${progress.overallProgress.toFixed(1)}%) - ${timeRemaining} remaining`;
  }

  /**
   * Format milliseconds to human-readable time
   */
  private formatTime(ms: number): string {
    if (ms < 1000) return 'Less than a second';
    if (ms < 60000) return `${Math.round(ms / 1000)} seconds`;
    if (ms < 3600000) return `${Math.round(ms / 60000)} minutes`;
    return `${Math.round(ms / 3600000)} hours`;
  }

  /**
   * Reset progress
   */
  reset(): void {
    this.currentFile = 0;
    this.totalFiles = 0;
    this.currentFileProgress = 0;
    this.bytesProcessed = 0;
    this.totalBytes = 0;
    this.startTime = 0;
    this.filesCompleted = [];
    this.currentFileName = '';
  }
}

// ============================================
// MEMORY CLEANUP UTILITIES
// ============================================

/**
 * Memory cleanup utilities optimized for file processing
 */
export class MemoryCleanupManager {
  private objectUrls: Set<string> = new Set();
  private arrayBuffers: Set<ArrayBuffer> = new Set();
  private blobs: Set<Blob> = new Set();

  /**
   * Register an object URL for cleanup
   */
  registerObjectUrl(url: string): void {
    this.objectUrls.add(url);
  }

  /**
   * Register an ArrayBuffer for tracking
   */
  registerArrayBuffer(buffer: ArrayBuffer): void {
    this.arrayBuffers.add(buffer);
  }

  /**
   * Register a Blob for tracking
   */
  registerBlob(blob: Blob): void {
    this.blobs.add(blob);
  }

  /**
   * Revoke a specific object URL
   */
  revokeObjectUrl(url: string): void {
    if (this.objectUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.objectUrls.delete(url);
      logger.debug('Object URL revoked', { url });
    }
  }

  /**
   * Clean up all registered resources
   */
  cleanup(): void {
    // Revoke all object URLs
    this.objectUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        logger.warn('Failed to revoke object URL', { url });
      }
    });
    this.objectUrls.clear();

    // Clear references to help GC
    this.arrayBuffers.clear();
    this.blobs.clear();

    logger.info('Memory cleanup completed', {
      objectUrlsRevoked: this.objectUrls.size
    });

    // Suggest garbage collection if available
    this.requestGarbageCollection();
  }

  /**
   * Request garbage collection (if available)
   */
  private requestGarbageCollection(): void {
    // @ts-ignore - Non-standard API
    if (typeof window.gc === 'function') {
      try {
        // @ts-ignore
        window.gc();
        logger.debug('Garbage collection requested');
      } catch (error) {
        // Silently fail - GC is not critical
      }
    }
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    objectUrls: number;
    arrayBuffers: number;
    blobs: number;
  } {
    return {
      objectUrls: this.objectUrls.size,
      arrayBuffers: this.arrayBuffers.size,
      blobs: this.blobs.size
    };
  }

  /**
   * Cleanup with delay (useful for cleanup after operations)
   */
  cleanupDelayed(delayMs: number = 1000): void {
    setTimeout(() => {
      this.cleanup();
    }, delayMs);
  }
}

// ============================================
// SINGLETON INSTANCES
// ============================================

/**
 * Singleton instances for easy access throughout the application
 */
export const fileSizeValidator = new FileSizeValidator(UserTier.FREE);
export const progressTracker = new ProgressTracker();
export const memoryCleanupManager = new MemoryCleanupManager();
export const browserCapabilityDetector = BrowserCapabilityDetector.getInstance();

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format bytes to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * Get file size limit for operation
 */
export function getFileSizeLimit(
  operationType: OperationType,
  userTier: UserTier = UserTier.FREE
): number {
  return FILE_SIZE_LIMITS[userTier][operationType];
}

/**
 * Get batch limits for user tier
 */
export function getBatchLimits(userTier: UserTier = UserTier.FREE) {
  return BATCH_LIMITS[userTier];
}

/**
 * Check if file size is within limits
 */
export function isFileSizeValid(
  fileSize: number,
  operationType: OperationType,
  userTier: UserTier = UserTier.FREE
): boolean {
  return fileSize > 0 && fileSize <= FILE_SIZE_LIMITS[userTier][operationType];
}

/**
 * Get upgrade suggestion message
 */
export function getUpgradeSuggestion(
  fileSize: number,
  operationType: OperationType,
  currentTier: UserTier
): string | null {
  // If user is already enterprise, no upgrade available
  if (currentTier === UserTier.ENTERPRISE) {
    return null;
  }

  const nextTier = currentTier === UserTier.FREE ? UserTier.PREMIUM : UserTier.ENTERPRISE;
  const nextLimit = FILE_SIZE_LIMITS[nextTier][operationType];

  if (fileSize <= nextLimit) {
    return `Upgrade to ${nextTier} to process files up to ${formatFileSize(nextLimit)}!`;
  }

  // If even enterprise can't handle it
  if (currentTier === UserTier.PREMIUM && fileSize > FILE_SIZE_LIMITS[UserTier.ENTERPRISE][operationType]) {
    return 'This file exceeds our maximum supported size. Please try a smaller file.';
  }

  return null;
}

/**
 * Log validation metrics for monitoring
 */
export function logValidationMetrics(
  operationType: OperationType,
  fileCount: number,
  totalSize: number,
  validationResult: boolean
): void {
  logger.info('Validation metrics', {
    operationType,
    fileCount,
    totalSize: formatFileSize(totalSize),
    validationResult,
    timestamp: new Date().toISOString()
  });
}
