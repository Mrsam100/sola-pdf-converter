/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for ZIP generator utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateZip,
  generateZipFromResults,
  estimateZipSize,
  validateFiles,
  organizeFilesIntoFolders,
  ZipGenerationError,
  type ZipFileInput,
  type ZipProgress,
  type CompressionLevel,
} from '../../../utils/zipGenerator';

describe('zipGenerator', () => {
  // Helper function to create test blobs
  const createTestBlob = (content: string, type = 'application/pdf'): Blob => {
    return new Blob([content], { type });
  };

  // Helper function to create test Uint8Array
  const createTestUint8Array = (size: number): Uint8Array => {
    return new Uint8Array(size).fill(65); // Fill with 'A' character
  };

  describe('generateZip', () => {
    it('should generate a ZIP file with single file', async () => {
      const files: ZipFileInput[] = [
        {
          name: 'test.pdf',
          data: createTestBlob('Test content'),
        },
      ];

      const result = await generateZip(files);

      expect(result).toBeDefined();
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.fileName).toBe('download.zip');
      expect(result.fileCount).toBe(1);
      expect(result.size).toBeGreaterThan(0);
      expect(result.generationTime).toBeGreaterThanOrEqual(0);
    });

    it('should generate a ZIP file with multiple files', async () => {
      const files: ZipFileInput[] = [
        { name: 'file1.pdf', data: createTestBlob('Content 1') },
        { name: 'file2.pdf', data: createTestBlob('Content 2') },
        { name: 'file3.pdf', data: createTestBlob('Content 3') },
      ];

      const result = await generateZip(files);

      expect(result.fileCount).toBe(3);
      expect(result.blob.size).toBeGreaterThan(0);
    });

    it('should use custom ZIP file name', async () => {
      const files: ZipFileInput[] = [
        { name: 'test.pdf', data: createTestBlob('Test') },
      ];

      const result = await generateZip(files, {
        zipFileName: 'my-custom-archive',
      });

      expect(result.fileName).toBe('my-custom-archive.zip');
    });

    it('should apply compression level', async () => {
      const content = 'A'.repeat(1000); // Repeating content compresses well
      const files: ZipFileInput[] = [
        { name: 'test.txt', data: createTestBlob(content, 'text/plain') },
      ];

      const noCompression = await generateZip(files, { compressionLevel: 0 });
      const maxCompression = await generateZip(files, { compressionLevel: 9 });

      // Max compression should produce smaller file
      expect(maxCompression.size).toBeLessThan(noCompression.size);
    });

    it('should call progress callback', async () => {
      const progressUpdates: ZipProgress[] = [];
      const files: ZipFileInput[] = [
        { name: 'file1.pdf', data: createTestBlob('Content 1') },
        { name: 'file2.pdf', data: createTestBlob('Content 2') },
      ];

      await generateZip(files, {
        onProgress: (progress) => {
          progressUpdates.push({ ...progress });
        },
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].percent).toBe(0);
      expect(progressUpdates[progressUpdates.length - 1].percent).toBe(100);
      expect(progressUpdates[progressUpdates.length - 1].stage).toBe('complete');
    });

    it('should handle files with folders', async () => {
      const files: ZipFileInput[] = [
        { name: 'file1.pdf', data: createTestBlob('Content 1'), folder: 'pdfs' },
        { name: 'file2.pdf', data: createTestBlob('Content 2'), folder: 'documents' },
      ];

      const result = await generateZip(files);

      expect(result.fileCount).toBe(2);
    });

    it('should handle Uint8Array data', async () => {
      const files: ZipFileInput[] = [
        { name: 'test.bin', data: createTestUint8Array(100) },
      ];

      const result = await generateZip(files);

      expect(result.fileCount).toBe(1);
      expect(result.size).toBeGreaterThan(0);
    });

    it('should handle ArrayBuffer data', async () => {
      const buffer = new ArrayBuffer(100);
      const files: ZipFileInput[] = [
        { name: 'test.bin', data: buffer },
      ];

      const result = await generateZip(files);

      expect(result.fileCount).toBe(1);
      expect(result.size).toBeGreaterThan(0);
    });

    it('should handle duplicate file names', async () => {
      const files: ZipFileInput[] = [
        { name: 'test.pdf', data: createTestBlob('Content 1') },
        { name: 'test.pdf', data: createTestBlob('Content 2') },
        { name: 'test.pdf', data: createTestBlob('Content 3') },
      ];

      const result = await generateZip(files);

      // Should successfully create ZIP with renamed files
      expect(result.fileCount).toBe(3);
    });

    it('should sanitize invalid file names', async () => {
      const files: ZipFileInput[] = [
        { name: '../../../etc/passwd', data: createTestBlob('malicious') },
        { name: 'file<>:"|?*.txt', data: createTestBlob('invalid chars') },
      ];

      const result = await generateZip(files);

      expect(result.fileCount).toBe(2);
    });

    it('should add comment to ZIP', async () => {
      const files: ZipFileInput[] = [
        { name: 'test.pdf', data: createTestBlob('Test') },
      ];

      const result = await generateZip(files, {
        comment: 'Generated by Sola PDF Converter',
      });

      expect(result.size).toBeGreaterThan(0);
    });

    it('should throw error for empty file array', async () => {
      await expect(generateZip([])).rejects.toThrow(ZipGenerationError);
      await expect(generateZip([])).rejects.toThrow(
        'No files provided for ZIP generation'
      );
    });

    it('should throw error for invalid compression level', async () => {
      const files: ZipFileInput[] = [
        { name: 'test.pdf', data: createTestBlob('Test') },
      ];

      await expect(
        generateZip(files, { compressionLevel: 10 as CompressionLevel })
      ).rejects.toThrow('Invalid compression level');
    });

    it('should handle last modified dates', async () => {
      const date = new Date('2024-01-01T00:00:00Z');
      const files: ZipFileInput[] = [
        { name: 'test.pdf', data: createTestBlob('Test'), lastModified: date },
      ];

      const result = await generateZip(files);

      expect(result.size).toBeGreaterThan(0);
    });

    it('should not auto-download by default', async () => {
      const files: ZipFileInput[] = [
        { name: 'test.pdf', data: createTestBlob('Test') },
      ];

      // Mock document methods
      const createElement = vi.spyOn(document, 'createElement');
      const appendChild = vi.spyOn(document.body, 'appendChild');

      await generateZip(files);

      expect(createElement).not.toHaveBeenCalledWith('a');
      expect(appendChild).not.toHaveBeenCalled();

      createElement.mockRestore();
      appendChild.mockRestore();
    });

    it('should track progress stages correctly', async () => {
      const stages: string[] = [];
      const files: ZipFileInput[] = [
        { name: 'file1.pdf', data: createTestBlob('Content 1') },
        { name: 'file2.pdf', data: createTestBlob('Content 2') },
      ];

      await generateZip(files, {
        onProgress: (progress) => {
          if (!stages.includes(progress.stage)) {
            stages.push(progress.stage);
          }
        },
      });

      expect(stages).toContain('adding');
      expect(stages).toContain('compressing');
      expect(stages).toContain('generating');
      expect(stages).toContain('complete');
    });
  });

  describe('generateZipFromResults', () => {
    it('should generate ZIP from conversion results', async () => {
      const results = [
        { data: createTestBlob('PDF 1'), name: 'converted1.pdf' },
        { data: createTestBlob('PDF 2'), name: 'converted2.pdf' },
      ];

      const result = await generateZipFromResults(results, 'batch-conversion');

      expect(result.fileName).toBe('batch-conversion.zip');
      expect(result.fileCount).toBe(2);
    });

    it('should use default file name', async () => {
      const results = [
        { data: createTestBlob('PDF 1'), name: 'converted1.pdf' },
      ];

      const result = await generateZipFromResults(results);

      expect(result.fileName).toBe('converted-files.zip');
    });

    it('should handle Uint8Array results', async () => {
      const results = [
        { data: createTestUint8Array(100), name: 'file1.pdf' },
        { data: createTestUint8Array(200), name: 'file2.pdf' },
      ];

      const result = await generateZipFromResults(results);

      expect(result.fileCount).toBe(2);
    });
  });

  describe('estimateZipSize', () => {
    it('should estimate size for no compression', () => {
      const files: ZipFileInput[] = [
        { name: 'test.pdf', data: createTestBlob('A'.repeat(1000)) },
      ];

      const estimate = estimateZipSize(files, 0);

      expect(estimate).toBeGreaterThan(1000); // Should be approximately original size
      expect(estimate).toBeLessThan(1200); // Plus some overhead
    });

    it('should estimate size for maximum compression', () => {
      const files: ZipFileInput[] = [
        { name: 'test.txt', data: createTestBlob('A'.repeat(1000)) },
      ];

      const estimate = estimateZipSize(files, 9);

      expect(estimate).toBeLessThan(500); // Should be much smaller with compression
    });

    it('should account for multiple files', () => {
      const files: ZipFileInput[] = [
        { name: 'file1.pdf', data: createTestBlob('A'.repeat(1000)) },
        { name: 'file2.pdf', data: createTestBlob('B'.repeat(1000)) },
        { name: 'file3.pdf', data: createTestBlob('C'.repeat(1000)) },
      ];

      const estimate = estimateZipSize(files, 6);

      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThan(3000); // Should be compressed
    });

    it('should use default compression level', () => {
      const files: ZipFileInput[] = [
        { name: 'test.pdf', data: createTestBlob('A'.repeat(1000)) },
      ];

      const estimate = estimateZipSize(files);

      expect(estimate).toBeGreaterThan(0);
    });
  });

  describe('validateFiles', () => {
    it('should pass validation for valid files', () => {
      const files: ZipFileInput[] = [
        { name: 'test1.pdf', data: createTestBlob('Content 1') },
        { name: 'test2.pdf', data: createTestBlob('Content 2') },
      ];

      expect(() => validateFiles(files)).not.toThrow();
    });

    it('should throw error for empty array', () => {
      expect(() => validateFiles([])).toThrow(ZipGenerationError);
      expect(() => validateFiles([])).toThrow('No files provided');
    });

    it('should throw error for too many files', () => {
      const files: ZipFileInput[] = Array(10001)
        .fill(null)
        .map((_, i) => ({
          name: `file${i}.pdf`,
          data: createTestBlob('Content'),
        }));

      expect(() => validateFiles(files)).toThrow(ZipGenerationError);
      expect(() => validateFiles(files)).toThrow('Too many files');
    });

    it('should throw error for files exceeding max size', () => {
      const largeBlob = createTestBlob('A'.repeat(1000));
      const files: ZipFileInput[] = [
        { name: 'large.pdf', data: largeBlob },
      ];

      expect(() => validateFiles(files, 500)).toThrow(ZipGenerationError);
      expect(() => validateFiles(files, 500)).toThrow(
        'Total file size exceeds maximum allowed size'
      );
    });

    it('should throw error for file with empty name', () => {
      const files: ZipFileInput[] = [
        { name: '', data: createTestBlob('Content') },
      ];

      expect(() => validateFiles(files)).toThrow(ZipGenerationError);
      expect(() => validateFiles(files)).toThrow('File name cannot be empty');
    });

    it('should throw error for file with no data', () => {
      const files: ZipFileInput[] = [
        { name: 'test.pdf', data: null as any },
      ];

      expect(() => validateFiles(files)).toThrow(ZipGenerationError);
      expect(() => validateFiles(files)).toThrow('has no data');
    });
  });

  describe('organizeFilesIntoFolders', () => {
    it('should organize files into folders', () => {
      const files: ZipFileInput[] = [
        { name: 'file1.pdf', data: createTestBlob('Content 1') },
        { name: 'file2.jpg', data: createTestBlob('Content 2') },
        { name: 'file3.pdf', data: createTestBlob('Content 3') },
      ];

      const organized = organizeFilesIntoFolders(files, (file) => {
        if (file.name.endsWith('.pdf')) return 'pdfs';
        if (file.name.endsWith('.jpg')) return 'images';
        return 'other';
      });

      expect(organized[0].folder).toBe('pdfs');
      expect(organized[1].folder).toBe('images');
      expect(organized[2].folder).toBe('pdfs');
    });

    it('should preserve original file properties', () => {
      const files: ZipFileInput[] = [
        { name: 'test.pdf', data: createTestBlob('Content'), lastModified: new Date() },
      ];

      const organized = organizeFilesIntoFolders(files, () => 'documents');

      expect(organized[0].name).toBe('test.pdf');
      expect(organized[0].data).toBeDefined();
      expect(organized[0].lastModified).toBeDefined();
      expect(organized[0].folder).toBe('documents');
    });

    it('should handle empty folder names', () => {
      const files: ZipFileInput[] = [
        { name: 'test.pdf', data: createTestBlob('Content') },
      ];

      const organized = organizeFilesIntoFolders(files, () => '');

      expect(organized[0].folder).toBe('');
    });
  });

  describe('ZipGenerationError', () => {
    it('should create error with message', () => {
      const error = new ZipGenerationError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ZipGenerationError');
    });

    it('should create error with cause', () => {
      const originalError = new Error('Original');
      const error = new ZipGenerationError('Test error', originalError);

      expect(error.cause).toBe(originalError);
    });

    it('should create error with context', () => {
      const context = { fileName: 'test.pdf', size: 1000 };
      const error = new ZipGenerationError('Test error', undefined, context);

      expect(error.context).toEqual(context);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle very small files', async () => {
      const files: ZipFileInput[] = [
        { name: 'tiny.txt', data: createTestBlob('') },
      ];

      const result = await generateZip(files);

      expect(result.fileCount).toBe(1);
    });

    it('should handle files with special characters in names', async () => {
      const files: ZipFileInput[] = [
        { name: 'file (1).pdf', data: createTestBlob('Content') },
        { name: 'file [2].pdf', data: createTestBlob('Content') },
        { name: "file's_3.pdf", data: createTestBlob('Content') },
      ];

      const result = await generateZip(files);

      expect(result.fileCount).toBe(3);
    });

    it('should handle nested folders', async () => {
      const files: ZipFileInput[] = [
        { name: 'file.pdf', data: createTestBlob('Content'), folder: 'a/b/c' },
      ];

      const result = await generateZip(files);

      expect(result.fileCount).toBe(1);
    });

    it('should handle mixed data types', async () => {
      const files: ZipFileInput[] = [
        { name: 'blob.pdf', data: createTestBlob('Blob data') },
        { name: 'uint8.pdf', data: createTestUint8Array(100) },
        { name: 'buffer.pdf', data: new ArrayBuffer(100) },
      ];

      const result = await generateZip(files);

      expect(result.fileCount).toBe(3);
    });
  });

  describe('Performance and memory efficiency', () => {
    it('should handle moderate number of files efficiently', async () => {
      const files: ZipFileInput[] = Array(100)
        .fill(null)
        .map((_, i) => ({
          name: `file${i}.pdf`,
          data: createTestBlob(`Content ${i}`),
        }));

      const startTime = performance.now();
      const result = await generateZip(files, { compressionLevel: 1 });
      const endTime = performance.now();

      expect(result.fileCount).toBe(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should report accurate progress percentages', async () => {
      const percentages: number[] = [];
      const files: ZipFileInput[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          name: `file${i}.pdf`,
          data: createTestBlob(`Content ${i}`),
        }));

      await generateZip(files, {
        onProgress: (progress) => {
          percentages.push(progress.percent);
        },
      });

      // Progress should be monotonically increasing
      for (let i = 1; i < percentages.length; i++) {
        expect(percentages[i]).toBeGreaterThanOrEqual(percentages[i - 1]);
      }

      // Should start at 0 and end at 100
      expect(percentages[0]).toBe(0);
      expect(percentages[percentages.length - 1]).toBe(100);
    });
  });
});
