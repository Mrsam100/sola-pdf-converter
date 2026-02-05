/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Example Usage of File Validation System
 *
 * This file demonstrates how to use the production-level file validation
 * system in various scenarios.
 */

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
  getUpgradeSuggestion,
  fileSizeValidator,
  progressTracker,
  memoryCleanupManager,
  browserCapabilityDetector
} from './fileValidation';

// ============================================
// EXAMPLE 1: Single File Validation
// ============================================

async function validateSingleFile(file: File) {
  console.log('=== Single File Validation ===');

  // Use the singleton instance
  const result = await fileSizeValidator.validateFile(
    file,
    OperationType.PDF_TO_IMAGE
  );

  if (result.valid) {
    console.log('✓ File is valid!');
    if (result.warning) {
      console.warn('⚠ Warning:', result.warning);
    }
    if (result.details) {
      console.log('Details:', {
        size: formatFileSize(result.details.fileSize),
        limit: formatFileSize(result.details.limit),
        estimatedMemory: formatFileSize(result.details.estimatedMemory || 0),
        estimatedTime: `${(result.details.processingTime || 0) / 1000}s`
      });
    }
  } else {
    console.error('✗ Validation failed:', result.error);
  }

  return result;
}

// ============================================
// EXAMPLE 2: Batch File Validation
// ============================================

async function validateBatchFiles(files: File[]) {
  console.log('=== Batch File Validation ===');

  const result = await fileSizeValidator.validateBatch(
    files,
    OperationType.IMAGE_TO_PDF
  );

  console.log('Batch Summary:', {
    canProcess: result.valid,
    totalFiles: result.summary.totalFiles,
    totalSize: formatFileSize(result.summary.totalSize),
    estimatedMemory: formatFileSize(result.summary.estimatedMemory),
    estimatedTime: `${result.summary.estimatedTime / 1000}s`
  });

  if (result.errors.length > 0) {
    console.error('Errors:');
    result.errors.forEach(error => console.error('  -', error));
  }

  if (result.warnings.length > 0) {
    console.warn('Warnings:');
    result.warnings.forEach(warning => console.warn('  -', warning));
  }

  // Check individual file results
  result.fileResults.forEach((fileResult, fileName) => {
    console.log(`File: ${fileName}`, fileResult.valid ? '✓' : '✗');
  });

  return result;
}

// ============================================
// EXAMPLE 3: Browser Capability Detection
// ============================================

function checkBrowserCapabilities() {
  console.log('=== Browser Capabilities ===');

  const capabilities = browserCapabilityDetector.getCapabilities();

  console.log('Device Type:', capabilities.deviceType);
  console.log('Available Memory:', formatFileSize(capabilities.availableMemory));
  console.log('Total Memory:', formatFileSize(capabilities.totalMemory));
  console.log('Memory Usage:', `${capabilities.memoryUsagePercent.toFixed(1)}%`);
  console.log('Max Concurrent Operations:', capabilities.maxConcurrent);
  console.log('Supports Web Workers:', capabilities.supportsWorkers);
  console.log('Supports WebAssembly:', capabilities.supportsWasm);
  console.log('Supports OffscreenCanvas:', capabilities.supportsOffscreenCanvas);

  // Check if a specific operation can be handled
  const canHandle = browserCapabilityDetector.canHandle(
    OperationType.PDF_TO_WORD,
    50 * 1024 * 1024 // 50MB file
  );

  console.log('Can handle 50MB PDF to Word:', canHandle.canHandle);
  if (!canHandle.canHandle) {
    console.error('Reason:', canHandle.reason);
  }
}

// ============================================
// EXAMPLE 4: Progress Tracking
// ============================================

async function processFilesWithProgress(files: File[]) {
  console.log('=== Processing with Progress Tracking ===');

  // Start progress tracking
  progressTracker.start(files);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    progressTracker.setCurrentFile(file.name);

    console.log(`Processing: ${file.name}`);

    // Simulate file processing with progress updates
    const chunks = Math.ceil(file.size / (1024 * 1024)); // 1MB chunks
    for (let chunk = 0; chunk < chunks; chunk++) {
      const bytesProcessed = Math.min((chunk + 1) * 1024 * 1024, file.size);
      progressTracker.updateFileProgress(bytesProcessed, file.size);
      progressTracker.updateBytesProcessed(bytesProcessed);

      // Get progress information
      const progress = progressTracker.getProgress();
      console.log(`  Overall: ${progress.overallProgress.toFixed(1)}% | ` +
                  `File: ${progress.currentFileProgress.toFixed(1)}% | ` +
                  `Time remaining: ${progress.estimatedTimeRemaining / 1000}s`);

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    progressTracker.completeFile(file.name);
  }

  console.log('Processing complete!');
  console.log('Completed files:', progressTracker.getProgress().filesCompleted);
}

