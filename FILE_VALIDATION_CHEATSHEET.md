# File Validation System - Quick Reference Card

## Import Statement

```typescript
import {
  fileSizeValidator,
  progressTracker,
  memoryCleanupManager,
  browserCapabilityDetector,
  OperationType,
  UserTier,
  formatFileSize,
  getFileSizeLimit,
  getBatchLimits,
  isFileSizeValid,
  getUpgradeSuggestion
} from './utils/fileValidation';
```

## 5 Essential Patterns

### 1. Validate Single File
```typescript
const result = await fileSizeValidator.validateFile(file, OperationType.PDF_TO_IMAGE);
if (!result.valid) {
  alert(result.error);
  return;
}
// Process file
```

### 2. Validate Batch
```typescript
const result = await fileSizeValidator.validateBatch(files, OperationType.IMAGE_TO_PDF);
if (!result.valid) {
  console.error(result.errors);
  return;
}
// Process files
```

### 3. Track Progress
```typescript
progressTracker.start(files);
for (const file of files) {
  progressTracker.setCurrentFile(file.name);
  await processFile(file);
  progressTracker.completeFile(file.name);
  const p = progressTracker.getProgress();
  updateUI(p.overallProgress);
}
progressTracker.reset();
```

### 4. Clean Memory
```typescript
try {
  const url = URL.createObjectURL(blob);
  memoryCleanupManager.registerObjectUrl(url);
  await useResource(url);
} finally {
  memoryCleanupManager.cleanup();
}
```

### 5. Set User Tier
```typescript
fileSizeValidator.setUserTier(UserTier.PREMIUM);
```

## Size Limits Quick Reference

| Tier | Images | PDFs | Documents | Batch Files | Batch Size |
|------|--------|------|-----------|-------------|------------|
| Free | 10MB | 50MB | 25MB | 20 | 100MB |
| Premium | 100MB | 200MB | 100MB | 100 | 500MB |
| Enterprise | 500MB | 1GB | 500MB | 500 | 5GB |

## Operation Types

```typescript
OperationType.IMAGE_TO_PDF     // Images → PDF
OperationType.PDF_TO_IMAGE     // PDF → Images
OperationType.PDF_MERGE        // Merge PDFs
OperationType.PDF_SPLIT        // Split PDF
OperationType.PDF_COMPRESS     // Compress PDF
OperationType.PDF_ROTATE       // Rotate PDF
OperationType.PDF_TO_WORD      // PDF → Word
OperationType.WORD_TO_PDF      // Word → PDF
OperationType.IMAGE_COMPRESS   // Compress Image
OperationType.OCR              // OCR Processing
OperationType.UPLOAD           // Generic Upload
OperationType.PREVIEW          // Preview Generation
```

## User Tiers

```typescript
UserTier.FREE
UserTier.PREMIUM
UserTier.ENTERPRISE
```

## React Component Example

```typescript
function FileUploader() {
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const handleFiles = async (files: File[]) => {
    // Validate
    const result = await fileSizeValidator.validateBatch(
      files,
      OperationType.PDF_MERGE
    );

    if (!result.valid) {
      setError(result.errors.join('\n'));
      return;
    }

    // Process with progress
    progressTracker.start(files);
    for (const file of files) {
      await processFile(file);
      const p = progressTracker.getProgress();
      setProgress(p.overallProgress);
    }

    // Cleanup
    memoryCleanupManager.cleanup();
  };

  return (
    <>
      <input type="file" multiple onChange={e => handleFiles(Array.from(e.target.files))} />
      {error && <div className="error">{error}</div>}
      {progress > 0 && <progress value={progress} max={100} />}
    </>
  );
}
```

## Utility Functions

```typescript
// Format bytes
formatFileSize(1024 * 1024)  // "1.0 MB"

// Get limit
getFileSizeLimit(OperationType.PDF_MERGE, UserTier.FREE)  // 52428800

// Check valid
isFileSizeValid(fileSize, OperationType.PDF_MERGE, UserTier.FREE)  // true/false

// Upgrade suggestion
getUpgradeSuggestion(fileSize, operationType, UserTier.FREE)  // "Upgrade to..."

// Get batch limits
getBatchLimits(UserTier.PREMIUM)  // { maxFiles: 100, maxTotalSize: ..., maxConcurrent: 5 }
```

## Browser Capabilities

```typescript
const caps = browserCapabilityDetector.getCapabilities();
console.log(caps.deviceType);        // 'mobile' | 'tablet' | 'desktop'
console.log(caps.availableMemory);   // Available memory in bytes
console.log(caps.maxConcurrent);     // Max concurrent operations

const canHandle = browserCapabilityDetector.canHandle(
  OperationType.PDF_TO_WORD,
  50 * 1024 * 1024
);
if (!canHandle.canHandle) {
  alert(canHandle.reason);
}
```

## Progress Tracking

