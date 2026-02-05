/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Example Usage of Error Handling System
 * This file demonstrates how to use the comprehensive error handling utilities
 */

import {
  ErrorCode,
  ErrorCategory,
  ErrorSeverity,
  AppError,
  getUserFriendlyMessage,
  getRecoverySuggestions,
  logError,
  shouldRetry,
  withRetry,
  handleError,
  createValidationError,
  createProcessingError,
  createNetworkError,
  wrapError,
  formatErrorForDisplay,
  exportErrorReport
} from './errorHandling';

// ============================================================
// Example 1: Creating and throwing custom errors
// ============================================================

const validateAndProcessFile = async (file: File) => {
  // Check file type
  if (!file.type.includes('pdf')) {
    throw createValidationError(ErrorCode.INVALID_FILE_TYPE, {
      fileName: file.name,
      fileType: file.type,
      expectedType: 'application/pdf'
    });
  }

  // Check file size
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSize) {
    throw createValidationError(ErrorCode.INVALID_FILE_SIZE, {
      fileName: file.name,
      fileSize: file.size,
      maxSize
    });
  }

  try {
    // Process the file...
    await processFile(file);
  } catch (error) {
    throw createProcessingError(ErrorCode.CONVERSION_FAILED, {
      fileName: file.name,
      originalError: error instanceof Error ? error.message : String(error)
    });
  }
};

// ============================================================
// Example 2: Catching and handling errors with user messages
// ============================================================

const handleFileUpload = async (file: File) => {
  try {
    await validateAndProcessFile(file);
    console.log('File processed successfully!');
  } catch (error) {
    if (error instanceof AppError) {
      // Get user-friendly message
      const userMessage = getUserFriendlyMessage(error);
      console.log('User sees:', userMessage);

      // Get recovery suggestions
      const suggestions = getRecoverySuggestions(error);
      console.log('Suggestions:', suggestions);

      // Log error for monitoring
      logError(error, { component: 'FileUpload' });

      // Display error to user in UI
      showErrorToast({
        message: userMessage,
        suggestions: suggestions,
        severity: error.severity
      });
    } else {
      // Handle non-AppError errors
      const wrapped = wrapError(error, ErrorCode.UNKNOWN_ERROR);
      logError(wrapped);
    }
  }
};

// ============================================================
// Example 3: Using retry logic for transient errors
// ============================================================

const uploadFileToServer = async (file: File) => {
  // Automatically retries network errors with exponential backoff
  return withRetry(
    async () => {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: file
      });

      if (!response.ok) {
        throw createNetworkError(ErrorCode.API_ERROR, {
          status: response.status,
          statusText: response.statusText
        });
      }

      return response.json();
    },
    ErrorCode.NETWORK_ERROR,
    { fileName: file.name }
  );
};

// ============================================================
// Example 4: Manual retry check
// ============================================================

