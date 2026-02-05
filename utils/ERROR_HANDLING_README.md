# Error Handling System Documentation

## Overview

A comprehensive, production-ready error handling system with user-friendly messages, automatic retry logic, and detailed monitoring capabilities.

## Features

- **5 Error Categories**: Validation, Processing, Memory, Network, Unknown
- **30+ Error Codes**: Comprehensive coverage of all possible errors
- **User-Friendly Messages**: Clear, actionable messages for end users
- **Recovery Suggestions**: Step-by-step guidance for error resolution
- **Automatic Retry Logic**: Smart retry with exponential backoff
- **Error Severity Levels**: LOW, MEDIUM, HIGH, CRITICAL
- **Full Integration**: Works seamlessly with existing monitoring system
- **TypeScript Support**: Full type safety and IntelliSense
- **Production Ready**: Tested, documented, and optimized

## Quick Start

```typescript
import {
  ErrorCode,
  createValidationError,
  getUserFriendlyMessage,
  getRecoverySuggestions,
  logError,
  withRetry
} from './utils/errorHandling';

// Throw a validation error
throw createValidationError(ErrorCode.INVALID_FILE_TYPE, {
  fileName: 'document.txt',
  expectedType: 'PDF'
});

// Handle errors with user-friendly messages
try {
  await processFile(file);
} catch (error) {
  const message = getUserFriendlyMessage(error);
  const suggestions = getRecoverySuggestions(error);
  console.log(message, suggestions);
  logError(error);
}

// Automatic retry for transient errors
const result = await withRetry(
  () => uploadToServer(file),
  ErrorCode.NETWORK_ERROR
);
```

## Error Categories

### 1. VALIDATION (1xxx)
Errors related to input validation and file checks.

**Error Codes:**
- `INVALID_FILE_TYPE` (1001) - File type not supported
- `INVALID_FILE_SIZE` (1002) - File exceeds size limit
- `INVALID_FILE_NAME` (1003) - Invalid filename characters
- `EMPTY_FILE` (1004) - File has no content
- `CORRUPTED_FILE` (1005) - File structure is damaged
- `MALICIOUS_FILE` (1006) - Security threat detected
- `INVALID_INPUT` (1007) - Form input validation failed
- `MISSING_REQUIRED_FIELD` (1008) - Required field empty
- `INVALID_RANGE` (1009) - Value outside allowed range
- `INVALID_PASSWORD` (1010) - Incorrect password

### 2. PROCESSING (2xxx)
Errors that occur during file operations.

**Error Codes:**
- `CONVERSION_FAILED` (2001) - File conversion failed
- `COMPRESSION_FAILED` (2002) - Compression operation failed
- `MERGE_FAILED` (2003) - Cannot merge files
- `SPLIT_FAILED` (2004) - Cannot split file
- `ROTATION_FAILED` (2005) - Page rotation failed
- `ENCRYPTION_FAILED` (2006) - Cannot encrypt file
- `DECRYPTION_FAILED` (2007) - Cannot decrypt file
- `EXTRACTION_FAILED` (2008) - Content extraction failed
- `RENDER_FAILED` (2009) - Cannot display file
- `PROCESSING_TIMEOUT` (2010) - Operation took too long
- `UNSUPPORTED_OPERATION` (2011) - Operation not supported
- `BACKGROUND_REMOVAL_FAILED` (2012) - Background removal failed

### 3. MEMORY (3xxx)
Memory and resource-related errors.

**Error Codes:**
- `OUT_OF_MEMORY` (3001) - Insufficient memory
- `FILE_TOO_LARGE` (3002) - File too large for device
- `MEMORY_LIMIT_EXCEEDED` (3003) - Memory allocation exceeded
- `BUFFER_OVERFLOW` (3004) - Data exceeds buffer

### 4. NETWORK (4xxx)
Network and API-related errors.

**Error Codes:**
- `NETWORK_ERROR` (4001) - Network request failed
- `REQUEST_TIMEOUT` (4002) - Request timed out
- `API_ERROR` (4003) - API returned error
- `CONNECTION_LOST` (4004) - Internet connection lost
- `RATE_LIMIT_EXCEEDED` (4005) - Too many requests
- `SERVICE_UNAVAILABLE` (4006) - Service temporarily down

### 5. UNKNOWN (5xxx)
Generic and configuration errors.

**Error Codes:**
- `UNKNOWN_ERROR` (5000) - Unexpected error
- `INTERNAL_ERROR` (5001) - Internal application error
- `CONFIGURATION_ERROR` (5002) - Configuration issue
- `BROWSER_NOT_SUPPORTED` (5003) - Browser incompatible
- `FEATURE_NOT_AVAILABLE` (5004) - Feature not available

