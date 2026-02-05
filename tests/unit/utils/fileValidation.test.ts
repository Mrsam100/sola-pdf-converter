/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  FileSizeValidator,
  ProgressTracker,
  MemoryCleanupManager,
  BrowserCapabilityDetector,
  UserTier,
  OperationType,
  formatFileSize,
  getFileSizeLimit,
  getBatchLimits,
  isFileSizeValid,
  getUpgradeSuggestion,
  FILE_SIZE_LIMITS,
  BATCH_LIMITS
} from '../../../utils/fileValidation';

// Mock file creation helper
function createMockFile(name: string, size: number, type: string = 'application/pdf'): File {
  const blob = new Blob(['x'.repeat(size)], { type });
  return new File([blob], name, { type });
}

describe('FileSizeValidator', () => {
  let validator: FileSizeValidator;

  beforeEach(() => {
    validator = new FileSizeValidator(UserTier.FREE);
  });

  describe('Single File Validation', () => {
    it('should validate a file within size limits', async () => {
      const file = createMockFile('test.pdf', 1024 * 1024); // 1MB
      const result = await validator.validateFile(file, OperationType.PDF_MERGE);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.details).toBeDefined();
      expect(result.details?.fileSize).toBe(1024 * 1024);
    });

    it('should reject a file exceeding size limits', async () => {
      const file = createMockFile('large.pdf', 100 * 1024 * 1024); // 100MB (exceeds free tier 50MB limit)
      const result = await validator.validateFile(file, OperationType.PDF_MERGE);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds the limit');
    });

    it('should reject an empty file', async () => {
      const file = createMockFile('empty.pdf', 0);
      const result = await validator.validateFile(file, OperationType.PDF_MERGE);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should provide warnings for large files near the limit', async () => {
      const limit = FILE_SIZE_LIMITS[UserTier.FREE][OperationType.PDF_MERGE];
      const file = createMockFile('large.pdf', limit * 0.85); // 85% of limit
      const result = await validator.validateFile(file, OperationType.PDF_MERGE);

      expect(result.valid).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('large');
    });

    it('should handle different user tiers', async () => {
      const file = createMockFile('test.pdf', 75 * 1024 * 1024); // 75MB

      // Should fail for free tier (50MB limit)
      const freeValidator = new FileSizeValidator(UserTier.FREE);
      const freeResult = await freeValidator.validateFile(file, OperationType.PDF_MERGE);
      expect(freeResult.valid).toBe(false);

      // Should pass for premium tier (200MB limit)
      const premiumValidator = new FileSizeValidator(UserTier.PREMIUM);
      const premiumResult = await premiumValidator.validateFile(file, OperationType.PDF_MERGE);
      expect(premiumResult.valid).toBe(true);
    });

    it('should provide memory estimates', async () => {
      const file = createMockFile('test.pdf', 10 * 1024 * 1024); // 10MB
      const result = await validator.validateFile(file, OperationType.PDF_TO_IMAGE);

      expect(result.valid).toBe(true);
      expect(result.details?.estimatedMemory).toBeDefined();
      expect(result.details?.estimatedMemory).toBeGreaterThan(file.size);
    });
  });

  describe('Batch File Validation', () => {
    it('should validate a batch of files within limits', async () => {
      const files = [
        createMockFile('file1.pdf', 5 * 1024 * 1024),
        createMockFile('file2.pdf', 5 * 1024 * 1024),
        createMockFile('file3.pdf', 5 * 1024 * 1024)
      ];

      const result = await validator.validateBatch(files, OperationType.PDF_MERGE);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.summary.totalFiles).toBe(3);
      expect(result.summary.totalSize).toBe(15 * 1024 * 1024);
    });

    it('should reject batch with too many files', async () => {
      const files = Array.from({ length: 25 }, (_, i) =>
        createMockFile(`file${i}.pdf`, 1024 * 1024)
      );

      const result = await validator.validateBatch(files, OperationType.PDF_MERGE);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Too many files'))).toBe(true);
    });

    it('should reject batch exceeding total size limit', async () => {
      const files = Array.from({ length: 10 }, (_, i) =>
        createMockFile(`file${i}.pdf`, 15 * 1024 * 1024)
      );

      const result = await validator.validateBatch(files, OperationType.PDF_MERGE);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Total file size'))).toBe(true);
    });

    it('should handle empty file array', async () => {
      const result = await validator.validateBatch([], OperationType.PDF_MERGE);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('No files'))).toBe(true);
    });

    it('should provide warnings for large batches', async () => {
      const batchLimit = BATCH_LIMITS[UserTier.FREE].maxFiles;
      const files = Array.from({ length: batchLimit - 2 }, (_, i) =>
        createMockFile(`file${i}.pdf`, 1024 * 1024)
      );

      const result = await validator.validateBatch(files, OperationType.PDF_MERGE);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should track individual file validation results', async () => {
      const files = [
        createMockFile('valid.pdf', 5 * 1024 * 1024),
        createMockFile('toolarge.pdf', 60 * 1024 * 1024)
      ];

      const result = await validator.validateBatch(files, OperationType.PDF_MERGE);

      expect(result.fileResults.size).toBe(2);
      expect(result.fileResults.get('valid.pdf')?.valid).toBe(true);
      expect(result.fileResults.get('toolarge.pdf')?.valid).toBe(false);
    });
  });

  describe('User Tier Management', () => {
    it('should allow changing user tier', async () => {
      validator.setUserTier(UserTier.PREMIUM);
      const file = createMockFile('test.pdf', 75 * 1024 * 1024);
      const result = await validator.validateFile(file, OperationType.PDF_MERGE);

      expect(result.valid).toBe(true);
    });
  });
});