const processWithRetry = async (file: File, maxAttempts: number = 3) => {
  let lastError: AppError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await processFile(file);
    } catch (error) {
      const appError = wrapError(error, ErrorCode.PROCESSING_FAILED);
      lastError = appError;

      // Check if we should retry
      if (shouldRetry(appError, attempt)) {
        console.log(`Attempt ${attempt + 1} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }

      // Don't retry this error type
      throw appError;
    }
  }

  throw lastError;
};

// ============================================================
// Example 5: Error boundary integration
// ============================================================

const MyComponent = () => {
  const handleOperation = async () => {
    try {
      await someRiskyOperation();
    } catch (error) {
      // Use handleError helper for consistent error handling
      const { userMessage, recoverySuggestions, shouldShowDetails } = handleError(
        error,
        ErrorCode.PROCESSING_FAILED
      );

      // Display to user
      alert(`Error: ${userMessage}\n\nSuggestions:\n${recoverySuggestions.join('\n')}`);
    }
  };

  return null; // Component JSX
};

// ============================================================
// Example 6: Format error for UI display
// ============================================================

const displayError = (error: Error | AppError) => {
  const formatted = formatErrorForDisplay(error);

  // Use formatted error in your UI
  return {
    title: formatted.title,           // "Error" or "Critical Error"
    message: formatted.message,       // User-friendly message
    suggestions: formatted.suggestions, // Array of recovery steps
    severity: formatted.severity,     // LOW, MEDIUM, HIGH, CRITICAL
    code: formatted.code              // Error code for debugging
  };
};

// ============================================================
// Example 7: Export error report for debugging
// ============================================================

const reportError = (error: Error | AppError) => {
  // Create detailed error report
  const report = exportErrorReport(error, {
    userAction: 'Converting PDF to JPG',
    fileCount: 3,
    browserInfo: navigator.userAgent
  });

  // Send to logging service or download for debugging
  console.log('Error Report:', report);

  // Or send to monitoring service
  fetch('/api/error-reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: report
  });
};

// ============================================================
// Example 8: React Hook for error handling
// ============================================================

import { useState, useCallback } from 'react';

const useErrorHandler = () => {
  const [error, setError] = useState<AppError | null>(null);

  const handleError = useCallback((err: unknown, code?: ErrorCode) => {
    const appError = wrapError(err, code);
    logError(appError);
    setError(appError);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    setError: handleError,
    clearError,
    userMessage: error ? getUserFriendlyMessage(error) : '',
    recoverySuggestions: error ? getRecoverySuggestions(error) : [],
    isRecoverable: error ? error.recoverable : true
  };
};

// Usage in component
const FileUploadComponent = () => {
  const { error, setError, clearError, userMessage, recoverySuggestions } = useErrorHandler();

  const handleUpload = async (file: File) => {
    try {
      clearError();
      await uploadFileToServer(file);
    } catch (err) {
      setError(err, ErrorCode.NETWORK_ERROR);
    }
  };

  if (error) {
    return (
      <div className="error-display">
        <h3>{userMessage}</h3>
        <ul>
          {recoverySuggestions.map((suggestion, i) => (
            <li key={i}>{suggestion}</li>
          ))}
        </ul>
        <button onClick={clearError}>Dismiss</button>
      </div>
    );
  }

  return null; // Normal component UI
};

// ============================================================
// Example 9: Category-specific error handling
// ============================================================

const handleByCategory = (error: AppError) => {
  switch (error.category) {
    case ErrorCategory.VALIDATION:
      // Show inline validation errors
      showInlineError(getUserFriendlyMessage(error));
      break;

    case ErrorCategory.PROCESSING:
      // Show progress/processing error
      showProcessingError(getUserFriendlyMessage(error));
      break;

    case ErrorCategory.MEMORY:
      // Show memory warning and suggest optimizations
      showMemoryWarning(getUserFriendlyMessage(error));
      suggestMemoryOptimizations();
      break;

    case ErrorCategory.NETWORK:
      // Offer to retry or check connection
      showNetworkError(getUserFriendlyMessage(error));
      offerRetry();
      break;

    case ErrorCategory.UNKNOWN:
      // Show generic error and offer to report
      showGenericError(getUserFriendlyMessage(error));
      offerErrorReport(error);
      break;
  }
};

// ============================================================
// Example 10: Severity-based UI display
// ============================================================

const getErrorStyle = (severity: ErrorSeverity) => {
  switch (severity) {
    case ErrorSeverity.CRITICAL:
      return { color: 'red', icon: '🛑', autoClose: false };
    case ErrorSeverity.HIGH:
      return { color: 'orange', icon: '⚠️', autoClose: false };
    case ErrorSeverity.MEDIUM:
      return { color: 'yellow', icon: '⚡', autoClose: 5000 };
    case ErrorSeverity.LOW:
      return { color: 'blue', icon: 'ℹ️', autoClose: 3000 };
  }
};

// ============================================================
// Helper function stubs (for demonstration)
// ============================================================

const processFile = async (file: File): Promise<void> => {
  // Simulated processing
  return new Promise((resolve) => setTimeout(resolve, 100));
};

const someRiskyOperation = async () => {
  throw new Error('Something went wrong');
};

const showErrorToast = (config: any) => console.log('Toast:', config);
const showInlineError = (msg: string) => console.log('Inline:', msg);
const showProcessingError = (msg: string) => console.log('Processing:', msg);
const showMemoryWarning = (msg: string) => console.log('Memory:', msg);
const suggestMemoryOptimizations = () => console.log('Optimize memory');
const showNetworkError = (msg: string) => console.log('Network:', msg);
const offerRetry = () => console.log('Offer retry');
const showGenericError = (msg: string) => console.log('Generic:', msg);
const offerErrorReport = (error: AppError) => console.log('Report error', error.code);

export {
  useErrorHandler,
  handleFileUpload,
  uploadFileToServer,
  processWithRetry,
  displayError,
  reportError,
  handleByCategory,
  getErrorStyle
};
