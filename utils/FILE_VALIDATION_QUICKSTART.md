# File Validation System - Quick Start Guide

## 30-Second Overview

Production-ready file validation system for millions of users with:
- Multi-tier size limits (Free/Premium/Enterprise)
- Memory-aware batch processing
- Real-time progress tracking
- Browser capability detection
- Automatic memory cleanup

## Installation

```typescript
import {
  fileSizeValidator,    // Main validator (singleton)
  progressTracker,      // Progress tracking (singleton)
  memoryCleanupManager, // Memory cleanup (singleton)
  OperationType,        // Operation types enum
  UserTier              // User tier enum
} from './utils/fileValidation';
```

## 5 Most Common Use Cases

### 1. Validate a Single File

```typescript
const result = await fileSizeValidator.validateFile(
  file,
  OperationType.PDF_TO_IMAGE
);

if (result.valid) {
  // Process file
  await processFile(file);
} else {
  // Show error
  alert(result.error);
}
```

### 2. Validate Multiple Files

```typescript
const result = await fileSizeValidator.validateBatch(
  files,
  OperationType.IMAGE_TO_PDF
);

if (result.valid) {
  console.log(`Ready to process ${result.summary.totalFiles} files`);
  console.log(`Estimated time: ${result.summary.estimatedTime / 1000}s`);
} else {
  alert(result.errors.join('\n'));
}
```

### 3. Track Progress

```typescript
// Start tracking
progressTracker.start(files);

// In your processing loop
for (const file of files) {
  progressTracker.setCurrentFile(file.name);

  // Update progress during processing
  progressTracker.updateFileProgress(bytesProcessed, totalBytes);

  progressTracker.completeFile(file.name);
}

// Get progress info
const progress = progressTracker.getProgress();
console.log(`${progress.overallProgress.toFixed(1)}% complete`);
```

### 4. Clean Up Memory

```typescript
try {
  // Create resources
  const url = URL.createObjectURL(blob);
  memoryCleanupManager.registerObjectUrl(url);

  // Use resources
  await processFile(url);
} finally {
  // Always cleanup
  memoryCleanupManager.cleanup();
}
```

### 5. Set User Tier

```typescript
import { UserTier } from './utils/fileValidation';

// When user logs in or upgrades
fileSizeValidator.setUserTier(UserTier.PREMIUM);

// Now validation uses premium limits
```

## Operation Types

| Operation | Description | Free Limit | Premium Limit |
|-----------|-------------|------------|---------------|
| `PDF_MERGE` | Merge PDFs | 50MB | 200MB |
| `PDF_SPLIT` | Split PDF | 50MB | 200MB |
| `IMAGE_TO_PDF` | Images to PDF | 10MB | 100MB |
| `PDF_TO_IMAGE` | PDF to images | 50MB | 200MB |
| `PDF_COMPRESS` | Compress PDF | 50MB | 200MB |
| `PDF_TO_WORD` | PDF to Word | 25MB | 100MB |
| `WORD_TO_PDF` | Word to PDF | 25MB | 100MB |

## React Component Example

```typescript
function FileUploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    // Validate
    const result = await fileSizeValidator.validateBatch(
      selectedFiles,
      OperationType.PDF_MERGE
    );

    if (!result.valid) {
      setError(result.errors.join('\n'));
      return;
    }

    // Process with progress
    progressTracker.start(selectedFiles);

    for (const file of selectedFiles) {
      await processFile(file);
      const p = progressTracker.getProgress();
      setProgress(p.overallProgress);
    }

    // Cleanup
    memoryCleanupManager.cleanup();
  };

  return (
    <div>
      <input type="file" multiple onChange={handleUpload} />
      {error && <div className="error">{error}</div>}
      {progress > 0 && <progress value={progress} max={100} />}
    </div>
  );
}
```

## Utility Functions

```typescript
import {
  formatFileSize,
  getFileSizeLimit,
  getBatchLimits,
  isFileSizeValid,
  getUpgradeSuggestion
} from './utils/fileValidation';

// Format file size
formatFileSize(1024 * 1024); // "1.0 MB"

// Get size limit
const limit = getFileSizeLimit(OperationType.PDF_MERGE, UserTier.FREE); // 52428800

// Check if size is valid
isFileSizeValid(fileSize, OperationType.PDF_MERGE, UserTier.FREE); // true/false

// Get upgrade suggestion
const suggestion = getUpgradeSuggestion(fileSize, operationType, UserTier.FREE);
if (suggestion) {
  showUpgradeModal(suggestion);
}
```

## Browser Capability Detection

```typescript
import { browserCapabilityDetector } from './utils/fileValidation';

// Get capabilities
const caps = browserCapabilityDetector.getCapabilities();

console.log(caps.deviceType);           // 'mobile' | 'tablet' | 'desktop'
console.log(caps.availableMemory);      // Available memory in bytes
console.log(caps.maxConcurrent);        // Max files to process at once

// Check if operation is feasible
const canHandle = browserCapabilityDetector.canHandle(
  OperationType.PDF_TO_WORD,
  50 * 1024 * 1024 // 50MB
);

if (!canHandle.canHandle) {
  alert(canHandle.reason);
}
```

## Common Patterns

### Pattern 1: Validate → Process → Cleanup