// ============================================
// EXAMPLE 5: Memory Management
// ============================================

function demonstrateMemoryManagement() {
  console.log('=== Memory Management ===');

  const memoryManager = new MemoryCleanupManager();

  // Create some resources
  const blob = new Blob(['test data'], { type: 'text/plain' });
  const objectUrl = URL.createObjectURL(blob);
  const arrayBuffer = new ArrayBuffer(1024);

  // Register resources for cleanup
  memoryManager.registerObjectUrl(objectUrl);
  memoryManager.registerBlob(blob);
  memoryManager.registerArrayBuffer(arrayBuffer);

  console.log('Memory stats:', memoryManager.getMemoryStats());

  // Use resources...
  console.log('Using resources...');

  // Cleanup when done
  memoryManager.cleanup();
  console.log('Memory cleaned up!');

  // Or cleanup after a delay
  memoryManager.cleanupDelayed(5000); // Cleanup after 5 seconds
}

// ============================================
// EXAMPLE 6: User Tier Management
// ============================================

function demonstrateUserTiers() {
  console.log('=== User Tier Management ===');

  // Create validators for different tiers
  const freeValidator = new FileSizeValidator(UserTier.FREE);
  const premiumValidator = new FileSizeValidator(UserTier.PREMIUM);
  const enterpriseValidator = new FileSizeValidator(UserTier.ENTERPRISE);

  const operationType = OperationType.PDF_TO_WORD;

  console.log('PDF to Word Limits:');
  console.log('  Free:', formatFileSize(getFileSizeLimit(operationType, UserTier.FREE)));
  console.log('  Premium:', formatFileSize(getFileSizeLimit(operationType, UserTier.PREMIUM)));
  console.log('  Enterprise:', formatFileSize(getFileSizeLimit(operationType, UserTier.ENTERPRISE)));

  // Show batch limits
  console.log('\nBatch Limits:');
  Object.values(UserTier).forEach(tier => {
    const limits = getBatchLimits(tier);
    console.log(`  ${tier}:`, {
      maxFiles: limits.maxFiles,
      maxTotalSize: formatFileSize(limits.maxTotalSize),
      maxConcurrent: limits.maxConcurrent
    });
  });

  // Get upgrade suggestion for a 60MB file
  const fileSize = 60 * 1024 * 1024;
  const suggestion = getUpgradeSuggestion(fileSize, operationType, UserTier.FREE);
  console.log('\nUpgrade suggestion for 60MB file:', suggestion);
}

// ============================================
// EXAMPLE 7: Complete Workflow
// ============================================

async function completeValidationWorkflow(files: File[]) {
  console.log('=== Complete Validation Workflow ===');

  // Step 1: Check browser capabilities
  console.log('\n1. Checking browser capabilities...');
  const capabilities = browserCapabilityDetector.getCapabilities();
  console.log(`Device: ${capabilities.deviceType}, Memory: ${formatFileSize(capabilities.availableMemory)}`);

  // Step 2: Validate batch
  console.log('\n2. Validating files...');
  const validationResult = await fileSizeValidator.validateBatch(
    files,
    OperationType.PDF_MERGE
  );

  if (!validationResult.valid) {
    console.error('Validation failed:');
    validationResult.errors.forEach(error => console.error('  -', error));
    return;
  }

  console.log('✓ Validation passed!');

  // Step 3: Process with progress tracking
  console.log('\n3. Processing files...');
  progressTracker.start(files);

  // Simulate processing
  for (const file of files) {
    progressTracker.setCurrentFile(file.name);
    console.log(`Processing ${file.name}...`);

    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 1000));

    progressTracker.completeFile(file.name);
    const progress = progressTracker.getProgress();
    console.log(`Progress: ${progress.overallProgress.toFixed(1)}%`);
  }

  // Step 4: Cleanup
  console.log('\n4. Cleaning up memory...');
  memoryCleanupManager.cleanup();

  console.log('\n✓ Workflow complete!');
}

// ============================================
// EXAMPLE 8: Error Handling
// ============================================

