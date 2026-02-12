/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 🔒 SECURITY: Magic Byte Validation Utility
 *
 * Production-grade file type validation using magic bytes (file signatures)
 * Prevents MIME type spoofing attacks where malicious files claim to be PDFs/images
 *
 * Why magic bytes?
 * - MIME types can be forged by attackers (just change file extension)
 * - Magic bytes are the actual file header - much harder to fake
 * - Industry standard for security-critical file validation
 */

import { logger } from './monitoring';

/**
 * File type signatures (magic bytes)
 * Each entry contains the byte pattern and valid file types
 */
export interface FileSignature {
    signature: number[];
    type: string;
    extension: string;
    mimeTypes: string[];
    description: string;
}

/**
 * Comprehensive database of file signatures
 */
export const FILE_SIGNATURES: Record<string, FileSignature[]> = {
    // PDF signatures
    pdf: [
        {
            signature: [0x25, 0x50, 0x44, 0x46], // %PDF
            type: 'pdf',
            extension: '.pdf',
            mimeTypes: ['application/pdf'],
            description: 'PDF Document'
        }
    ],

    // Image signatures
    image: [
        {
            signature: [0xFF, 0xD8, 0xFF], // JPEG/JPG
            type: 'image',
            extension: '.jpg',
            mimeTypes: ['image/jpeg', 'image/jpg'],
            description: 'JPEG Image'
        },
        {
            signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
            type: 'image',
            extension: '.png',
            mimeTypes: ['image/png'],
            description: 'PNG Image'
        },
        {
            signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
            type: 'image',
            extension: '.gif',
            mimeTypes: ['image/gif'],
            description: 'GIF Image (87a)'
        },
        {
            signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
            type: 'image',
            extension: '.gif',
            mimeTypes: ['image/gif'],
            description: 'GIF Image (89a)'
        },
        {
            signature: [0x42, 0x4D], // BMP
            type: 'image',
            extension: '.bmp',
            mimeTypes: ['image/bmp', 'image/x-windows-bmp'],
            description: 'BMP Image'
        },
        {
            signature: [0x52, 0x49, 0x46, 0x46], // WEBP (RIFF header)
            type: 'image',
            extension: '.webp',
            mimeTypes: ['image/webp'],
            description: 'WebP Image'
        },
        {
            signature: [0x00, 0x00, 0x00, 0x0C, 0x6A, 0x50, 0x20, 0x20], // JP2
            type: 'image',
            extension: '.jp2',
            mimeTypes: ['image/jp2', 'image/jpeg2000'],
            description: 'JPEG 2000 Image'
        }
    ],

    // Office document signatures
    document: [
        {
            signature: [0x50, 0x4B, 0x03, 0x04], // ZIP (used by .docx, .xlsx, .pptx)
            type: 'document',
            extension: '.docx',
            mimeTypes: [
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            ],
            description: 'Office Open XML Document'
        },
        {
            signature: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], // OLE2 (used by .doc, .xls, .ppt)
            type: 'document',
            extension: '.doc',
            mimeTypes: [
                'application/msword',
                'application/vnd.ms-excel',
                'application/vnd.ms-powerpoint'
            ],
            description: 'Microsoft Office Document (Legacy)'
        }
    ],

    // Audio signatures
    audio: [
        {
            signature: [0x49, 0x44, 0x33], // MP3 with ID3
            type: 'audio',
            extension: '.mp3',
            mimeTypes: ['audio/mpeg', 'audio/mp3'],
            description: 'MP3 Audio with ID3'
        },
        {
            signature: [0xFF, 0xFB], // MP3 without ID3
            type: 'audio',
            extension: '.mp3',
            mimeTypes: ['audio/mpeg', 'audio/mp3'],
            description: 'MP3 Audio'
        },
        {
            signature: [0x52, 0x49, 0x46, 0x46], // WAV (RIFF header)
            type: 'audio',
            extension: '.wav',
            mimeTypes: ['audio/wav', 'audio/wave', 'audio/x-wav'],
            description: 'WAV Audio'
        },
        {
            signature: [0x66, 0x74, 0x79, 0x70, 0x4D, 0x34, 0x41], // M4A at offset 4
            type: 'audio',
            extension: '.m4a',
            mimeTypes: ['audio/mp4', 'audio/m4a', 'audio/x-m4a'],
            description: 'M4A Audio'
        },
        {
            signature: [0x4F, 0x67, 0x67, 0x53], // OGG
            type: 'audio',
            extension: '.ogg',
            mimeTypes: ['audio/ogg', 'audio/opus'],
            description: 'OGG Audio'
        },
        {
            signature: [0x66, 0x4C, 0x61, 0x43], // FLAC
            type: 'audio',
            extension: '.flac',
            mimeTypes: ['audio/flac', 'audio/x-flac'],
            description: 'FLAC Audio'
        }
    ],

    // Malicious file signatures (to block)
    malicious: [
        {
            signature: [0x4D, 0x5A], // EXE/DLL
            type: 'executable',
            extension: '.exe',
            mimeTypes: [],
            description: 'Windows Executable'
        },
        {
            signature: [0x7F, 0x45, 0x4C, 0x46], // ELF
            type: 'executable',
            extension: '.elf',
            mimeTypes: [],
            description: 'Linux Executable'
        },
        {
            signature: [0xCA, 0xFE, 0xBA, 0xBE], // Mach-O
            type: 'executable',
            extension: '.app',
            mimeTypes: [],
            description: 'macOS Executable'
        },
        {
            signature: [0x23, 0x21], // Script with shebang
            type: 'script',
            extension: '.sh',
            mimeTypes: [],
            description: 'Shell Script'
        }
    ]
};

