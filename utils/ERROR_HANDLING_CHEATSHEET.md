# Error Handling Quick Reference

## Common Patterns

### 1. Throw Validation Error
```typescript
import { createValidationError, ErrorCode } from './errorHandling';

if (!isValidFileType(file)) {
  throw createValidationError(ErrorCode.INVALID_FILE_TYPE, {
    fileName: file.name,
    fileType: file.type
  });
}
```

### 2. Throw Processing Error
```typescript
import { createProcessingError, ErrorCode } from './errorHandling';

try {
  await convertFile(file);
} catch (error) {
  throw createProcessingError(ErrorCode.CONVERSION_FAILED, {
    fileName: file.name,
    originalError: error.message
  });
}
```

### 3. Handle Any Error
```typescript
import { handleError } from './errorHandling';

try {
  await riskyOperation();
} catch (error) {
  const { userMessage, recoverySuggestions } = handleError(error);
  showToast(userMessage, recoverySuggestions);
}
```

### 4. Auto-Retry Network Requests
```typescript
import { withRetry, ErrorCode } from './errorHandling';

const data = await withRetry(
  () => fetch('/api/endpoint').then(r => r.json()),
  ErrorCode.NETWORK_ERROR
);
```

### 5. Log Errors
```typescript
import { logError } from './errorHandling';

try {
  await operation();
} catch (error) {
  logError(error, { component: 'MyComponent', userId: user.id });
  throw error;
}
```

### 6. Display User-Friendly Messages
```typescript
import { getUserFriendlyMessage, getRecoverySuggestions } from './errorHandling';

catch (error) {
  const message = getUserFriendlyMessage(error);
  const suggestions = getRecoverySuggestions(error);

  showErrorDialog({
    title: 'Error',
    message: message,
    suggestions: suggestions
  });
}
```

### 7. Check if Should Retry
```typescript
import { shouldRetry } from './errorHandling';

for (let attempt = 0; attempt < 3; attempt++) {
  try {
    return await operation();
  } catch (error) {
    if (!shouldRetry(error, attempt)) throw error;
    await delay(1000 * attempt);
  }
}
```

### 8. React Hook Usage
```typescript
const MyComponent = () => {
  const { error, setError, clearError, userMessage, recoverySuggestions } = useErrorHandler();

  const handleSubmit = async () => {
    try {
      await submitData();
    } catch (err) {
      setError(err, ErrorCode.PROCESSING_FAILED);
    }
  };

  if (error) {
    return <ErrorMessage message={userMessage} suggestions={recoverySuggestions} />;
  }

  return <Form onSubmit={handleSubmit} />;
};
```

## Error Codes Quick Reference

### Validation (1xxx)
- `1001` - INVALID_FILE_TYPE
- `1002` - INVALID_FILE_SIZE
- `1003` - INVALID_FILE_NAME
- `1004` - EMPTY_FILE
- `1005` - CORRUPTED_FILE
- `1006` - MALICIOUS_FILE
- `1007` - INVALID_INPUT
- `1008` - MISSING_REQUIRED_FIELD
- `1009` - INVALID_RANGE
- `1010` - INVALID_PASSWORD

### Processing (2xxx)
- `2001` - CONVERSION_FAILED
- `2002` - COMPRESSION_FAILED
- `2003` - MERGE_FAILED
- `2004` - SPLIT_FAILED
- `2005` - ROTATION_FAILED
- `2006` - ENCRYPTION_FAILED
- `2007` - DECRYPTION_FAILED
- `2008` - EXTRACTION_FAILED
- `2009` - RENDER_FAILED
- `2010` - PROCESSING_TIMEOUT
- `2011` - UNSUPPORTED_OPERATION
- `2012` - BACKGROUND_REMOVAL_FAILED

### Memory (3xxx)
- `3001` - OUT_OF_MEMORY
- `3002` - FILE_TOO_LARGE
- `3003` - MEMORY_LIMIT_EXCEEDED
- `3004` - BUFFER_OVERFLOW

### Network (4xxx)
- `4001` - NETWORK_ERROR
- `4002` - REQUEST_TIMEOUT
- `4003` - API_ERROR
- `4004` - CONNECTION_LOST
- `4005` - RATE_LIMIT_EXCEEDED
- `4006` - SERVICE_UNAVAILABLE

