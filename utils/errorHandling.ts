/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger, errorTracker } from './monitoring';

/**
 * Comprehensive Error Handling System
 * Production-level error management with user-friendly messages and recovery strategies
 */

/**
 * Error Categories
 */
export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  PROCESSING = 'PROCESSING',
  MEMORY = 'MEMORY',
  NETWORK = 'NETWORK',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Comprehensive Error Codes
 */
export enum ErrorCode {
  // Validation Errors (1xxx)
  INVALID_FILE_TYPE = 1001,
  INVALID_FILE_SIZE = 1002,
  INVALID_FILE_NAME = 1003,
  EMPTY_FILE = 1004,
  CORRUPTED_FILE = 1005,
  MALICIOUS_FILE = 1006,
  INVALID_INPUT = 1007,
  MISSING_REQUIRED_FIELD = 1008,
  INVALID_RANGE = 1009,
  INVALID_PASSWORD = 1010,

  // Processing Errors (2xxx)
  CONVERSION_FAILED = 2001,
  COMPRESSION_FAILED = 2002,
  MERGE_FAILED = 2003,
  SPLIT_FAILED = 2004,
  ROTATION_FAILED = 2005,
  ENCRYPTION_FAILED = 2006,
  DECRYPTION_FAILED = 2007,
  EXTRACTION_FAILED = 2008,
  RENDER_FAILED = 2009,
  PROCESSING_TIMEOUT = 2010,
  UNSUPPORTED_OPERATION = 2011,
  BACKGROUND_REMOVAL_FAILED = 2012,

  // Memory Errors (3xxx)
  OUT_OF_MEMORY = 3001,
  FILE_TOO_LARGE = 3002,
  MEMORY_LIMIT_EXCEEDED = 3003,
  BUFFER_OVERFLOW = 3004,

  // Network Errors (4xxx)
  NETWORK_ERROR = 4001,
  REQUEST_TIMEOUT = 4002,
  API_ERROR = 4003,
  CONNECTION_LOST = 4004,
  RATE_LIMIT_EXCEEDED = 4005,
  SERVICE_UNAVAILABLE = 4006,

  // Unknown/Generic Errors (5xxx)
  UNKNOWN_ERROR = 5000,
  INTERNAL_ERROR = 5001,
  CONFIGURATION_ERROR = 5002,
  BROWSER_NOT_SUPPORTED = 5003,
  FEATURE_NOT_AVAILABLE = 5004
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',       // Recoverable, minor issues
  MEDIUM = 'MEDIUM', // Potentially recoverable, user action needed
  HIGH = 'HIGH',     // Serious issues, functionality impaired
  CRITICAL = 'CRITICAL' // Critical failures, app may not work
}

/**
 * Custom Application Error
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly recoverable: boolean;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: ErrorCode,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    recoverable: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.category = category;
    this.severity = severity;
    this.recoverable = recoverable;
    this.context = context;
    this.timestamp = new Date();

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * Error metadata configuration
 */
interface ErrorMetadata {
  userMessage: string;
  technicalMessage: string;
  recoverySuggestions: string[];
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverable: boolean;
  shouldRetry: boolean;
  maxRetries: number;
}

/**
 * Comprehensive error metadata mapping
 */
