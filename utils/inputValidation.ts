/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from './monitoring';

/**
 * Comprehensive Input Validation and Sanitization Utilities
 * Prevents XSS, injection attacks, and malicious file uploads
 */

// File type validation constants
export const ALLOWED_FILE_TYPES = {
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'],
  pdf: ['application/pdf'],
  audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac', 'audio/wma', 'audio/flac', 'audio/aiff', 'audio/alac', 'audio/amr', 'audio/opus', 'audio/webm'],
  document: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
};

export const ALLOWED_FILE_EXTENSIONS = {
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'],
  pdf: ['.pdf'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.wma', '.flac', '.aiff', '.alac', '.amr', '.opus', '.webm'],
  document: ['.docx', '.doc']
};

// File size limits (in bytes)
export const MAX_FILE_SIZES = {
  image: 20 * 1024 * 1024,      // 20MB
  pdf: 100 * 1024 * 1024,       // 100MB
  audio: 50 * 1024 * 1024,      // 50MB
  document: 50 * 1024 * 1024    // 50MB
};

// Malicious file signatures (magic bytes)
const MALICIOUS_SIGNATURES = [
  { bytes: [0x4D, 0x5A], name: 'EXE' },                    // .exe
  { bytes: [0x50, 0x4B, 0x03, 0x04], name: 'ZIP/JAR' },    // Could contain malware
  { bytes: [0x7F, 0x45, 0x4C, 0x46], name: 'ELF' },        // Linux executable
  { bytes: [0xCA, 0xFE, 0xBA, 0xBE], name: 'Mach-O' },     // macOS executable
  { bytes: [0x23, 0x21], name: 'Script' },                 // Shebang script
];

/**
 * Sanitize filename to prevent path traversal and injection
 */
export const sanitizeFilename = (filename: string): string => {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename');
  }

  // Remove path separators and parent directory references
  let sanitized = filename
    .replace(/\.\./g, '')
    .replace(/[/\\]/g, '_')
    .replace(/[<>:"|?*]/g, '_')
    .replace(/\x00/g, '')
    .trim();

  // Limit filename length
  if (sanitized.length > 255) {
    const ext = sanitized.slice(sanitized.lastIndexOf('.'));
    sanitized = sanitized.slice(0, 200) + ext;
  }

  // Ensure filename is not empty after sanitization
  if (!sanitized || sanitized === '.') {
    throw new Error('Invalid filename after sanitization');
  }

  return sanitized;
};

/**
 * Validate file type by MIME type and extension
 */
export const validateFileType = (
  file: File,
  category: 'image' | 'pdf' | 'audio' | 'document'
): { valid: boolean; error?: string } => {
  try {
    // Check if file exists
    if (!file || !(file instanceof File)) {
      return { valid: false, error: 'Invalid file object' };
    }

    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();

    // Check extension
    const hasValidExtension = ALLOWED_FILE_EXTENSIONS[category].some(ext =>
      fileName.endsWith(ext.toLowerCase())
    );

    // Check MIME type (if provided by browser)
    const hasValidMimeType = fileType ? ALLOWED_FILE_TYPES[category].some(mime =>
      fileType === mime.toLowerCase()
    ) : false;

    // Accept if either extension or MIME type is valid
    // (Some browsers don't set MIME type correctly)
    if (!hasValidExtension && !hasValidMimeType) {
      return {
        valid: false,
        error: `Invalid file type. Allowed: ${ALLOWED_FILE_EXTENSIONS[category].join(', ')}`
      };
    }

    return { valid: true };
  } catch (error) {
    logger.error('File type validation error', { error });
    return { valid: false, error: 'File validation failed' };
  }
};

/**
 * Validate file size
 */
export const validateFileSize = (
  file: File,
  category: 'image' | 'pdf' | 'audio' | 'document'
): { valid: boolean; error?: string } => {
  try {
    if (!file || !(file instanceof File)) {
      return { valid: false, error: 'Invalid file object' };
    }

    const maxSize = MAX_FILE_SIZES[category];

    if (file.size === 0) {
      return { valid: false, error: 'File is empty' };
    }

    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      return {
        valid: false,
        error: `File too large. Maximum size: ${maxSizeMB}MB`
      };
    }

    return { valid: true };
  } catch (error) {
    logger.error('File size validation error', { error });
    return { valid: false, error: 'File size validation failed' };
  }
};

/**
 * Scan file content for malicious signatures
 */
export const scanFileContent = async (file: File): Promise<{ safe: boolean; threat?: string }> => {
  try {
    // Read first 1KB of file
    const chunk = file.slice(0, 1024);
    const buffer = await chunk.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Check against known malicious signatures
    for (const signature of MALICIOUS_SIGNATURES) {
      let matches = true;
      for (let i = 0; i < signature.bytes.length; i++) {
        if (bytes[i] !== signature.bytes[i]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        logger.warn('Malicious file signature detected', {
          fileName: file.name,
          signature: signature.name
        });
        return {
          safe: false,
          threat: `Suspicious file type detected: ${signature.name}`
        };
      }
    }

    return { safe: true };
  } catch (error) {
    logger.error('File content scan error', { error });
    // Fail open to not block legitimate files
    return { safe: true };
  }
};

/**
 * Comprehensive file validation
 */
export const validateFile = async (
  file: File,
  category: 'image' | 'pdf' | 'audio' | 'document'
): Promise<{ valid: boolean; error?: string }> => {
  try {
    // 1. Basic validation
    if (!file || !(file instanceof File)) {
      return { valid: false, error: 'Invalid file' };
    }

    // 2. Sanitize and validate filename
    try {
      sanitizeFilename(file.name);
    } catch (error) {
      return { valid: false, error: 'Invalid filename' };
    }

    // 3. Validate file type
    const typeValidation = validateFileType(file, category);
    if (!typeValidation.valid) {
      return typeValidation;
    }

    // 4. Validate file size
    const sizeValidation = validateFileSize(file, category);
    if (!sizeValidation.valid) {
      return sizeValidation;
    }

    // 5. Scan for malicious content
    const contentScan = await scanFileContent(file);
    if (!contentScan.safe) {
      return { valid: false, error: contentScan.threat };
    }

    logger.info('File validation passed', {
      fileName: file.name,
      size: file.size,
      type: file.type
    });

    return { valid: true };
  } catch (error) {
    logger.error('File validation error', { error });
    return { valid: false, error: 'File validation failed' };
  }
};

/**
 * Sanitize text input to prevent XSS
 */
export const sanitizeTextInput = (input: string, maxLength: number = 1000): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }

  return sanitized;
};

/**
 * Validate number input
 */
export const validateNumber = (
  value: any,
  min?: number,
  max?: number
): { valid: boolean; value?: number; error?: string } => {
  const num = Number(value);

  if (isNaN(num) || !isFinite(num)) {
    return { valid: false, error: 'Invalid number' };
  }

  if (min !== undefined && num < min) {
    return { valid: false, error: `Value must be at least ${min}` };
  }

  if (max !== undefined && num > max) {
    return { valid: false, error: `Value must be at most ${max}` };
  }

  return { valid: true, value: num };
};

/**
 * Validate slider/range input
 */
export const validateRange = (
  value: any,
  min: number,
  max: number
): { valid: boolean; value?: number; error?: string } => {
  return validateNumber(value, min, max);
};

/**
 * Prevent prototype pollution
 */
export const sanitizeObject = <T extends Record<string, any>>(obj: T): T => {
  const sanitized = { ...obj };

  // Remove dangerous properties
  delete sanitized.__proto__;
  delete sanitized.constructor;
  delete sanitized.prototype;

  return sanitized;
};