describe('BrowserCapabilityDetector', () => {
  let detector: BrowserCapabilityDetector;

  beforeEach(() => {
    detector = BrowserCapabilityDetector.getInstance();
  });

  it('should detect browser capabilities', () => {
    const capabilities = detector.getCapabilities();

    expect(capabilities.deviceType).toMatch(/mobile|tablet|desktop/);
    expect(capabilities.availableMemory).toBeGreaterThan(0);
    expect(capabilities.totalMemory).toBeGreaterThan(0);
    expect(capabilities.memoryUsagePercent).toBeGreaterThanOrEqual(0);
    expect(capabilities.memoryUsagePercent).toBeLessThanOrEqual(100);
    expect(capabilities.maxConcurrent).toBeGreaterThan(0);
  });

  it('should cache capabilities for performance', () => {
    const first = detector.getCapabilities();
    const second = detector.getCapabilities();

    expect(first).toBe(second); // Should return same object reference
  });

  it('should determine if operation can be handled', () => {
    const result = detector.canHandle(OperationType.PDF_MERGE, 10 * 1024 * 1024);

    expect(result).toHaveProperty('canHandle');
    expect(typeof result.canHandle).toBe('boolean');
  });
});

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;

  beforeEach(() => {
    tracker = new ProgressTracker();
  });

  afterEach(() => {
    tracker.reset();
  });

  it('should initialize progress tracking', () => {
    const files = [
      createMockFile('file1.pdf', 1024 * 1024),
      createMockFile('file2.pdf', 1024 * 1024)
    ];

    tracker.start(files);
    const progress = tracker.getProgress();

    expect(progress.totalFiles).toBe(2);
    expect(progress.currentFile).toBe(0);
    expect(progress.overallProgress).toBe(0);
  });

  it('should update file progress', () => {
    const files = [createMockFile('file.pdf', 1024 * 1024)];
    tracker.start(files);

    tracker.updateFileProgress(512 * 1024, 1024 * 1024);
    const progress = tracker.getProgress();

    expect(progress.currentFileProgress).toBe(50);
  });

  it('should track completed files', () => {
    const files = [
      createMockFile('file1.pdf', 1024 * 1024),
      createMockFile('file2.pdf', 1024 * 1024)
    ];
    tracker.start(files);

    tracker.completeFile('file1.pdf');
    const progress = tracker.getProgress();

    expect(progress.filesCompleted).toContain('file1.pdf');
    expect(progress.currentFile).toBe(1);
  });

  it('should calculate overall progress', () => {
    const files = [
      createMockFile('file1.pdf', 1024 * 1024),
      createMockFile('file2.pdf', 1024 * 1024)
    ];
    tracker.start(files);

    tracker.completeFile('file1.pdf');
    const progress = tracker.getProgress();

    expect(progress.overallProgress).toBe(50);
  });

  it('should estimate time remaining', () => {
    const files = [createMockFile('file.pdf', 1024 * 1024)];
    tracker.start(files);

    // Simulate some progress
    tracker.updateFileProgress(512 * 1024, 1024 * 1024);
    const progress = tracker.getProgress();

    expect(progress.estimatedTimeRemaining).toBeGreaterThanOrEqual(0);
  });

  it('should format progress as string', () => {
    const files = [createMockFile('file.pdf', 1024 * 1024)];
    tracker.start(files);

    const formatted = tracker.getFormattedProgress();

    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('Processing');
  });

  it('should reset progress', () => {
    const files = [createMockFile('file.pdf', 1024 * 1024)];
    tracker.start(files);
    tracker.completeFile('file.pdf');

    tracker.reset();
    const progress = tracker.getProgress();

    expect(progress.totalFiles).toBe(0);
    expect(progress.currentFile).toBe(0);
    expect(progress.filesCompleted).toHaveLength(0);
  });
});