const ERROR_METADATA: Record<ErrorCode, ErrorMetadata> = {
  // Validation Errors
  [ErrorCode.INVALID_FILE_TYPE]: {
    userMessage: 'The file type you selected is not supported',
    technicalMessage: 'File type validation failed - MIME type or extension mismatch',
    recoverySuggestions: [
      'Please select a file with a supported format (PDF, JPG, PNG, DOCX, etc.)',
      'Check the file extension and make sure it matches the actual file type',
      'Try converting the file to a supported format first'
    ],
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.LOW,
    recoverable: true,
    shouldRetry: false,
    maxRetries: 0
  },
  [ErrorCode.INVALID_FILE_SIZE]: {
    userMessage: 'The file size exceeds the maximum allowed limit',
    technicalMessage: 'File size validation failed - exceeds maximum size limit',
    recoverySuggestions: [
      'Try compressing the file before uploading',
      'Split large files into smaller parts',
      'Remove unnecessary content from the file',
      'Maximum sizes: PDF (100MB), Images (20MB), Documents (50MB)'
    ],
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.LOW,
    recoverable: true,
    shouldRetry: false,
    maxRetries: 0
  },
  [ErrorCode.INVALID_FILE_NAME]: {
    userMessage: 'The file name contains invalid characters',
    technicalMessage: 'Filename validation failed - contains illegal characters or path traversal',
    recoverySuggestions: [
      'Rename the file using only letters, numbers, and basic punctuation',
      'Avoid special characters like <>:"|?*\\/',
      'Ensure the filename is not too long (max 255 characters)'
    ],
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.LOW,
    recoverable: true,
    shouldRetry: false,
    maxRetries: 0
  },
  [ErrorCode.EMPTY_FILE]: {
    userMessage: 'The selected file appears to be empty',
    technicalMessage: 'File size is zero bytes',
    recoverySuggestions: [
      'Make sure the file contains actual content',
      'Try opening the file in another application to verify it works',
      'The file might be corrupted - try creating it again'
    ],
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.LOW,
    recoverable: true,
    shouldRetry: false,
    maxRetries: 0
  },
  [ErrorCode.CORRUPTED_FILE]: {
    userMessage: 'The file appears to be corrupted or damaged',
    technicalMessage: 'File structure validation failed - unable to parse file format',
    recoverySuggestions: [
      'Try opening the file in its native application to verify it works',
      'If possible, recreate or re-export the file',
      'The file may have been corrupted during download or transfer'
    ],
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.MEDIUM,
    recoverable: false,
    shouldRetry: false,
    maxRetries: 0
  },
  [ErrorCode.MALICIOUS_FILE]: {
    userMessage: 'The file was blocked for security reasons',
    technicalMessage: 'Malicious file signature detected during security scan',
    recoverySuggestions: [
      'Only upload files from trusted sources',
      'Scan the file with antivirus software',
      'If you believe this is an error, contact support'
    ],
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.HIGH,
    recoverable: false,
    shouldRetry: false,
    maxRetries: 0
  },
  [ErrorCode.INVALID_INPUT]: {
    userMessage: 'The information you entered is not valid',
    technicalMessage: 'Input validation failed - invalid format or value',
    recoverySuggestions: [
      'Check that all required fields are filled correctly',
      'Make sure numbers are within valid ranges',
      'Remove any special characters if not allowed'
    ],
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.LOW,
    recoverable: true,
    shouldRetry: false,
    maxRetries: 0
  },
  [ErrorCode.MISSING_REQUIRED_FIELD]: {
    userMessage: 'Please fill in all required fields',
    technicalMessage: 'Required field validation failed - missing mandatory input',
    recoverySuggestions: [
      'Check for any empty required fields marked with *',
      'Make sure all mandatory information is provided',
      'Review the form and complete all sections'
    ],
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.LOW,
    recoverable: true,
    shouldRetry: false,
    maxRetries: 0
  },
  [ErrorCode.INVALID_RANGE]: {
    userMessage: 'The value is outside the allowed range',
    technicalMessage: 'Range validation failed - value exceeds min/max limits',
    recoverySuggestions: [
      'Check the minimum and maximum allowed values',
      'Adjust your input to be within the valid range',
      'Use the slider to select a valid value'
    ],
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.LOW,
    recoverable: true,
    shouldRetry: false,
    maxRetries: 0
  },
  [ErrorCode.INVALID_PASSWORD]: {
    userMessage: 'The password you entered is incorrect',
    technicalMessage: 'Password validation failed - incorrect password for encrypted file',
    recoverySuggestions: [
      'Double-check your password and try again',
      'Make sure Caps Lock is not enabled',
      'If you forgot the password, you may need the original file owner to unlock it'
    ],
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 3
  },

  // Processing Errors
  [ErrorCode.CONVERSION_FAILED]: {
    userMessage: 'We couldn\'t convert your file',
    technicalMessage: 'File conversion process failed - conversion library error',
    recoverySuggestions: [
      'Make sure your file is not corrupted',
      'Try a different file or format',
      'If the file is very large, try compressing it first',
      'Wait a moment and try again'
    ],
    category: ErrorCategory.PROCESSING,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 2
  },
  [ErrorCode.COMPRESSION_FAILED]: {
    userMessage: 'We couldn\'t compress your file',
    technicalMessage: 'File compression process failed',
    recoverySuggestions: [
      'The file might already be highly compressed',
      'Try adjusting the compression quality settings',
      'Very small files may not compress well',
      'Make sure the file is not corrupted'
    ],
    category: ErrorCategory.PROCESSING,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 2
  },
  [ErrorCode.MERGE_FAILED]: {
    userMessage: 'We couldn\'t merge your files',
    technicalMessage: 'File merge operation failed',
    recoverySuggestions: [
      'Make sure all files are valid and not corrupted',
      'Check that all files are the same type',
      'Try merging fewer files at once',
      'Ensure files are not password-protected'
    ],
    category: ErrorCategory.PROCESSING,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 2
  },
  [ErrorCode.SPLIT_FAILED]: {
    userMessage: 'We couldn\'t split your file',
    technicalMessage: 'File split operation failed',
    recoverySuggestions: [
      'Make sure the file is not corrupted',
      'Check that page ranges are valid',
      'The file might be too small to split',
      'Try different split settings'
    ],
    category: ErrorCategory.PROCESSING,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 2
  },
  [ErrorCode.ROTATION_FAILED]: {
    userMessage: 'We couldn\'t rotate your file',
    technicalMessage: 'File rotation operation failed',
    recoverySuggestions: [
      'Make sure the file is not corrupted',
      'Try rotating one page at a time',
      'The file format might not support rotation',
      'Try again in a moment'
    ],
    category: ErrorCategory.PROCESSING,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 2
  },
  [ErrorCode.ENCRYPTION_FAILED]: {
    userMessage: 'We couldn\'t encrypt your file',
    technicalMessage: 'File encryption process failed',
    recoverySuggestions: [
      'Make sure your password meets the requirements',
      'Try a different password',
      'The file might already be encrypted',
      'Check that the file is not corrupted'
    ],
    category: ErrorCategory.PROCESSING,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 2
  },
  [ErrorCode.DECRYPTION_FAILED]: {
    userMessage: 'We couldn\'t decrypt your file',
    technicalMessage: 'File decryption process failed',
    recoverySuggestions: [
      'Make sure you entered the correct password',
      'The file might use an unsupported encryption method',
      'Try obtaining the file again from its source',
      'Check with the file owner for the correct password'
    ],
    category: ErrorCategory.PROCESSING,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    shouldRetry: false,
    maxRetries: 0
  },
  [ErrorCode.EXTRACTION_FAILED]: {
    userMessage: 'We couldn\'t extract content from your file',
    technicalMessage: 'Content extraction process failed',
    recoverySuggestions: [
      'Make sure the file contains extractable content',
      'The file might be corrupted or password-protected',
      'Try extracting specific pages instead of the whole file',
      'Try opening the file in its native application first'
    ],
    category: ErrorCategory.PROCESSING,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 2
  },
  [ErrorCode.RENDER_FAILED]: {
    userMessage: 'We couldn\'t display your file',
    technicalMessage: 'File rendering failed in browser',
    recoverySuggestions: [
      'Try refreshing the page',
      'Your browser might not support this file type',
      'Try using a different browser',
      'The file might be too complex to display'
    ],
    category: ErrorCategory.PROCESSING,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 1
  },
  [ErrorCode.PROCESSING_TIMEOUT]: {
    userMessage: 'The operation took too long and was cancelled',
    technicalMessage: 'Processing timeout exceeded maximum allowed duration',
    recoverySuggestions: [
      'The file might be too large or complex',
      'Try processing a smaller file or fewer pages',
      'Reduce quality settings if available',
      'Try again - the server might be busy'
    ],
    category: ErrorCategory.PROCESSING,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 1
  },
  [ErrorCode.UNSUPPORTED_OPERATION]: {
    userMessage: 'This operation is not supported for this file type',
    technicalMessage: 'Requested operation not supported for file format',
    recoverySuggestions: [
      'This file type doesn\'t support the requested operation',
      'Try converting to a different format first',
      'Check our supported formats documentation',
      'Try a different operation on this file'
    ],
    category: ErrorCategory.PROCESSING,
    severity: ErrorSeverity.LOW,
    recoverable: false,
    shouldRetry: false,
    maxRetries: 0
  },
  [ErrorCode.BACKGROUND_REMOVAL_FAILED]: {
    userMessage: 'We couldn\'t remove the background from your image',
    technicalMessage: 'Background removal processing failed',
    recoverySuggestions: [
      'Make sure the image has a clear subject',
      'Try an image with better contrast between subject and background',
      'The image might be too complex or low quality',
      'Try adjusting the image size or quality'
    ],
    category: ErrorCategory.PROCESSING,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 2
  },

  // Memory Errors
  [ErrorCode.OUT_OF_MEMORY]: {
    userMessage: 'Your device ran out of memory while processing the file',
    technicalMessage: 'Browser memory limit exceeded',
    recoverySuggestions: [
      'Close other browser tabs and applications',
      'Try processing a smaller file',
      'Restart your browser and try again',
      'Use a device with more memory if available'
    ],
    category: ErrorCategory.MEMORY,
    severity: ErrorSeverity.HIGH,
    recoverable: true,
    shouldRetry: false,
    maxRetries: 0
  },
  [ErrorCode.FILE_TOO_LARGE]: {
    userMessage: 'This file is too large to process on your device',
    technicalMessage: 'File size exceeds available memory capacity',
    recoverySuggestions: [
      'Try compressing the file first',
      'Split the file into smaller parts',
      'Process fewer pages at a time',
      'Use a device with more memory'
    ],
    category: ErrorCategory.MEMORY,
    severity: ErrorSeverity.HIGH,
    recoverable: true,
    shouldRetry: false,
    maxRetries: 0
  },
  [ErrorCode.MEMORY_LIMIT_EXCEEDED]: {
    userMessage: 'The operation requires more memory than available',
    technicalMessage: 'Memory allocation limit exceeded',
    recoverySuggestions: [
      'Close other applications and browser tabs',
      'Try a smaller file or fewer files',
      'Reduce quality settings if available',
      'Restart your browser to free up memory'
    ],
    category: ErrorCategory.MEMORY,
    severity: ErrorSeverity.HIGH,
    recoverable: true,
    shouldRetry: false,
    maxRetries: 0
  },
  [ErrorCode.BUFFER_OVERFLOW]: {
    userMessage: 'The file data exceeded processing limits',
    technicalMessage: 'Buffer overflow - data exceeds allocated memory',
    recoverySuggestions: [
      'Try a smaller or less complex file',
      'Split large files into smaller parts',
      'Reduce resolution or quality settings',
      'Contact support if the issue persists'
    ],
    category: ErrorCategory.MEMORY,
    severity: ErrorSeverity.HIGH,
    recoverable: false,
    shouldRetry: false,
    maxRetries: 0
  },

  // Network Errors
  [ErrorCode.NETWORK_ERROR]: {
    userMessage: 'A network error occurred',
    technicalMessage: 'Network request failed',
    recoverySuggestions: [
      'Check your internet connection',
      'Try again in a moment',
      'Disable VPN or proxy if using one',
      'Check your firewall settings'
    ],
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 3
  },
  [ErrorCode.REQUEST_TIMEOUT]: {
    userMessage: 'The request took too long and timed out',
    technicalMessage: 'Network request timeout',
    recoverySuggestions: [
      'Check your internet connection speed',
      'Try again - the server might be busy',
      'Try a smaller file if uploading',
      'Switch to a more stable network connection'
    ],
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 2
  },
  [ErrorCode.API_ERROR]: {
    userMessage: 'The service is temporarily unavailable',
    technicalMessage: 'API request failed with error response',
    recoverySuggestions: [
      'Try again in a few moments',
      'The service might be under maintenance',
      'Check our status page for updates',
      'Contact support if the issue persists'
    ],
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 2
  },
  [ErrorCode.CONNECTION_LOST]: {
    userMessage: 'Your internet connection was lost',
    technicalMessage: 'Network connection interrupted',
    recoverySuggestions: [
      'Check your internet connection',
      'Reconnect to your network',
      'Try again once connection is restored',
      'Switch to a more stable network if available'
    ],
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.HIGH,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 3
  },
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    userMessage: 'You\'ve made too many requests. Please wait a moment',
    technicalMessage: 'API rate limit exceeded',
    recoverySuggestions: [
      'Wait a few minutes before trying again',
      'Avoid making multiple requests simultaneously',
      'Process files one at a time',
      'Consider upgrading for higher limits'
    ],
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 1
  },
  [ErrorCode.SERVICE_UNAVAILABLE]: {
    userMessage: 'The service is currently unavailable',
    technicalMessage: 'Service temporarily unavailable - 503 error',
    recoverySuggestions: [
      'The service might be under maintenance',
      'Try again in a few minutes',
      'Check our status page for updates',
      'Contact support if this persists'
    ],
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.HIGH,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 2
  },

  // Unknown/Generic Errors
  [ErrorCode.UNKNOWN_ERROR]: {
    userMessage: 'An unexpected error occurred',
    technicalMessage: 'Unknown error - no specific error code matched',
    recoverySuggestions: [
      'Try refreshing the page',
      'Clear your browser cache and cookies',
      'Try again in a few moments',
      'Contact support if the issue persists'
    ],
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 1
  },
  [ErrorCode.INTERNAL_ERROR]: {
    userMessage: 'An internal error occurred',
    technicalMessage: 'Internal application error',
    recoverySuggestions: [
      'Try refreshing the page',
      'This issue has been logged for investigation',
      'Try again in a few moments',
      'Contact support with details of what you were doing'
    ],
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.HIGH,
    recoverable: true,
    shouldRetry: true,
    maxRetries: 1
  },
  [ErrorCode.CONFIGURATION_ERROR]: {
    userMessage: 'The application is not configured correctly',
    technicalMessage: 'Configuration error - missing or invalid settings',
    recoverySuggestions: [
      'Try refreshing the page',
      'Clear your browser cache',
      'This issue has been reported',
      'Contact support for assistance'
    ],
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.HIGH,
    recoverable: false,
    shouldRetry: false,
    maxRetries: 0
  },
  [ErrorCode.BROWSER_NOT_SUPPORTED]: {
    userMessage: 'Your browser is not fully supported',
    technicalMessage: 'Browser lacks required features or APIs',
    recoverySuggestions: [
      'Update your browser to the latest version',
      'Try using Chrome, Firefox, Safari, or Edge',
      'Enable JavaScript if disabled',
      'Some features may not work in older browsers'
    ],
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.MEDIUM,
    recoverable: false,
    shouldRetry: false,
    maxRetries: 0
  },
  [ErrorCode.FEATURE_NOT_AVAILABLE]: {
    userMessage: 'This feature is not available',
    technicalMessage: 'Requested feature not available in current environment',
    recoverySuggestions: [
      'This feature might be in development',
      'Your plan might not include this feature',
      'Check if browser permissions are granted',
      'Try a different browser or device'
    ],
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.LOW,
    recoverable: false,
    shouldRetry: false,
    maxRetries: 0
  }
};