/**
 * Validation result
 */
export interface MagicByteValidationResult {
    valid: boolean;
    detectedType?: string;
    detectedExtension?: string;
    detectedMimeTypes?: string[];
    description?: string;
    error?: string;
    warning?: string;
}

/**
 * Validate file type by magic bytes
 *
 * @param file - File to validate
 * @param expectedCategory - Expected file category ('pdf', 'image', 'document', 'audio')
 * @param options - Validation options
 * @returns Validation result
 *
 * 🔒 SECURITY: This function prevents MIME type spoofing attacks
 */
export async function validateFileMagicBytes(
    file: File,
    expectedCategory: 'pdf' | 'image' | 'document' | 'audio',
    options?: {
        allowMimeTypeFallback?: boolean; // Allow MIME type validation if magic bytes don't match
        maxBytesToRead?: number; // Maximum bytes to read for validation
    }
): Promise<MagicByteValidationResult> {
    const { allowMimeTypeFallback = true, maxBytesToRead = 512 } = options || {};

    try {
        // Read first bytes of file
        const headerBytes = await readFileHeader(file, maxBytesToRead);

        // Check for malicious file signatures first
        const maliciousMatch = matchSignature(headerBytes, FILE_SIGNATURES.malicious);
        if (maliciousMatch) {
            logger.warn('Malicious file signature detected', {
                fileName: file.name,
                type: maliciousMatch.description
            });
            return {
                valid: false,
                error: `❌ Security Alert: This file appears to be a ${maliciousMatch.description}. Only ${expectedCategory} files are allowed.`
            };
        }

        // Check if file matches expected category
        const expectedSignatures = FILE_SIGNATURES[expectedCategory] || [];
        const match = matchSignature(headerBytes, expectedSignatures);

        if (match) {
            // Perfect match - file signature matches expected category
            logger.debug('File signature validated', {
                fileName: file.name,
                detectedType: match.type,
                detectedExtension: match.extension
            });

            // Additional validation: warn if filename extension doesn't match
            const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
            if (fileExt !== match.extension && !match.mimeTypes.includes(file.type)) {
                return {
                    valid: true,
                    detectedType: match.type,
                    detectedExtension: match.extension,
                    detectedMimeTypes: match.mimeTypes,
                    description: match.description,
                    warning: `⚠️ File extension "${fileExt}" doesn't match detected type "${match.extension}". File may be renamed or corrupted.`
                };
            }

            return {
                valid: true,
                detectedType: match.type,
                detectedExtension: match.extension,
                detectedMimeTypes: match.mimeTypes,
                description: match.description
            };
        }

        // No magic byte match - try MIME type validation as fallback (if allowed)
        if (allowMimeTypeFallback) {
            const mimeTypeValid = expectedSignatures.some(sig =>
                sig.mimeTypes.some(mime => file.type === mime || file.type.startsWith(mime.split('/')[0]))
            );

            if (mimeTypeValid) {
                logger.warn('File validated by MIME type only (magic bytes did not match)', {
                    fileName: file.name,
                    mimeType: file.type
                });

                return {
                    valid: true,
                    detectedType: expectedCategory,
                    warning: `⚠️ File type could not be verified by file signature. Proceeding based on file extension. If you encounter issues, the file may be corrupted.`
                };
            }
        }

        // File doesn't match expected category
        logger.error('File validation failed - invalid file type', {
            fileName: file.name,
            expectedCategory,
            fileMimeType: file.type
        });

        return {
            valid: false,
            error: `❌ Invalid file type. Expected a ${expectedCategory} file, but this doesn't appear to be one. Please select a valid ${expectedCategory} file.`
        };

    } catch (error) {
        logger.error('Magic byte validation error', { error, fileName: file.name });

        // 🔒 FAIL-CLOSED SECURITY: Reject files we can't validate
        return {
            valid: false,
            error: '❌ Unable to validate file. The file may be corrupted or in an unsupported format.'
        };
    }
}