```typescript
async function handleFiles(files: File[]) {
  // 1. Validate
  const validation = await fileSizeValidator.validateBatch(
    files,
    OperationType.PDF_MERGE
  );

  if (!validation.valid) {
    showErrors(validation.errors);
    return;
  }

  // 2. Process
  try {
    for (const file of files) {
      await processFile(file);
    }
  } finally {
    // 3. Cleanup
    memoryCleanupManager.cleanup();
  }
}
```

### Pattern 2: Progress with UI Updates

```typescript
async function processWithProgress(files: File[]) {
  progressTracker.start(files);
  setShowProgress(true);

  for (const file of files) {
    progressTracker.setCurrentFile(file.name);

    await processFile(file, (done, total) => {
      progressTracker.updateFileProgress(done, total);
      const p = progressTracker.getProgress();
      updateUI(p);
    });

    progressTracker.completeFile(file.name);
  }

  setShowProgress(false);
  progressTracker.reset();
}
```

### Pattern 3: User Tier-Based Features

```typescript
function getFeatures(userTier: UserTier) {
  const limits = getBatchLimits(userTier);

  return {
    maxFiles: limits.maxFiles,
    maxTotalSize: formatFileSize(limits.maxTotalSize),
    canUseBatchProcessing: userTier !== UserTier.FREE,
    canUseOCR: userTier === UserTier.ENTERPRISE
  };
}
```

## Error Handling

```typescript
try {
  const result = await fileSizeValidator.validateFile(file, operationType);

  if (!result.valid) {
    // Handle validation error
    if (result.error?.includes('too large')) {
      const suggestion = getUpgradeSuggestion(file.size, operationType, userTier);
      if (suggestion) {
        showUpgradePrompt(suggestion);
      }
    } else if (result.error?.includes('Insufficient memory')) {
      showWarning('Please close some browser tabs and try again.');
    } else {
      showError(result.error);
    }
    return;
  }

  // Show warnings
  if (result.warning) {
    showWarning(result.warning);
  }

  // Process file
  await processFile(file);

} catch (error) {
  console.error('Unexpected error:', error);
  showError('An unexpected error occurred. Please try again.');
}
```

## Testing Your Implementation

```typescript
// Test validation
const testFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
const result = await fileSizeValidator.validateFile(
  testFile,
  OperationType.PDF_MERGE
);
console.assert(result.valid === true, 'Validation should pass');

// Test progress tracking
progressTracker.start([testFile]);
progressTracker.completeFile('test.pdf');
const progress = progressTracker.getProgress();
console.assert(progress.overallProgress === 100, 'Progress should be 100%');

// Test memory cleanup
const url = URL.createObjectURL(new Blob(['test']));
memoryCleanupManager.registerObjectUrl(url);
memoryCleanupManager.cleanup();
const stats = memoryCleanupManager.getMemoryStats();
console.assert(stats.objectUrls === 0, 'URLs should be cleaned up');
```

## Performance Tips

1. **Batch Validation**: Validate multiple files at once instead of one by one
   ```typescript
   // Good
   validateBatch(files, operationType);

   // Slower
   for (const file of files) {
     await validateFile(file, operationType);
   }
   ```

2. **Use Singleton Instances**: Import the pre-created singletons
   ```typescript
   // Good
   import { fileSizeValidator } from './utils/fileValidation';

   // Less optimal
   const validator = new FileSizeValidator();
   ```

3. **Clean Up Regularly**: Clean up after each batch, not at the end
   ```typescript
   for (const batch of batches) {
     await processBatch(batch);
     memoryCleanupManager.cleanup(); // Clean after each batch
   }
   ```

4. **Check Capabilities First**: Avoid starting operations that will fail
   ```typescript
   const canHandle = browserCapabilityDetector.canHandle(op, totalSize);
   if (!canHandle.canHandle) {
     return; // Don't even try
   }
   ```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Validation is slow | Use `validateBatch()` instead of multiple `validateFile()` calls |
| Memory warnings | Reduce batch size or process files sequentially |
| Progress not updating | Call `updateFileProgress()` more frequently |
| Resources not cleaned up | Always use try-finally with `memoryCleanupManager.cleanup()` |

## Next Steps

- Read the full documentation: `FILE_VALIDATION_README.md`
- Check out examples: `fileValidation.example.ts`
- Run tests: `npm test fileValidation`
- Review the source: `fileValidation.ts`

## Quick Reference

```typescript
// Validation
fileSizeValidator.validateFile(file, OperationType.PDF_MERGE)
fileSizeValidator.validateBatch(files, OperationType.IMAGE_TO_PDF)
fileSizeValidator.setUserTier(UserTier.PREMIUM)

// Progress
progressTracker.start(files)
progressTracker.updateFileProgress(bytesProcessed, totalBytes)
progressTracker.completeFile(fileName)
progressTracker.getProgress()
progressTracker.reset()

// Memory
memoryCleanupManager.registerObjectUrl(url)
memoryCleanupManager.registerBlob(blob)
memoryCleanupManager.cleanup()

// Browser
browserCapabilityDetector.getCapabilities()
browserCapabilityDetector.canHandle(operationType, totalSize)

// Utilities
formatFileSize(bytes)
getFileSizeLimit(operationType, userTier)
getBatchLimits(userTier)
isFileSizeValid(fileSize, operationType, userTier)
getUpgradeSuggestion(fileSize, operationType, currentTier)
```

---

**Need help?** Check the examples or full documentation!