/**
 * Get user-friendly error message
 */
export const getUserFriendlyMessage = (error: Error | AppError | ErrorCode): string => {
  if (error instanceof AppError) {
    return ERROR_METADATA[error.code]?.userMessage || 'An unexpected error occurred';
  }

  if (typeof error === 'number') {
    return ERROR_METADATA[error]?.userMessage || 'An unexpected error occurred';
  }

  // Handle generic errors
  if (error.message.toLowerCase().includes('network')) {
    return ERROR_METADATA[ErrorCode.NETWORK_ERROR].userMessage;
  }
  if (error.message.toLowerCase().includes('memory')) {
    return ERROR_METADATA[ErrorCode.OUT_OF_MEMORY].userMessage;
  }
  if (error.message.toLowerCase().includes('timeout')) {
    return ERROR_METADATA[ErrorCode.REQUEST_TIMEOUT].userMessage;
  }

  return ERROR_METADATA[ErrorCode.UNKNOWN_ERROR].userMessage;
};

/**
 * Get technical error message
 */
export const getTechnicalMessage = (error: Error | AppError | ErrorCode): string => {
  if (error instanceof AppError) {
    return ERROR_METADATA[error.code]?.technicalMessage || error.message;
  }

  if (typeof error === 'number') {
    return ERROR_METADATA[error]?.technicalMessage || 'Unknown error';
  }

  return error.message || 'Unknown error';
};