### Unknown (5xxx)
- `5000` - UNKNOWN_ERROR
- `5001` - INTERNAL_ERROR
- `5002` - CONFIGURATION_ERROR
- `5003` - BROWSER_NOT_SUPPORTED
- `5004` - FEATURE_NOT_AVAILABLE

## Key Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `createValidationError()` | Create validation error | `AppError` |
| `createProcessingError()` | Create processing error | `AppError` |
| `createMemoryError()` | Create memory error | `AppError` |
| `createNetworkError()` | Create network error | `AppError` |
| `wrapError()` | Wrap unknown error | `AppError` |
| `getUserFriendlyMessage()` | Get user message | `string` |
| `getTechnicalMessage()` | Get technical message | `string` |
| `getRecoverySuggestions()` | Get suggestions | `string[]` |
| `isRecoverable()` | Check if recoverable | `boolean` |
| `shouldRetry()` | Check if should retry | `boolean` |
| `getMaxRetries()` | Get max retry count | `number` |
| `logError()` | Log error | `void` |
| `withRetry()` | Execute with retry | `Promise<T>` |
| `handleError()` | Handle error (all-in-one) | `object` |
| `formatErrorForDisplay()` | Format for UI | `object` |
| `exportErrorReport()` | Export debug report | `string` |

## Error Categories

- **VALIDATION**: Input/file validation errors
- **PROCESSING**: File operation errors
- **MEMORY**: Memory/resource errors
- **NETWORK**: Network/API errors
- **UNKNOWN**: Generic errors

## Severity Levels

- **LOW**: Minor issues, auto-dismiss OK
- **MEDIUM**: Impacts operation, needs attention
- **HIGH**: Serious issues, don't auto-dismiss
- **CRITICAL**: Critical failures, immediate action

## Pro Tips

1. **Always use specific error codes** - Enables proper user messages and recovery
2. **Include context** - Helps with debugging and monitoring
3. **Log all errors** - Essential for production monitoring
4. **Use retry for network errors** - Improves reliability
5. **Show recovery suggestions** - Helps users resolve issues
6. **Check error severity** - Determines UI behavior
7. **Wrap unknown errors** - Ensures consistent handling
8. **Test error paths** - Often overlooked but critical

## Common Mistakes

❌ `throw new Error('Invalid file')`
✅ `throw createValidationError(ErrorCode.INVALID_FILE_TYPE, { fileName })`

❌ `console.error(error)`
✅ `logError(error, { component: 'FileUpload' })`

❌ `alert(error.message)`
✅ `alert(getUserFriendlyMessage(error))`

❌ Retry validation errors
✅ Only retry transient errors (network, timeouts)

❌ `catch (e) { /* ignore */ }`
✅ `catch (e) { logError(e); throw e; }`

## Import Shortcuts

```typescript
// Everything you need
import {
  ErrorCode,
  createValidationError,
  createProcessingError,
  getUserFriendlyMessage,
  getRecoverySuggestions,
  logError,
  withRetry,
  handleError
} from './utils/errorHandling';
```

## Decision Tree

```
Error occurred
    │
    ├─ Is it validation? → createValidationError() → Show inline message
    │
    ├─ Is it processing? → createProcessingError() → Show toast + suggestions
    │
    ├─ Is it network? → createNetworkError() → Retry + show status
    │
    ├─ Is it memory? → createMemoryError() → Show warning + cleanup
    │
    └─ Unknown → wrapError() → Log + show generic message
```

## Testing Template

```typescript
describe('MyFeature', () => {
  it('handles errors gracefully', async () => {
    const error = createValidationError(ErrorCode.INVALID_FILE_TYPE);

    expect(error.code).toBe(ErrorCode.INVALID_FILE_TYPE);
    expect(getUserFriendlyMessage(error)).toContain('file type');
    expect(getRecoverySuggestions(error).length).toBeGreaterThan(0);
    expect(isRecoverable(error)).toBe(true);
    expect(shouldRetry(error)).toBe(false);
  });
});
```

## Need More Help?

- Full Documentation: [ERROR_HANDLING_README.md](./ERROR_HANDLING_README.md)
- Code Examples: [errorHandling.example.ts](./errorHandling.example.ts)
- Source Code: [errorHandling.ts](./errorHandling.ts)