## Core Functions

### Creating Errors

```typescript
// Category-specific error creators
const error1 = createValidationError(ErrorCode.INVALID_FILE_TYPE, context);
const error2 = createProcessingError(ErrorCode.CONVERSION_FAILED, context);
const error3 = createMemoryError(ErrorCode.OUT_OF_MEMORY, context);
const error4 = createNetworkError(ErrorCode.API_ERROR, context);

// Wrap unknown errors
const wrapped = wrapError(unknownError, ErrorCode.UNKNOWN_ERROR, context);
```

### Getting Error Information

```typescript
// User-friendly message
const message = getUserFriendlyMessage(error);
// "The file type you selected is not supported"

// Technical message (for logs)
const technical = getTechnicalMessage(error);
// "File type validation failed - MIME type mismatch"

// Recovery suggestions
const suggestions = getRecoverySuggestions(error);
// ["Please select a PDF, JPG, or PNG file", "Check the file extension..."]

// Error metadata
const category = getErrorCategory(error);     // ErrorCategory.VALIDATION
const severity = getErrorSeverity(error);     // ErrorSeverity.LOW
const recoverable = isRecoverable(error);     // true
const maxRetries = getMaxRetries(error);      // 0
```

### Logging Errors

```typescript
// Log with full context
logError(error, {
  component: 'FileUpload',
  userId: '12345',
  fileName: 'document.pdf'
});

// Automatically logs to:
// - Console (with appropriate level)
// - Monitoring system
// - Error tracker
```

### Retry Logic

```typescript
// Automatic retry with exponential backoff
const result = await withRetry(
  async () => {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: file
    });
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  },
  ErrorCode.NETWORK_ERROR,
  { fileName: file.name }
);

// Manual retry check
if (shouldRetry(error, attemptNumber)) {
  // Retry the operation
  await retryOperation();
}
```

### Error Formatting

```typescript
// Format for UI display
const formatted = formatErrorForDisplay(error);
/*
{
  title: "Error",
  message: "We couldn't convert your file",
  suggestions: ["Make sure your file is not corrupted", ...],
  severity: ErrorSeverity.MEDIUM,
  code: 2001
}
*/

// Export detailed report
const report = exportErrorReport(error, { userAction: 'PDF conversion' });
// JSON string with full error details, environment info, etc.
```

## React Integration

### Custom Hook

```typescript
import { useState, useCallback } from 'react';
import { AppError, wrapError, getUserFriendlyMessage, getRecoverySuggestions, logError } from './errorHandling';

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

// Usage
const MyComponent = () => {
  const { error, setError, clearError, userMessage, recoverySuggestions } = useErrorHandler();

  const handleUpload = async (file: File) => {
    try {
      await uploadFile(file);
    } catch (err) {
      setError(err, ErrorCode.NETWORK_ERROR);
    }
  };

  if (error) {
    return (
      <ErrorDisplay
        message={userMessage}
        suggestions={recoverySuggestions}
        onDismiss={clearError}
      />
    );
  }

  return <UploadForm onUpload={handleUpload} />;
};
```

### Error Boundary Integration

```typescript
import { handleError } from './utils/errorHandling';

class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { appError, userMessage, recoverySuggestions } = handleError(error);

    this.setState({
      error: appError,
      userMessage,
      recoverySuggestions
    });
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorPage
          message={this.state.userMessage}
          suggestions={this.state.recoverySuggestions}
        />
      );
    }

    return this.props.children;
  }
}
```

## Best Practices

### 1. Always Use Specific Error Codes

```typescript
// Good ✓
throw createValidationError(ErrorCode.INVALID_FILE_TYPE, { fileName: file.name });

// Avoid ✗
throw new Error('Invalid file');
```

### 2. Provide Context

```typescript
// Good ✓
throw createProcessingError(ErrorCode.CONVERSION_FAILED, {
  fileName: file.name,
  fileSize: file.size,
  targetFormat: 'PDF',
  stage: 'rendering'
});

// Less helpful ✗
throw createProcessingError(ErrorCode.CONVERSION_FAILED);
```

### 3. Log All Errors

```typescript
// Good ✓
try {
  await processFile(file);
} catch (error) {
  logError(error, { component: 'FileProcessor' });
  throw error;
}

// Missing logging ✗
try {
  await processFile(file);
} catch (error) {
  throw error;
}
```

### 4. Use Retry for Transient Errors

```typescript
// Network requests - use retry ✓
const data = await withRetry(
  () => fetch('/api/data'),
  ErrorCode.NETWORK_ERROR
);

// Validation errors - don't retry ✓
const validation = validateFile(file);
if (!validation.valid) {
  throw createValidationError(ErrorCode.INVALID_FILE_TYPE);
}
```