describe('MemoryCleanupManager', () => {
  let manager: MemoryCleanupManager;

  beforeEach(() => {
    manager = new MemoryCleanupManager();
  });

  afterEach(() => {
    manager.cleanup();
  });

  it('should register and track object URLs', () => {
    const blob = new Blob(['test'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    manager.registerObjectUrl(url);
    const stats = manager.getMemoryStats();

    expect(stats.objectUrls).toBe(1);
  });

  it('should register and track blobs', () => {
    const blob = new Blob(['test'], { type: 'text/plain' });

    manager.registerBlob(blob);
    const stats = manager.getMemoryStats();

    expect(stats.blobs).toBe(1);
  });

  it('should register and track array buffers', () => {
    const buffer = new ArrayBuffer(1024);

    manager.registerArrayBuffer(buffer);
    const stats = manager.getMemoryStats();

    expect(stats.arrayBuffers).toBe(1);
  });

  it('should revoke specific object URL', () => {
    const blob = new Blob(['test'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    manager.registerObjectUrl(url);
    manager.revokeObjectUrl(url);

    const stats = manager.getMemoryStats();
    expect(stats.objectUrls).toBe(0);
  });

  it('should cleanup all resources', () => {
    const blob = new Blob(['test'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const buffer = new ArrayBuffer(1024);

    manager.registerObjectUrl(url);
    manager.registerBlob(blob);
    manager.registerArrayBuffer(buffer);

    manager.cleanup();
    const stats = manager.getMemoryStats();

    expect(stats.objectUrls).toBe(0);
    expect(stats.blobs).toBe(0);
    expect(stats.arrayBuffers).toBe(0);
  });

  it('should cleanup with delay', (done) => {
    const blob = new Blob(['test'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    manager.registerObjectUrl(url);
    manager.cleanupDelayed(100);

    // Check that cleanup hasn't happened immediately
    expect(manager.getMemoryStats().objectUrls).toBe(1);

    // Check after delay
    setTimeout(() => {
      expect(manager.getMemoryStats().objectUrls).toBe(0);
      done();
    }, 150);
  });
});

describe('Utility Functions', () => {
  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.00 GB');
    });
  });

  describe('getFileSizeLimit', () => {
    it('should return correct limits for different tiers', () => {
      const freeLimit = getFileSizeLimit(OperationType.PDF_MERGE, UserTier.FREE);
      const premiumLimit = getFileSizeLimit(OperationType.PDF_MERGE, UserTier.PREMIUM);
      const enterpriseLimit = getFileSizeLimit(OperationType.PDF_MERGE, UserTier.ENTERPRISE);

      expect(premiumLimit).toBeGreaterThan(freeLimit);
      expect(enterpriseLimit).toBeGreaterThan(premiumLimit);
    });
  });

  describe('getBatchLimits', () => {
    it('should return batch limits for user tier', () => {
      const limits = getBatchLimits(UserTier.FREE);

      expect(limits).toHaveProperty('maxFiles');
      expect(limits).toHaveProperty('maxTotalSize');
      expect(limits).toHaveProperty('maxConcurrent');
    });
  });

  describe('isFileSizeValid', () => {
    it('should validate file size correctly', () => {
      const validSize = 10 * 1024 * 1024; // 10MB
      const invalidSize = 60 * 1024 * 1024; // 60MB (exceeds free tier)

      expect(isFileSizeValid(validSize, OperationType.PDF_MERGE, UserTier.FREE)).toBe(true);
      expect(isFileSizeValid(invalidSize, OperationType.PDF_MERGE, UserTier.FREE)).toBe(false);
    });

    it('should reject zero-size files', () => {
      expect(isFileSizeValid(0, OperationType.PDF_MERGE, UserTier.FREE)).toBe(false);
    });
  });

  describe('getUpgradeSuggestion', () => {
    it('should suggest upgrade for free users', () => {
      const fileSize = 60 * 1024 * 1024; // 60MB
      const suggestion = getUpgradeSuggestion(
        fileSize,
        OperationType.PDF_MERGE,
        UserTier.FREE
      );

      expect(suggestion).toBeDefined();
      expect(suggestion).toContain('premium');
    });

    it('should return null for files within limits', () => {
      const fileSize = 10 * 1024 * 1024; // 10MB
      const suggestion = getUpgradeSuggestion(
        fileSize,
        OperationType.PDF_MERGE,
        UserTier.FREE
      );

      expect(suggestion).toBeNull();
    });

    it('should return null for enterprise users', () => {
      const fileSize = 100 * 1024 * 1024; // 100MB
      const suggestion = getUpgradeSuggestion(
        fileSize,
        OperationType.PDF_MERGE,
        UserTier.ENTERPRISE
      );

      expect(suggestion).toBeNull();
    });
  });
});

describe('Integration Tests', () => {
  it('should handle complete validation workflow', async () => {
    const validator = new FileSizeValidator(UserTier.FREE);
    const files = [
      createMockFile('file1.pdf', 5 * 1024 * 1024),
      createMockFile('file2.pdf', 5 * 1024 * 1024)
    ];

    // Validate batch
    const result = await validator.validateBatch(files, OperationType.PDF_MERGE);
    expect(result.valid).toBe(true);

    // Track progress
    const tracker = new ProgressTracker();
    tracker.start(files);

    for (const file of files) {
      tracker.setCurrentFile(file.name);
      tracker.completeFile(file.name);
    }

    const progress = tracker.getProgress();
    expect(progress.overallProgress).toBe(100);
    expect(progress.filesCompleted).toHaveLength(2);

    // Cleanup
    const manager = new MemoryCleanupManager();
    manager.cleanup();
  });

  it('should handle errors gracefully', async () => {
    const validator = new FileSizeValidator(UserTier.FREE);
    const largeFile = createMockFile('large.pdf', 100 * 1024 * 1024);

    const result = await validator.validateFile(largeFile, OperationType.PDF_MERGE);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});