async function demonstrateErrorHandling(file: File) {
  console.log('=== Error Handling ===');

  try {
    // Validate file
    const result = await fileSizeValidator.validateFile(
      file,
      OperationType.PDF_TO_IMAGE
    );

    if (!result.valid) {
      // Handle validation error
      console.error('Validation error:', result.error);

      // Check if upgrade would help
      const suggestion = getUpgradeSuggestion(
        file.size,
        OperationType.PDF_TO_IMAGE,
        UserTier.FREE
      );

      if (suggestion) {
        console.log('Suggestion:', suggestion);
      }

      return;
    }

    // Show warnings to user
    if (result.warning) {
      console.warn('Warning:', result.warning);
    }

    // Proceed with processing
    console.log('Processing file...');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// ============================================
// EXAMPLE 9: Real-time File Size Check
// ============================================

function setupFileInputValidation() {
  console.log('=== Setup File Input Validation ===');

  // Example for HTML file input
  const handleFileInput = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);

    if (files.length === 0) {
      return;
    }

    // Show loading state
    console.log('Validating files...');

    // Validate files
    const result = await fileSizeValidator.validateBatch(
      files,
      OperationType.IMAGE_TO_PDF
    );

    if (!result.valid) {
      // Show errors to user
      alert('Validation failed:\n' + result.errors.join('\n'));
      input.value = ''; // Clear input
      return;
    }

    // Show warnings if any
    if (result.warnings.length > 0) {
      console.warn('Warnings:', result.warnings);
    }

    // Show estimated processing time
    const estimatedTime = result.summary.estimatedTime / 1000;
    console.log(`Estimated processing time: ${estimatedTime.toFixed(1)} seconds`);

    // Proceed with upload/processing
    console.log('Files validated successfully!');
  };

  // Attach to file input (in real application)
  // document.getElementById('fileInput')?.addEventListener('change', handleFileInput);

  return handleFileInput;
}

// ============================================
// EXAMPLE 10: Performance Optimization
// ============================================

async function optimizedBatchProcessing(files: File[]) {
  console.log('=== Optimized Batch Processing ===');

  // Get browser capabilities to determine optimal batch size
  const capabilities = browserCapabilityDetector.getCapabilities();
  const optimalBatchSize = capabilities.maxConcurrent;

  console.log(`Processing in batches of ${optimalBatchSize}...`);

  // Split files into optimal batches
  const batches: File[][] = [];
  for (let i = 0; i < files.length; i += optimalBatchSize) {
    batches.push(files.slice(i, i + optimalBatchSize));
  }

  console.log(`Total batches: ${batches.length}`);

  // Process each batch
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`\nProcessing batch ${i + 1}/${batches.length}...`);

    // Validate batch
    const validationResult = await fileSizeValidator.validateBatch(
      batch,
      OperationType.PDF_MERGE
    );

    if (!validationResult.valid) {
      console.error('Batch validation failed:', validationResult.errors);
      continue;
    }

    // Process batch concurrently
    const processPromises = batch.map(async (file) => {
      console.log(`  Processing ${file.name}...`);
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`  ✓ ${file.name} complete`);
    });

    await Promise.all(processPromises);

    // Cleanup after each batch
    memoryCleanupManager.cleanup();
  }

  console.log('\n✓ All batches processed!');
}

// ============================================
// Export examples for testing
// ============================================

export {
  validateSingleFile,
  validateBatchFiles,
  checkBrowserCapabilities,
  processFilesWithProgress,
  demonstrateMemoryManagement,
  demonstrateUserTiers,
  completeValidationWorkflow,
  demonstrateErrorHandling,
  setupFileInputValidation,
  optimizedBatchProcessing
};

// ============================================
// Usage in React Components
// ============================================

/*

// Example 1: Simple validation in a component
const handleFileUpload = async (files: File[]) => {
  const result = await fileSizeValidator.validateBatch(
    files,
    OperationType.IMAGE_TO_PDF
  );

  if (!result.valid) {
    setError(result.errors.join('\n'));
    return;
  }

  // Proceed with processing
  processFiles(files);
};

// Example 2: With progress tracking
const processWithProgress = async (files: File[]) => {
  progressTracker.start(files);

  for (const file of files) {
    progressTracker.setCurrentFile(file.name);
    await processFile(file);
    progressTracker.completeFile(file.name);

    // Update UI with progress
    const progress = progressTracker.getProgress();
    setProgress(progress.overallProgress);
  }
};

// Example 3: Memory cleanup in useEffect
useEffect(() => {
  return () => {
    memoryCleanupManager.cleanup();
  };
}, []);

// Example 4: User tier-based features
const canUploadFile = (fileSize: number) => {
  const limit = getFileSizeLimit(OperationType.PDF_MERGE, userTier);
  return fileSize <= limit;
};

// Example 5: Show upgrade prompt
const showUpgradePrompt = (fileSize: number) => {
  const suggestion = getUpgradeSuggestion(
    fileSize,
    OperationType.PDF_MERGE,
    UserTier.FREE
  );

  if (suggestion) {
    setUpgradeMessage(suggestion);
    setShowUpgradeModal(true);
  }
};

*/