/**
 * Get recovery suggestions for an error
 */
export const getRecoverySuggestions = (error: Error | AppError | ErrorCode): string[] => {
  if (error instanceof AppError) {
    return ERROR_METADATA[error.code]?.recoverySuggestions || [];
  }

  if (typeof error === 'number') {
    return ERROR_METADATA[error]?.recoverySuggestions || [];
  }

  // Generic recovery suggestions for unknown errors
  return [
    'Try refreshing the page',
    'Check your internet connection',
    'Try again in a few moments',
    'Contact support if the issue persists'
  ];
};

/**
 * Check if an error is recoverable
 */
export const isRecoverable = (error: Error | AppError | ErrorCode): boolean => {
  if (error instanceof AppError) {
    return error.recoverable;
  }

  if (typeof error === 'number') {
    return ERROR_METADATA[error]?.recoverable ?? true;
  }

  // Assume generic errors are recoverable
  return true;
};

/**
 * Check if an error should trigger a retry
 */
export const shouldRetry = (error: Error | AppError | ErrorCode, attemptCount: number = 0): boolean => {
  let metadata: ErrorMetadata | undefined;

  if (error instanceof AppError) {
    metadata = ERROR_METADATA[error.code];
  } else if (typeof error === 'number') {
    metadata = ERROR_METADATA[error];
  }

  if (!metadata) {
    // For generic errors, allow one retry
    return attemptCount < 1;
  }

  return metadata.shouldRetry && attemptCount < metadata.maxRetries;
};