### 5. Display User-Friendly Messages

```typescript
// Good ✓
const message = getUserFriendlyMessage(error);
const suggestions = getRecoverySuggestions(error);
showToast(message, suggestions);

// Technical messages for users ✗
showToast(error.message); // "TypeError: Cannot read property 'x' of undefined"
```

## Error Severity Levels

### LOW
- Minor issues, easily recoverable
- Don't block workflow
- Auto-dismiss notifications OK
- Examples: Invalid input, missing optional field

### MEDIUM
- Impacts current operation
- User action may be needed
- Show notification with suggestions
- Examples: Processing failed, network timeout

### HIGH
- Serious issues affecting functionality
- Requires user attention
- Don't auto-dismiss
- Examples: Out of memory, service unavailable

### CRITICAL
- Critical failures, app may not work
- Immediate attention required
- Persistent error display
- Examples: Configuration error, browser not supported

## Testing

### Unit Tests

```typescript
import { createValidationError, ErrorCode, getUserFriendlyMessage } from './errorHandling';

describe('Error Handling', () => {
  it('creates validation error with correct properties', () => {
    const error = createValidationError(ErrorCode.INVALID_FILE_TYPE);

    expect(error.code).toBe(ErrorCode.INVALID_FILE_TYPE);
    expect(error.category).toBe(ErrorCategory.VALIDATION);
    expect(error.recoverable).toBe(true);
  });

  it('returns user-friendly message', () => {
    const error = createValidationError(ErrorCode.INVALID_FILE_TYPE);
    const message = getUserFriendlyMessage(error);

    expect(message).toContain('file type');
    expect(message).not.toContain('MIME');
  });
});
```

### Integration Tests

```typescript
describe('File Upload with Error Handling', () => {
  it('handles validation errors gracefully', async () => {
    const invalidFile = new File([''], 'test.txt', { type: 'text/plain' });

    await expect(uploadFile(invalidFile)).rejects.toThrow(AppError);

    try {
      await uploadFile(invalidFile);
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('file type');
    }
  });
});
```

## Monitoring Integration

The error handling system integrates seamlessly with the existing monitoring system:

```typescript
// Errors are automatically:
// 1. Logged to console with appropriate level
// 2. Tracked in errorTracker for statistics
// 3. Sent to monitoring service (if configured)

logError(error, { component: 'PDFConverter' });
// ✓ Console: [ERROR] Conversion failed
// ✓ Tracker: Error count incremented
// ✓ Monitoring: Event sent with full context
```

## Performance Considerations

1. **Error Creation**: Lightweight, minimal overhead
2. **Retry Logic**: Exponential backoff prevents server overload
3. **Logging**: Async when possible, buffered for batch sending
4. **Context**: Keep context objects small to avoid memory issues

## Browser Compatibility

- ✓ Chrome 90+
- ✓ Firefox 88+
- ✓ Safari 14+
- ✓ Edge 90+

## Migration Guide

### From Basic Error Handling

```typescript
// Before
throw new Error('File is invalid');

// After
throw createValidationError(ErrorCode.INVALID_FILE_TYPE, {
  fileName: file.name
});
```

### From Try-Catch

```typescript
// Before
try {
  await process();
} catch (error) {
  console.error(error);
  alert('Something went wrong');
}

// After
try {
  await process();
} catch (error) {
  const appError = wrapError(error);
  logError(appError);
  showErrorToast({
    message: getUserFriendlyMessage(appError),
    suggestions: getRecoverySuggestions(appError)
  });
}
```

## Troubleshooting

### Error Not Retrying

Check if the error type supports retry:
```typescript
const shouldRetryError = shouldRetry(error, attemptCount);
const maxRetries = getMaxRetries(error);
```

### Missing Recovery Suggestions

Ensure you're using a defined ErrorCode:
```typescript
// Has suggestions ✓
const error = createValidationError(ErrorCode.INVALID_FILE_TYPE);

// May not have suggestions ✗
const error = new Error('Something wrong');
```

### Error Not Logged

Make sure to call logError:
```typescript
catch (error) {
  logError(error); // Don't forget this!
  throw error;
}
```

## API Reference

See [errorHandling.ts](./errorHandling.ts) for complete API documentation with TypeScript definitions.

## Examples

See [errorHandling.example.ts](./errorHandling.example.ts) for comprehensive usage examples.

## Support

For issues or questions:
1. Check the examples file
2. Review this documentation
3. Check TypeScript definitions
4. Contact development team

## License

Apache-2.0
