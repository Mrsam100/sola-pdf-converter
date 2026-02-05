/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Production-level ZIP file generator for batch downloads
 * Optimized for large files with memory-efficient streaming
 */

import JSZip from 'jszip';

/**
 * Compression levels for ZIP generation
 */
export type CompressionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * File input for ZIP generation
 */
export interface ZipFileInput {
  /** File name in the ZIP archive */
  name: string;
  /** File data as Blob, Uint8Array, or ArrayBuffer */
  data: Blob | Uint8Array | ArrayBuffer;
  /** Optional folder path within the ZIP (e.g., 'documents/pdfs') */
  folder?: string;
  /** Optional last modified date */
  lastModified?: Date;
}

/**
 * Progress information during ZIP generation
 */
export interface ZipProgress {
  /** Current step in the process */
  stage: 'adding' | 'compressing' | 'generating' | 'complete';
  /** Current file being processed */
  currentFile?: string;
  /** Number of files processed so far */
  filesProcessed: number;
  /** Total number of files */
  totalFiles: number;
  /** Overall progress percentage (0-100) */
  percent: number;
  /** Estimated bytes processed (approximate) */
  bytesProcessed?: number;
  /** Total bytes to process (approximate) */
  totalBytes?: number;
}

/**
 * Options for ZIP generation
 */
export interface ZipGeneratorOptions {
  /** Compression level (0 = no compression, 9 = maximum compression) */
  compressionLevel?: CompressionLevel;
  /** Progress callback function */
  onProgress?: (progress: ZipProgress) => void;
  /** Base name for the ZIP file (without .zip extension) */
  zipFileName?: string;
  /** Automatically trigger download when complete */
  autoDownload?: boolean;
  /** Maximum chunk size for processing large files (in bytes) */
  chunkSize?: number;
  /** Comment to add to the ZIP file */
  comment?: string;
  /** Enable streaming generation (recommended for large files) */
  streamFiles?: boolean;
}

/**
 * Result from ZIP generation
 */
export interface ZipGenerationResult {
  /** The generated ZIP as a Blob */
  blob: Blob;
  /** File name of the ZIP */
  fileName: string;
  /** Size of the ZIP in bytes */
  size: number;
  /** Number of files included */
  fileCount: number;
  /** Time taken to generate (in milliseconds) */
  generationTime: number;
}

/**
 * Error class for ZIP generation failures
 */
export class ZipGenerationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ZipGenerationError';
  }
}

/**
 * Sanitizes a file name to prevent path traversal and ensure compatibility
 */
function sanitizeFileName(fileName: string): string {
  // Remove any path traversal attempts
  let sanitized = fileName.replace(/\.\./g, '');

  // Remove leading slashes and backslashes
  sanitized = sanitized.replace(/^[\/\\]+/, '');

  // Replace invalid characters with underscores
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1F]/g, '_');

  // Ensure the name is not empty
  if (!sanitized || sanitized.trim() === '') {
    sanitized = 'unnamed_file';
  }

  return sanitized;
}

/**
 * Generates a unique file name to avoid conflicts
 */
function generateUniqueFileName(
  baseName: string,
  existingNames: Set<string>,
  extension: string = ''
): string {
  let uniqueName = baseName + extension;
  let counter = 1;

  // Extract base name without extension for numbering
  const extIndex = baseName.lastIndexOf('.');
  const nameWithoutExt = extIndex > 0 ? baseName.substring(0, extIndex) : baseName;
  const originalExt = extIndex > 0 ? baseName.substring(extIndex) : '';

  while (existingNames.has(uniqueName)) {
    uniqueName = `${nameWithoutExt}_${counter}${originalExt}${extension}`;
    counter++;
  }

  return uniqueName;
}

/**
 * Calculates the total size of all files
 */
function calculateTotalSize(files: ZipFileInput[]): number {
  return files.reduce((total, file) => {
    if (file.data instanceof Blob) {
      return total + file.data.size;
    } else if (file.data instanceof Uint8Array) {
      return total + file.data.byteLength;
    } else if (file.data instanceof ArrayBuffer) {
      return total + file.data.byteLength;
    }
    return total;
  }, 0);
}