```typescript
// Start
progressTracker.start(files);

// Update current file
progressTracker.setCurrentFile(fileName);

// Update progress
progressTracker.updateFileProgress(bytesProcessed, totalBytes);

// Complete file
progressTracker.completeFile(fileName);

// Get progress
const p = progressTracker.getProgress();
console.log(p.overallProgress);           // 0-100
console.log(p.currentFileProgress);       // 0-100
console.log(p.estimatedTimeRemaining);    // milliseconds
console.log(p.filesCompleted);            // string[]

// Formatted string
progressTracker.getFormattedProgress();   // "Processing 3 of 10 files..."

// Reset
progressTracker.reset();
```

## Memory Management

```typescript
// Register resources
memoryCleanupManager.registerObjectUrl(url);
memoryCleanupManager.registerBlob(blob);
memoryCleanupManager.registerArrayBuffer(buffer);

// Revoke specific URL
memoryCleanupManager.revokeObjectUrl(url);

// Cleanup all
memoryCleanupManager.cleanup();

// Cleanup after delay
memoryCleanupManager.cleanupDelayed(5000);  // 5 seconds

// Get stats
const stats = memoryCleanupManager.getMemoryStats();
console.log(stats.objectUrls);     // number
console.log(stats.blobs);          // number
console.log(stats.arrayBuffers);   // number
```

## Error Handling

```typescript
try {
  const result = await fileSizeValidator.validateFile(file, operationType);

  if (!result.valid) {
    if (result.error?.includes('too large')) {
      // Show upgrade prompt
      const suggestion = getUpgradeSuggestion(file.size, operationType, userTier);
      showUpgradeModal(suggestion);
    } else if (result.error?.includes('Insufficient memory')) {
      // Memory warning
      showWarning('Please close some tabs and try again.');
    } else {
      // Generic error
      showError(result.error);
    }
    return;
  }

  if (result.warning) {
    showWarning(result.warning);
  }

  await processFile(file);
} catch (error) {
  console.error('Unexpected error:', error);
  showError('An unexpected error occurred.');
}
```

## Validation Result Types

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

## Common Workflows

### File Upload with Validation
```typescript
async function handleFileUpload(files: File[]) {
  // 1. Validate
  const validation = await fileSizeValidator.validateBatch(files, operationType);
  if (!validation.valid) {
    showErrors(validation.errors);
    return;
  }

  // 2. Check warnings
  if (validation.warnings.length > 0) {
    showWarnings(validation.warnings);
  }

  // 3. Process
  await processFiles(files);
}
```

### Progress with Cleanup
```typescript
async function processWithProgress(files: File[]) {
  progressTracker.start(files);

  try {
    for (const file of files) {
      progressTracker.setCurrentFile(file.name);
      await processFile(file);
      progressTracker.completeFile(file.name);
      updateUI(progressTracker.getProgress());
    }
  } finally {
    progressTracker.reset();
    memoryCleanupManager.cleanup();
  }
}
```

### Tier-Based Features
```typescript
function showFeatures(userTier: UserTier) {
  const limits = getBatchLimits(userTier);
  return {
    maxFiles: limits.maxFiles,
    maxSize: formatFileSize(limits.maxTotalSize),
    concurrent: limits.maxConcurrent
  };
}
```

## Testing Commands

```bash
# Run tests
npm test fileValidation

# Run with coverage
npm test fileValidation -- --coverage

# Run in watch mode
npm test fileValidation -- --watch
```

## Performance Tips

1. **Use Batch Validation**: `validateBatch()` instead of multiple `validateFile()`
2. **Use Singletons**: Import pre-created instances
3. **Clean Up Regularly**: After each batch, not at the end
4. **Check Capabilities First**: Avoid starting operations that will fail

## Memory Multipliers

| Operation | Multiplier | Example (10MB file) |
|-----------|------------|---------------------|
| IMAGE_TO_PDF | 3x | 30MB |
| PDF_TO_IMAGE | 4x | 40MB |
| IMAGE_COMPRESS | 2.5x | 25MB |
| PDF_MERGE | 2x | 20MB |
| PDF_SPLIT | 1.5x | 15MB |
| PDF_COMPRESS | 2x | 20MB |
| PDF_ROTATE | 1.2x | 12MB |
| PDF_TO_WORD | 5x | 50MB |
| WORD_TO_PDF | 3x | 30MB |
| OCR | 6x | 60MB |

## Documentation Files

| File | Purpose |
|------|---------|
| `FILE_VALIDATION_SUMMARY.md` | Complete overview |
| `FILE_VALIDATION_README.md` | Full documentation |
| `FILE_VALIDATION_QUICKSTART.md` | Quick start guide |
| `FILE_VALIDATION_ARCHITECTURE.md` | Architecture diagrams |
| `FILE_VALIDATION_CHEATSHEET.md` | This file |
| `fileValidation.example.ts` | Code examples |
| `fileValidation.test.ts` | Test suite |

## Support

**Need Help?**
1. Check quick start guide
2. Review examples
3. Read full documentation
4. Check test cases
5. Review browser console

**Files:**
- Implementation: `utils/fileValidation.ts`
- Examples: `utils/fileValidation.example.ts`
- Tests: `tests/unit/utils/fileValidation.test.ts`

---

**Print this page for quick reference while coding!**