/**
 * Get maximum retry attempts for an error
 */
export const getMaxRetries = (error: Error | AppError | ErrorCode): number => {
  if (error instanceof AppError) {
    return ERROR_METADATA[error.code]?.maxRetries || 0;
  }

  if (typeof error === 'number') {
    return ERROR_METADATA[error]?.maxRetries || 0;
  }

  return 1; // Default for unknown errors
};

/**
 * Get error category
 */
export const getErrorCategory = (error: Error | AppError | ErrorCode): ErrorCategory => {
  if (error instanceof AppError) {
    return error.category;
  }

  if (typeof error === 'number') {
    return ERROR_METADATA[error]?.category || ErrorCategory.UNKNOWN;
  }

  // Infer category from error message
  const message = error.message.toLowerCase();
  if (message.includes('network') || message.includes('connection')) {
    return ErrorCategory.NETWORK;
  }
  if (message.includes('memory') || message.includes('heap')) {
    return ErrorCategory.MEMORY;
  }
  if (message.includes('invalid') || message.includes('validation')) {
    return ErrorCategory.VALIDATION;
  }

  return ErrorCategory.UNKNOWN;
};

/**
 * Get error severity
 */
export const getErrorSeverity = (error: Error | AppError | ErrorCode): ErrorSeverity => {
  if (error instanceof AppError) {
    return error.severity;
  }

  if (typeof error === 'number') {
    return ERROR_METADATA[error]?.severity || ErrorSeverity.MEDIUM;
  }

  return ErrorSeverity.MEDIUM;
};