/**
 * Converts data to ArrayBuffer for consistent processing
 */
async function toArrayBuffer(data: Blob | Uint8Array | ArrayBuffer): Promise<ArrayBuffer> {
  if (data instanceof ArrayBuffer) {
    return data;
  } else if (data instanceof Uint8Array) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  } else if (data instanceof Blob) {
    // Handle both browser and test environments
    if (typeof data.arrayBuffer === 'function') {
      return await data.arrayBuffer();
    } else {
      // Fallback for environments without arrayBuffer (like jsdom)
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(new Error('Failed to read Blob'));
        reader.readAsArrayBuffer(data);
      });
    }
  }
  throw new ZipGenerationError('Unsupported data type');
}

/**
 * Processes a single file and adds it to the ZIP
 */
async function addFileToZip(
  zip: JSZip,
  file: ZipFileInput,
  usedNames: Set<string>,
  options: Required<Pick<ZipGeneratorOptions, 'compressionLevel' | 'streamFiles' | 'chunkSize'>>
): Promise<string> {
  try {
    // Sanitize the file name
    const sanitizedName = sanitizeFileName(file.name);

    // Create the full path (folder + name)
    const folder = file.folder ? sanitizeFileName(file.folder) : '';
    const basePath = folder ? `${folder}/` : '';

    // Generate unique name to avoid conflicts
    const uniqueName = generateUniqueFileName(sanitizedName, usedNames);
    const fullPath = basePath + uniqueName;
    usedNames.add(uniqueName);

    // Convert data to ArrayBuffer for processing
    const arrayBuffer = await toArrayBuffer(file.data);

    // Add file to ZIP with compression settings
    const zipFile = zip.file(fullPath, arrayBuffer, {
      compression: options.compressionLevel > 0 ? 'DEFLATE' : 'STORE',
      compressionOptions: {
        level: options.compressionLevel,
      },
      date: file.lastModified || new Date(),
    });

    if (!zipFile) {
      throw new ZipGenerationError(`Failed to add file: ${fullPath}`);
    }

    return fullPath;
  } catch (error) {
    throw new ZipGenerationError(
      `Error adding file "${file.name}" to ZIP`,
      error,
      { fileName: file.name, folder: file.folder }
    );
  }
}

/**
 * Triggers a download of the generated ZIP file
 */
function triggerDownload(blob: Blob, fileName: string): void {
  try {
    // Create a download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';

    // Append to body, click, and cleanup
    document.body.appendChild(link);
    link.click();

    // Cleanup after a short delay to ensure download starts
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    throw new ZipGenerationError('Failed to trigger download', error);
  }
}

/**
 * Generates a ZIP file from an array of files with progress tracking
 *
 * @param files - Array of files to include in the ZIP
 * @param options - Configuration options for ZIP generation
 * @returns Promise resolving to the ZIP generation result
 *
 * @example
 * ```typescript
 * const files = [
 *   { name: 'document1.pdf', data: pdfBlob1 },
 *   { name: 'document2.pdf', data: pdfBlob2, folder: 'documents' }
 * ];
 *
 * const result = await generateZip(files, {
 *   compressionLevel: 6,
 *   zipFileName: 'my-documents',
 *   autoDownload: true,
 *   onProgress: (progress) => {
 *     console.log(`Progress: ${progress.percent}%`);
 *   }
 * });
 * ```
 */
