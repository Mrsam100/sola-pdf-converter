# File Validation System Documentation

## Overview

Production-level file size validation and warning system optimized for millions of concurrent users. This system provides comprehensive file validation, memory management, progress tracking, and browser capability detection.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Performance Optimization](#performance-optimization)
- [Testing](#testing)
- [Best Practices](#best-practices)

## Features

### Core Features

1. **Multi-Tier File Size Validation**
   - Free, Premium, and Enterprise tier support
   - Operation-specific size limits
   - Batch validation with total size limits

2. **Memory-Aware Processing**
   - Automatic memory estimation
   - Browser capability detection
   - Memory usage monitoring and warnings

3. **Intelligent Progress Tracking**
   - Real-time progress updates
   - Time remaining estimates
   - File-by-file tracking

4. **Browser Capability Detection**
   - Device type detection (mobile/tablet/desktop)
   - Available memory detection
   - Feature support detection (Web Workers, WebAssembly, OffscreenCanvas)

5. **Malicious File Detection**
   - Magic byte signature scanning
   - File type validation
   - Security threat warnings

6. **Memory Cleanup Utilities**
   - Automatic resource cleanup
   - Object URL management
   - Memory leak prevention

## Installation

The file validation system is already integrated into your project. Import it like this:

```typescript
import {
  FileSizeValidator,
  ProgressTracker,
  MemoryCleanupManager,
  BrowserCapabilityDetector,
  UserTier,
  OperationType,
  formatFileSize,
  fileSizeValidator, // Singleton instance
  progressTracker, // Singleton instance
  memoryCleanupManager // Singleton instance
} from './utils/fileValidation';
```

## Quick Start

### Basic File Validation

```typescript
import { fileSizeValidator, OperationType } from './utils/fileValidation';

// Validate a single file
async function validateFile(file: File) {
  const result = await fileSizeValidator.validateFile(
    file,
    OperationType.PDF_TO_IMAGE
  );

  if (result.valid) {
    console.log('File is valid!');
    if (result.warning) {
      console.warn(result.warning);
    }
  } else {
    console.error(result.error);
  }
}
```

### Batch Validation

```typescript
// Validate multiple files
async function validateBatch(files: File[]) {
  const result = await fileSizeValidator.validateBatch(
    files,
    OperationType.IMAGE_TO_PDF
  );

  if (!result.valid) {
    result.errors.forEach(error => console.error(error));
    return;
  }

  // Process files
  console.log(`Ready to process ${result.summary.totalFiles} files`);
  console.log(`Estimated time: ${result.summary.estimatedTime / 1000}s`);
}
```

## API Reference

### FileSizeValidator

Main class for file validation.

#### Constructor

```typescript
new FileSizeValidator(userTier?: UserTier)
```

#### Methods

##### `validateFile(file: File, operationType: OperationType): Promise<ValidationResult>`

Validates a single file against size limits and security checks.

**Parameters:**
- `file`: The file to validate
- `operationType`: Type of operation (PDF_MERGE, IMAGE_TO_PDF, etc.)

**Returns:** Promise<ValidationResult>
```typescript
interface ValidationResult {
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
```

##### `validateBatch(files: File[], operationType: OperationType): Promise<BatchValidationResult>`

Validates multiple files as a batch.

**Parameters:**
- `files`: Array of files to validate
- `operationType`: Type of operation

**Returns:** Promise<BatchValidationResult>
```typescript
interface BatchValidationResult {
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
```

##### `setUserTier(tier: UserTier): void`

Updates the user tier for validation limits.

##### `getWarningMessage(fileSize: number, operationType: OperationType): string | null`

Gets a user-friendly warning message for the file size.

### ProgressTracker

Tracks progress of file processing operations.

#### Methods

##### `start(files: File[]): void`

Initializes progress tracking for a batch of files.

##### `updateFileProgress(bytesProcessed: number, totalBytes: number): void`

Updates progress for the current file.

##### `completeFile(fileName: string): void`

Marks the current file as complete and moves to the next.

##### `setCurrentFile(fileName: string): void`

Sets the name of the file currently being processed.

##### `getProgress(): ProgressEstimation`

Returns current progress information.

```typescript
interface ProgressEstimation {
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
```

##### `getFormattedProgress(): string`

Returns a formatted progress string for display.

##### `reset(): void`

Resets all progress tracking.

### BrowserCapabilityDetector

Detects browser capabilities and system resources.

#### Methods

##### `getCapabilities(): BrowserCapability`

Returns current browser capabilities with intelligent caching.

```typescript
interface BrowserCapability {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  availableMemory: number;
  totalMemory: number;
  memoryUsagePercent: number;
  maxConcurrent: number;
  supportsWorkers: boolean;
  supportsWasm: boolean;
  supportsOffscreenCanvas: boolean;
}
```

##### `canHandle(operationType: OperationType, totalSize: number): { canHandle: boolean; reason?: string }`

Checks if the browser can handle a specific operation.

### MemoryCleanupManager

Manages memory cleanup and prevents memory leaks.

#### Methods

##### `registerObjectUrl(url: string): void`

Registers an object URL for cleanup.

##### `registerBlob(blob: Blob): void`

Registers a Blob for tracking.

##### `registerArrayBuffer(buffer: ArrayBuffer): void`

Registers an ArrayBuffer for tracking.

##### `revokeObjectUrl(url: string): void`

Revokes a specific object URL.

##### `cleanup(): void`

Cleans up all registered resources.

##### `cleanupDelayed(delayMs: number): void`

Schedules cleanup after a delay.

##### `getMemoryStats(): { objectUrls: number; arrayBuffers: number; blobs: number }`

Returns memory management statistics.

### Utility Functions

#### `formatFileSize(bytes: number): string`

Formats bytes to human-readable string (B, KB, MB, GB).

#### `getFileSizeLimit(operationType: OperationType, userTier?: UserTier): number`

Returns the file size limit for an operation and user tier.

#### `getBatchLimits(userTier?: UserTier)`

Returns batch processing limits for a user tier.

#### `isFileSizeValid(fileSize: number, operationType: OperationType, userTier?: UserTier): boolean`

Checks if a file size is valid for the operation.

#### `getUpgradeSuggestion(fileSize: number, operationType: OperationType, currentTier: UserTier): string | null`

Returns an upgrade suggestion message if applicable.

## Usage Examples

### Example 1: React Component with Validation

```typescript
import React, { useState } from 'react';
import { fileSizeValidator, OperationType } from './utils/fileValidation';

function FileUploader() {
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    const result = await fileSizeValidator.validateBatch(
      files,
      OperationType.IMAGE_TO_PDF
    );

    if (!result.valid) {
      setError(result.errors.join('\n'));
      event.target.value = ''; // Clear input
      return;
    }

    if (result.warnings.length > 0) {
      setWarning(result.warnings.join('\n'));
    }

    // Proceed with processing
    processFiles(files);
  };

  return (
    <div>
      <input type="file" multiple onChange={handleFileChange} />
      {error && <div className="error">{error}</div>}
      {warning && <div className="warning">{warning}</div>}
    </div>
  );
}
```

### Example 2: Progress Tracking

```typescript
import { progressTracker } from './utils/fileValidation';

async function processFilesWithProgress(files: File[]) {
  progressTracker.start(files);

  for (const file of files) {
    progressTracker.setCurrentFile(file.name);

    // Process file with progress updates
    await processFile(file, (bytesProcessed, totalBytes) => {
      progressTracker.updateFileProgress(bytesProcessed, totalBytes);

      // Update UI
      const progress = progressTracker.getProgress();
      updateProgressBar(progress.overallProgress);
      updateStatusText(progressTracker.getFormattedProgress());
    });

    progressTracker.completeFile(file.name);
  }

  progressTracker.reset();
}
```

### Example 3: Memory Management

```typescript
import { memoryCleanupManager } from './utils/fileValidation';

async function processWithCleanup(files: File[]) {
  const objectUrls: string[] = [];

  try {
    for (const file of files) {
      const url = URL.createObjectURL(file);
      memoryCleanupManager.registerObjectUrl(url);
      objectUrls.push(url);

      // Use the URL
      await processFileUrl(url);
    }
  } finally {
    // Cleanup all resources
    memoryCleanupManager.cleanup();
  }
}
```

### Example 4: User Tier Management

```typescript
import { FileSizeValidator, UserTier, OperationType } from './utils/fileValidation';

function setupValidator(userSubscription: 'free' | 'premium' | 'enterprise') {
  const tierMap = {
    free: UserTier.FREE,
    premium: UserTier.PREMIUM,
    enterprise: UserTier.ENTERPRISE
  };

  const validator = new FileSizeValidator(tierMap[userSubscription]);
  return validator;
}

// Use in component
const validator = setupValidator(user.subscription);
const result = await validator.validateFile(file, OperationType.PDF_MERGE);
```

### Example 5: Browser Capability Check

```typescript
import { browserCapabilityDetector, OperationType } from './utils/fileValidation';

function checkCompatibility() {
  const capabilities = browserCapabilityDetector.getCapabilities();

  console.log('Device:', capabilities.deviceType);
  console.log('Available Memory:', formatFileSize(capabilities.availableMemory));
  console.log('Supports Workers:', capabilities.supportsWorkers);

  // Check if a specific operation is feasible
  const canHandle = browserCapabilityDetector.canHandle(
    OperationType.PDF_TO_WORD,
    50 * 1024 * 1024 // 50MB
  );

  if (!canHandle.canHandle) {
    showWarning(canHandle.reason);
  }
}
```

### Example 6: Upgrade Prompts

```typescript
import { getUpgradeSuggestion, UserTier, OperationType } from './utils/fileValidation';

function showUpgradePromptIfNeeded(file: File, userTier: UserTier) {
  const suggestion = getUpgradeSuggestion(
    file.size,
    OperationType.PDF_MERGE,
    userTier
  );

  if (suggestion) {
    showUpgradeModal({
      message: suggestion,
      currentTier: userTier,
      fileSize: formatFileSize(file.size)
    });
  }
}
```

## Performance Optimization

### 1. Batch Processing Optimization

```typescript
import { browserCapabilityDetector } from './utils/fileValidation';

async function optimizedBatchProcessing(files: File[]) {
  const capabilities = browserCapabilityDetector.getCapabilities();
  const batchSize = capabilities.maxConcurrent;

  // Process in optimal batches
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);

    // Process batch concurrently
    await Promise.all(
      batch.map(file => processFile(file))
    );

    // Cleanup after each batch
    memoryCleanupManager.cleanup();
  }
}
```

### 2. Memory-Aware Processing

```typescript
function shouldProcessFile(file: File, operationType: OperationType): boolean {
  const canHandle = browserCapabilityDetector.canHandle(operationType, file.size);

  if (!canHandle.canHandle) {
    console.warn('Skipping file due to memory constraints:', file.name);
    return false;
  }

  return true;
}
```

### 3. Streaming for Large Files

```typescript
async function processLargeFile(file: File) {
  const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  const chunks = Math.ceil(file.size / CHUNK_SIZE);

  for (let i = 0; i < chunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    await processChunk(chunk);

    // Update progress
    progressTracker.updateFileProgress(end, file.size);
  }
}
```

## File Size Limits

### Free Tier
- Images: 10MB per file
- PDFs: 50MB per file
- Documents: 25MB per file
- Batch: Max 20 files, 100MB total

### Premium Tier
- Images: 100MB per file
- PDFs: 200MB per file
- Documents: 100MB per file
- Batch: Max 100 files, 500MB total

### Enterprise Tier
- Images: 500MB per file
- PDFs: 1GB per file
- Documents: 500MB per file
- Batch: Max 500 files, 5GB total

## Operation Types

- `IMAGE_TO_PDF` - Convert images to PDF
- `PDF_TO_IMAGE` - Convert PDF pages to images
- `IMAGE_COMPRESS` - Compress images
- `PDF_MERGE` - Merge multiple PDFs
- `PDF_SPLIT` - Split PDF into pages
- `PDF_COMPRESS` - Compress PDF file
- `PDF_ROTATE` - Rotate PDF pages
- `PDF_TO_WORD` - Convert PDF to Word document
- `WORD_TO_PDF` - Convert Word to PDF
- `OCR` - Optical Character Recognition
- `UPLOAD` - Generic file upload
- `PREVIEW` - Generate file preview

## Testing

Run the test suite:

```bash
npm test fileValidation
```

Or with coverage:

```bash
npm test fileValidation -- --coverage
```

## Best Practices

### 1. Always Validate Before Processing

```typescript
// Good
const result = await fileSizeValidator.validateFile(file, operationType);
if (result.valid) {
  await processFile(file);
}

// Bad
await processFile(file); // No validation
```

### 2. Handle Warnings Appropriately

```typescript
// Show warnings to users
if (result.warning) {
  showToast(result.warning, 'warning');
}
```

### 3. Always Clean Up Resources

```typescript
// Use try-finally to ensure cleanup
try {
  await processFiles(files);
} finally {
  memoryCleanupManager.cleanup();
}
```

### 4. Track Progress for Long Operations

```typescript
// For operations taking > 2 seconds
if (estimatedTime > 2000) {
  progressTracker.start(files);
  // Show progress UI
}
```

### 5. Check Browser Capabilities Early

```typescript
// Check before starting heavy operations
const canHandle = browserCapabilityDetector.canHandle(operationType, totalSize);
if (!canHandle.canHandle) {
  showError(canHandle.reason);
  return;
}
```

### 6. Use Singleton Instances

```typescript
// Good - Use singleton
import { fileSizeValidator } from './utils/fileValidation';

// Less optimal - Create new instance
import { FileSizeValidator } from './utils/fileValidation';
const validator = new FileSizeValidator();
```

### 7. Provide Upgrade Suggestions

```typescript
// Show upgrade options when appropriate
const suggestion = getUpgradeSuggestion(fileSize, operationType, userTier);
if (suggestion) {
  showUpgradePrompt(suggestion);
}
```

## Error Handling

### Common Errors and Solutions

#### "File too large"
```typescript
if (result.error?.includes('too large')) {
  const suggestion = getUpgradeSuggestion(file.size, operationType, userTier);
  if (suggestion) {
    showUpgradeModal(suggestion);
  }
}
```

#### "Insufficient memory"
```typescript
if (result.error?.includes('Insufficient memory')) {
  showMessage('Please close some browser tabs and try again.');
}
```

#### "Too many files"
```typescript
if (result.error?.includes('Too many files')) {
  const limits = getBatchLimits(userTier);
  showMessage(`Please select at most ${limits.maxFiles} files.`);
}
```

## Performance Metrics

The system automatically tracks performance metrics:

- File validation time
- Batch validation time
- Memory usage
- Processing time estimates

Access metrics through the monitoring system:

```typescript
import { performanceMonitor } from './utils/monitoring';

const metrics = performanceMonitor.getMetrics('file_validation');
console.log('Average validation time:', metrics.avg, 'ms');
```

## Security Features

1. **Magic Byte Scanning** - Detects executables and malicious files
2. **File Type Validation** - Ensures files match expected types
3. **Size Limit Enforcement** - Prevents DoS through large files
4. **Memory Limit Protection** - Prevents browser crashes
5. **Input Sanitization** - Prevents path traversal attacks

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

### Feature Detection

The system automatically detects and adapts to browser capabilities:
- Fallback for browsers without Performance Memory API
- Device-appropriate concurrent operation limits
- Progressive enhancement for modern features

## Migration Guide

If you're upgrading from the old validation system:

### Before
```typescript
import { validateFileSize } from './utils/inputValidation';

if (file.size > MAX_FILE_SIZE) {
  showError('File too large');
}
```

### After
```typescript
import { fileSizeValidator, OperationType } from './utils/fileValidation';

const result = await fileSizeValidator.validateFile(file, OperationType.PDF_MERGE);
if (!result.valid) {
  showError(result.error);
}
```

## Troubleshooting

### Issue: Validation is slow
**Solution:** Use batch validation instead of validating files individually.

### Issue: Memory warnings on mobile
**Solution:** Reduce batch sizes or process files sequentially on mobile devices.

### Issue: Progress tracking not updating
**Solution:** Ensure you call `updateFileProgress()` and `updateBytesProcessed()` regularly.

### Issue: Object URLs not being cleaned up
**Solution:** Always call `memoryCleanupManager.cleanup()` in a finally block.

## Support

For issues or questions:
1. Check the examples in `fileValidation.example.ts`
2. Review the test suite in `fileValidation.test.ts`
3. Check browser console for validation logs
4. Review performance metrics in monitoring system

## License

Apache-2.0

---

**Last Updated:** 2026-02-05
**Version:** 1.0.0