/**
 * Log error with full context
 */
export const logError = (
  error: Error | AppError,
  context?: Record<string, any>,
  includeStackTrace: boolean = true
): void => {
  const category = getErrorCategory(error);
  const severity = getErrorSeverity(error);
  const userMessage = getUserFriendlyMessage(error);
  const technicalMessage = getTechnicalMessage(error);

  const logContext = {
    category,
    severity,
    userMessage,
    technicalMessage,
    code: error instanceof AppError ? error.code : undefined,
    recoverable: isRecoverable(error),
    timestamp: error instanceof AppError ? error.timestamp : new Date(),
    ...context,
    ...(error instanceof AppError ? error.context : {})
  };

  // Log to monitoring system
  if (severity === ErrorSeverity.CRITICAL) {
    logger.critical(technicalMessage, error, logContext);
  } else if (severity === ErrorSeverity.HIGH) {
    logger.error(technicalMessage, error, logContext);
  } else if (severity === ErrorSeverity.MEDIUM) {
    logger.warn(technicalMessage, logContext);
  } else {
    logger.info(technicalMessage, logContext);
  }

  // Track error
  errorTracker.trackError(error, logContext);
};

/**
 * Create validation error
 */
export const createValidationError = (
  code: ErrorCode,
  context?: Record<string, any>
): AppError => {
  const metadata = ERROR_METADATA[code];
  return new AppError(
    metadata.technicalMessage,
    code,
    ErrorCategory.VALIDATION,
    metadata.severity,
    metadata.recoverable,
    context
  );
};