export async function generateZip(
  files: ZipFileInput[],
  options: ZipGeneratorOptions = {}
): Promise<ZipGenerationResult> {
  const startTime = performance.now();

  // Validate input
  if (!files || files.length === 0) {
    throw new ZipGenerationError('No files provided for ZIP generation');
  }

  // Set default options
  const config: Required<ZipGeneratorOptions> = {
    compressionLevel: options.compressionLevel ?? 6,
    onProgress: options.onProgress ?? (() => {}),
    zipFileName: options.zipFileName ?? 'download',
    autoDownload: options.autoDownload ?? false,
    chunkSize: options.chunkSize ?? 64 * 1024 * 1024, // 64MB default
    comment: options.comment ?? '',
    streamFiles: options.streamFiles ?? true,
  };

  // Ensure compression level is valid
  if (config.compressionLevel < 0 || config.compressionLevel > 9) {
    throw new ZipGenerationError(
      'Invalid compression level. Must be between 0 and 9.',
      undefined,
      { compressionLevel: config.compressionLevel }
    );
  }

  // Calculate total size for progress tracking
  const totalBytes = calculateTotalSize(files);
  const totalFiles = files.length;
  let filesProcessed = 0;
  let bytesProcessed = 0;

  // Report initial progress
  config.onProgress({
    stage: 'adding',
    filesProcessed: 0,
    totalFiles,
    percent: 0,
    bytesProcessed: 0,
    totalBytes,
  });

  try {
    // Create a new ZIP instance
    const zip = new JSZip();

    // Add comment if provided
    if (config.comment) {
      zip.comment = config.comment;
    }

    // Track used names to avoid conflicts
    const usedNames = new Set<string>();

    // Add files to ZIP
    for (const file of files) {
      const fileSize = file.data instanceof Blob
        ? file.data.size
        : file.data instanceof Uint8Array
        ? file.data.byteLength
        : (file.data as ArrayBuffer).byteLength;

      config.onProgress({
        stage: 'adding',
        currentFile: file.name,
        filesProcessed,
        totalFiles,
        percent: Math.round((filesProcessed / totalFiles) * 30), // 30% for adding
        bytesProcessed,
        totalBytes,
      });

      await addFileToZip(zip, file, usedNames, {
        compressionLevel: config.compressionLevel,
        streamFiles: config.streamFiles,
        chunkSize: config.chunkSize,
      });

      filesProcessed++;
      bytesProcessed += fileSize;
    }

    // Report compression stage
    config.onProgress({
      stage: 'compressing',
      filesProcessed: totalFiles,
      totalFiles,
      percent: 30,
      bytesProcessed: totalBytes,
      totalBytes,
    });

    // Generate the ZIP blob
    // Use appropriate generation method based on file sizes
    const useStreaming = config.streamFiles && totalBytes > config.chunkSize;

    const blob = await zip.generateAsync(
      {
        type: 'blob',
        compression: config.compressionLevel > 0 ? 'DEFLATE' : 'STORE',
        compressionOptions: {
          level: config.compressionLevel,
        },
        streamFiles: useStreaming,
      },
      (metadata) => {
        // Report progress during generation
        config.onProgress({
          stage: 'generating',
          filesProcessed: totalFiles,
          totalFiles,
          percent: 30 + Math.round(metadata.percent * 0.7), // 30-100%
          bytesProcessed: totalBytes,
          totalBytes,
        });
      }
    );

    // Report completion
    config.onProgress({
      stage: 'complete',
      filesProcessed: totalFiles,
      totalFiles,
      percent: 100,
      bytesProcessed: totalBytes,
      totalBytes,
    });

    const endTime = performance.now();
    const generationTime = Math.round(endTime - startTime);

    // Prepare the result
    const fileName = `${config.zipFileName}.zip`;
    const result: ZipGenerationResult = {
      blob,
      fileName,
      size: blob.size,
      fileCount: totalFiles,
      generationTime,
    };

    // Trigger download if requested
    if (config.autoDownload) {
      triggerDownload(blob, fileName);
    }

    return result;
  } catch (error) {
    if (error instanceof ZipGenerationError) {
      throw error;
    }
    throw new ZipGenerationError(
      'Failed to generate ZIP file',
      error,
      { fileCount: files.length, totalBytes }
    );
  }
}