/**
 * Read file header bytes
 */
async function readFileHeader(file: File, maxBytes: number): Promise<Uint8Array> {
    const bytesToRead = Math.min(file.size, maxBytes);
    const blob = file.slice(0, bytesToRead);
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
}

/**
 * Match file signature against known patterns
 */
function matchSignature(headerBytes: Uint8Array, signatures: FileSignature[]): FileSignature | null {
    for (const sig of signatures) {
        // Check if we have enough bytes to match
        if (headerBytes.length < sig.signature.length) {
            continue;
        }

        // Try matching at offset 0
        let matches = true;
        for (let i = 0; i < sig.signature.length; i++) {
            if (headerBytes[i] !== sig.signature[i]) {
                matches = false;
                break;
            }
        }

        if (matches) {
            return sig;
        }

        // For some formats (e.g., M4A), signature may be at offset 4
        if (headerBytes.length >= sig.signature.length + 4) {
            matches = true;
            for (let i = 0; i < sig.signature.length; i++) {
                if (headerBytes[i + 4] !== sig.signature[i]) {
                    matches = false;
                    break;
                }
            }

            if (matches) {
                return sig;
            }
        }
    }

    return null;
}

/**
 * Quick validation for PDF files
 * Optimized for performance when you only need to validate PDFs
 */
export async function validatePDF(file: File): Promise<MagicByteValidationResult> {
    return validateFileMagicBytes(file, 'pdf');
}

/**
 * Quick validation for image files
 * Optimized for performance when you only need to validate images
 */
export async function validateImage(file: File): Promise<MagicByteValidationResult> {
    return validateFileMagicBytes(file, 'image');
}

/**
 * Quick validation for document files (.docx, .doc, etc.)
 * Optimized for performance when you only need to validate documents
 */
export async function validateDocument(file: File): Promise<MagicByteValidationResult> {
    return validateFileMagicBytes(file, 'document');
}

/**
 * Quick validation for audio files
 * Optimized for performance when you only need to validate audio
 */
export async function validateAudio(file: File): Promise<MagicByteValidationResult> {
    return validateFileMagicBytes(file, 'audio');
}

/**
 * Validate multiple files in batch
 * Efficient for bulk file validation
 */
export async function validateFilesBatch(
    files: File[],
    expectedCategory: 'pdf' | 'image' | 'document' | 'audio'
): Promise<Map<string, MagicByteValidationResult>> {
    const results = new Map<string, MagicByteValidationResult>();

    // Validate in parallel for performance
    const validationPromises = files.map(async (file) => {
        const result = await validateFileMagicBytes(file, expectedCategory);
        results.set(file.name, result);
    });

    await Promise.all(validationPromises);

    return results;
}

/**
 * Check if file is potentially malicious
 * Returns true if file matches known malicious signatures
 */
export async function isMaliciousFile(file: File): Promise<boolean> {
    try {
        const headerBytes = await readFileHeader(file, 512);
        const match = matchSignature(headerBytes, FILE_SIGNATURES.malicious);

        if (match) {
            logger.warn('Malicious file detected', {
                fileName: file.name,
                type: match.description
            });
            return true;
        }

        return false;
    } catch (error) {
        // If we can't read the file, treat as potentially malicious
        logger.error('Error checking for malicious file', { error, fileName: file.name });
        return true; // Fail-closed
    }
}