/**
 * Create processing error
 */
export const createProcessingError = (
  code: ErrorCode,
  context?: Record<string, any>
): AppError => {
  const metadata = ERROR_METADATA[code];
  return new AppError(
    metadata.technicalMessage,
    code,
    ErrorCategory.PROCESSING,
    metadata.severity,
    metadata.recoverable,
    context
  );
};

/**
 * Create memory error
 */
export const createMemoryError = (
  code: ErrorCode,
  context?: Record<string, any>
): AppError => {
  const metadata = ERROR_METADATA[code];
  return new AppError(
    metadata.technicalMessage,
    code,
    ErrorCategory.MEMORY,
    metadata.severity,
    metadata.recoverable,
    context
  );
};

/**
 * Create network error
 */
export const createNetworkError = (
  code: ErrorCode,
  context?: Record<string, any>
): AppError => {
  const metadata = ERROR_METADATA[code];
  return new AppError(
    metadata.technicalMessage,
    code,
    ErrorCategory.NETWORK,
    metadata.severity,
    metadata.recoverable,
    context
  );
};

/**
 * Wrap an unknown error into AppError
 */
export const wrapError = (
  error: unknown,
  defaultCode: ErrorCode = ErrorCode.UNKNOWN_ERROR,
  context?: Record<string, any>
): AppError => {
  // If already an AppError, return as-is
  if (error instanceof AppError) {
    return error;
  }

  // If it's a standard Error
  if (error instanceof Error) {
    const metadata = ERROR_METADATA[defaultCode];
    return new AppError(
      error.message,
      defaultCode,
      metadata.category,
      metadata.severity,
      metadata.recoverable,
      { ...context, originalError: error.name }
    );
  }

  // Handle non-Error objects
  const metadata = ERROR_METADATA[defaultCode];
  return new AppError(
    String(error),
    defaultCode,
    metadata.category,
    metadata.severity,
    metadata.recoverable,
    context
  );
};