/**
 * Generates a ZIP file from converted PDFs with automatic naming
 *
 * @param results - Array of conversion results with data and names
 * @param baseFileName - Base name for the ZIP file
 * @param options - Additional ZIP generation options
 * @returns Promise resolving to the ZIP generation result
 *
 * @example
 * ```typescript
 * const results = [
 *   { data: pdfData1, name: 'converted_1.pdf' },
 *   { data: pdfData2, name: 'converted_2.pdf' }
 * ];
 *
 * const zip = await generateZipFromResults(results, 'batch-conversion', {
 *   compressionLevel: 5,
 *   autoDownload: true
 * });
 * ```
 */
export async function generateZipFromResults(
  results: Array<{ data: Uint8Array | Blob; name: string }>,
  baseFileName: string = 'converted-files',
  options: Omit<ZipGeneratorOptions, 'zipFileName'> = {}
): Promise<ZipGenerationResult> {
  const files: ZipFileInput[] = results.map((result) => ({
    name: result.name,
    data: result.data,
  }));

  return generateZip(files, {
    ...options,
    zipFileName: baseFileName,
  });
}

/**
 * Estimates the compressed size of a ZIP file
 * This is a rough estimate and actual size may vary
 *
 * @param files - Array of files to estimate
 * @param compressionLevel - Compression level (0-9)
 * @returns Estimated size in bytes
 */
export function estimateZipSize(
  files: ZipFileInput[],
  compressionLevel: CompressionLevel = 6
): number {
  const totalSize = calculateTotalSize(files);

  // Rough compression ratio estimates based on level
  const compressionRatios: Record<number, number> = {
    0: 1.0,   // No compression
    1: 0.85,  // Very low compression
    2: 0.75,
    3: 0.65,
    4: 0.55,
    5: 0.50,
    6: 0.45,  // Default
    7: 0.40,
    8: 0.35,
    9: 0.30,  // Maximum compression
  };

  const ratio = compressionRatios[compressionLevel] ?? 0.45;

  // Add overhead for ZIP structure (approximately 50 bytes per file + global overhead)
  const overhead = files.length * 50 + 100;

  return Math.round(totalSize * ratio + overhead);
}

/**
 * Validates files before ZIP generation
 *
 * @param files - Array of files to validate
 * @param maxTotalSize - Maximum total size in bytes (default: 2GB)
 * @throws ZipGenerationError if validation fails
 */
export function validateFiles(
  files: ZipFileInput[],
  maxTotalSize: number = 2 * 1024 * 1024 * 1024 // 2GB default
): void {
  if (!files || files.length === 0) {
    throw new ZipGenerationError('No files provided');
  }

  if (files.length > 10000) {
    throw new ZipGenerationError(
      'Too many files. Maximum 10,000 files per ZIP.',
      undefined,
      { fileCount: files.length }
    );
  }

  const totalSize = calculateTotalSize(files);
  if (totalSize > maxTotalSize) {
    throw new ZipGenerationError(
      'Total file size exceeds maximum allowed size',
      undefined,
      { totalSize, maxTotalSize }
    );
  }

  // Validate each file
  for (const file of files) {
    if (!file.name || file.name.trim() === '') {
      throw new ZipGenerationError('File name cannot be empty');
    }

    if (!file.data) {
      throw new ZipGenerationError(`File "${file.name}" has no data`);
    }
  }
}

/**
 * Creates a folder structure in the ZIP
 * Useful for organizing files by category or type
 *
 * @param files - Files to organize
 * @param folderMapping - Function to determine folder for each file
 * @returns Files with folder assignments
 *
 * @example
 * ```typescript
 * const organized = organizeFilesIntoFolders(files, (file) => {
 *   if (file.name.endsWith('.pdf')) return 'pdfs';
 *   if (file.name.endsWith('.jpg')) return 'images';
 *   return 'other';
 * });
 * ```
 */
export function organizeFilesIntoFolders(
  files: ZipFileInput[],
  folderMapping: (file: ZipFileInput) => string
): ZipFileInput[] {
  return files.map((file) => ({
    ...file,
    folder: folderMapping(file),
  }));
}
