/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Security utilities for production environment
 */

// File type whitelist - only allow specific MIME types
export const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif'
] as const;

export const ALLOWED_PDF_TYPES = [
    'application/pdf'
] as const;

export const ALLOWED_AUDIO_TYPES = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/m4a',
    'audio/aac'
] as const;

export const ALLOWED_DOCUMENT_TYPES = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
] as const;

// File size limits (in bytes)
export const MAX_FILE_SIZES = {
    image: 10 * 1024 * 1024, // 10MB
    pdf: 50 * 1024 * 1024,   // 50MB
    audio: 20 * 1024 * 1024,  // 20MB
    document: 25 * 1024 * 1024 // 25MB
} as const;

/**
 * Validate file type against whitelist
 */
export const validateFileType = (
    file: File,
    allowedTypes: readonly string[]
): { valid: boolean; error?: string } => {
    // Check MIME type
    if (!allowedTypes.includes(file.type)) {
        // Also check file extension as fallback
        const extension = file.name.toLowerCase().split('.').pop();
        const isValidExtension = allowedTypes.some(type => {
            const ext = type.split('/')[1];
            return extension === ext || extension === ext.replace('x-', '');
        });

        if (!isValidExtension) {
            return {
                valid: false,
                error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
            };
        }
    }

    return { valid: true };
};

/**
 * Validate file size
 */
export const validateFileSize = (
    file: File,
    maxSize: number
): { valid: boolean; error?: string } => {
    if (file.size > maxSize) {
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
        return {
            valid: false,
            error: `File too large. Maximum size: ${maxSizeMB}MB`
        };
    }

    if (file.size === 0) {
        return {
            valid: false,
            error: 'File is empty'
        };
    }

    return { valid: true };
};

/**
 * Sanitize filename to prevent path traversal attacks
 */
export const sanitizeFilename = (filename: string): string => {
    // Remove path separators and other dangerous characters
    return filename
        .replace(/[/\\]/g, '_')
        .replace(/\.\./g, '_')
        .replace(/[<>:"|?*]/g, '_')
        .replace(/\0/g, '_')
        .trim()
        .slice(0, 255); // Limit filename length
};

/**
 * Rate limiting for API calls
 */
class RateLimiter {
    private requests: number[] = [];
    private readonly maxRequests: number;
    private readonly windowMs: number;

    constructor(maxRequests: number, windowMs: number) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }

    isAllowed(): boolean {
        const now = Date.now();

        // Remove old requests outside the time window
        this.requests = this.requests.filter(time => now - time < this.windowMs);

        if (this.requests.length >= this.maxRequests) {
            return false;
        }

        this.requests.push(now);
        return true;
    }

    getRemainingRequests(): number {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.windowMs);
        return Math.max(0, this.maxRequests - this.requests.length);
    }

    getResetTime(): number {
        if (this.requests.length === 0) return 0;
        return this.requests[0] + this.windowMs;
    }
}

// Rate limiters for different operations
export const apiRateLimiter = new RateLimiter(10, 60000); // 10 requests per minute
export const conversionRateLimiter = new RateLimiter(5, 60000); // 5 conversions per minute

/**
 * Content Security Policy headers (for meta tag)
 */
export const CSP_POLICY = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: blob:;
    connect-src 'self' https://generativelanguage.googleapis.com;
    worker-src 'self' blob:;
`.replace(/\s+/g, ' ').trim();

/**
 * Validate and sanitize user input
 */
export const sanitizeInput = (input: string, maxLength: number = 1000): string => {
    return input
        .trim()
        .slice(0, maxLength)
        .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, ''); // Remove event handlers
};

/**
 * Check if file appears to be malicious based on content
 */
export const validateFileContent = async (file: File): Promise<{ valid: boolean; error?: string }> => {
    try {
        // Read first 1KB of file to check for suspicious content
        const chunk = file.slice(0, 1024);
        const text = await chunk.text();

        // Check for executable signatures
        const suspiciousPatterns = [
            /MZ\x90\x00/,  // PE executable
            /\x7FELF/,      // ELF executable
            /#!\//,         // Shebang (script)
        ];

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(text)) {
                return {
                    valid: false,
                    error: 'File appears to contain executable code'
                };
            }
        }

        return { valid: true };
    } catch (error) {
        // If we can't read the file, fail safe
        return {
            valid: false,
            error: 'Unable to validate file content'
        };
    }
};

/**
 * Generate secure random ID for file tracking
 */
export const generateSecureId = (): string => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};