/**
 * Retry wrapper for async operations
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  errorCode: ErrorCode = ErrorCode.UNKNOWN_ERROR,
  context?: Record<string, any>
): Promise<T> => {
  const maxRetries = ERROR_METADATA[errorCode]?.maxRetries || 0;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const appError = wrapError(error, errorCode, {
        ...context,
        attempt: attempt + 1,
        maxRetries: maxRetries + 1
      });

      // Log the error
      logError(appError, { attempt: attempt + 1 });

      // Check if we should retry
      if (!shouldRetry(appError, attempt)) {
        throw appError;
      }

      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // If we've exhausted all retries
  throw wrapError(
    lastError || new Error('Operation failed after retries'),
    errorCode,
    { ...context, retriesExhausted: true }
  );
};

/**
 * Error boundary integration helper
 */
export const handleError = (
  error: unknown,
  fallbackCode: ErrorCode = ErrorCode.UNKNOWN_ERROR
): {
  appError: AppError;
  userMessage: string;
  recoverySuggestions: string[];
  shouldShowDetails: boolean;
} => {
  const appError = wrapError(error, fallbackCode);

  // Log the error
  logError(appError);

  return {
    appError,
    userMessage: getUserFriendlyMessage(appError),
    recoverySuggestions: getRecoverySuggestions(appError),
    shouldShowDetails: process.env.NODE_ENV === 'development'
  };
};

/**
 * React hook for error handling
 */
export interface UseErrorHandlerReturn {
  error: AppError | null;
  setError: (error: Error | AppError | null) => void;
  clearError: () => void;
  userMessage: string;
  recoverySuggestions: string[];
  isRecoverable: boolean;
  handleError: (error: unknown, code?: ErrorCode) => void;
}

/**
 * Format error for display
 */
export const formatErrorForDisplay = (error: Error | AppError): {
  title: string;
  message: string;
  suggestions: string[];
  severity: ErrorSeverity;
  code?: ErrorCode;
} => {
  const appError = error instanceof AppError ? error : wrapError(error);

  return {
    title: getSeverityTitle(appError.severity),
    message: getUserFriendlyMessage(appError),
    suggestions: getRecoverySuggestions(appError),
    severity: appError.severity,
    code: appError.code
  };
};

/**
 * Get title based on severity
 */
const getSeverityTitle = (severity: ErrorSeverity): string => {
  switch (severity) {
    case ErrorSeverity.CRITICAL:
      return 'Critical Error';
    case ErrorSeverity.HIGH:
      return 'Error';
    case ErrorSeverity.MEDIUM:
      return 'Something went wrong';
    case ErrorSeverity.LOW:
      return 'Notice';
    default:
      return 'Error';
  }
};

/**
 * Export error report for debugging
 */
export const exportErrorReport = (error: Error | AppError, context?: Record<string, any>): string => {
  const appError = error instanceof AppError ? error : wrapError(error);

  const report = {
    timestamp: new Date().toISOString(),
    error: {
      code: appError.code,
      category: appError.category,
      severity: appError.severity,
      message: appError.message,
      stack: appError.stack,
      recoverable: appError.recoverable
    },
    userMessage: getUserFriendlyMessage(appError),
    technicalMessage: getTechnicalMessage(appError),
    recoverySuggestions: getRecoverySuggestions(appError),
    context: {
      ...appError.context,
      ...context
    },
    environment: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      online: navigator.onLine,
      cookiesEnabled: navigator.cookieEnabled
    }
  };

  return JSON.stringify(report, null, 2);
};
