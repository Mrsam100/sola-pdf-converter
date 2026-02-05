/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit Tests for PDF Service Configuration Features
 * Tests all configuration parameters for each service function
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  mergePDFs,
  splitPDF,
  compressPDF,
  rotatePDF,
  pdfToJPG,
} from '../../../services/pdfService';
import type {
  MergePdfConfig,
  SplitPdfConfig,
  CompressPdfConfig,
  RotatePdfConfig,
  PdfToImageConfig,
} from '../../../types';

// Helper to create mock PDF files
const createMockPDFFile = (name: string, pages: number = 3): File => {
  const content = `Mock PDF: ${name} with ${pages} pages`;
  const blob = new Blob([content], { type: 'application/pdf' });
  const file = new File([blob], name, { type: 'application/pdf' });

  // Mock arrayBuffer method
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => {
      return new Promise<ArrayBuffer>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as ArrayBuffer);
        };
        reader.readAsArrayBuffer(blob);
      });
    },
  });

  return file;
};

describe('mergePDFs with Configuration', () => {
  let file1: File;
  let file2: File;
  let file3: File;

  beforeEach(() => {
    file1 = createMockPDFFile('doc1.pdf', 5);
    file2 = createMockPDFFile('doc2.pdf', 3);
    file3 = createMockPDFFile('doc3.pdf', 4);
  });

  it('should merge PDFs without configuration (default behavior)', async () => {
    const result = await mergePDFs([file1, file2]);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should merge PDFs with custom page order', async () => {
    const config: MergePdfConfig = {
      pageOrder: [
        { fileId: 'doc2.pdf', fileName: 'doc2.pdf', pageIndices: [0, 1, 2] },
        { fileId: 'doc1.pdf', fileName: 'doc1.pdf', pageIndices: [0, 1] },
      ],
      removePages: [],
    };

    const result = await mergePDFs([file1, file2], config);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should merge PDFs with selective page inclusion', async () => {
    const config: MergePdfConfig = {
      pageOrder: [
        { fileId: 'doc1.pdf', fileName: 'doc1.pdf', pageIndices: [0, 2, 4] }, // Pages 1, 3, 5
        { fileId: 'doc2.pdf', fileName: 'doc2.pdf', pageIndices: [1] }, // Page 2
      ],
      removePages: [],
    };

    const result = await mergePDFs([file1, file2], config);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should throw error if config references non-existent file', async () => {
    const config: MergePdfConfig = {
      pageOrder: [
        { fileId: 'nonexistent.pdf', fileName: 'nonexistent.pdf', pageIndices: [0] },
      ],
      removePages: [],
    };

    await expect(mergePDFs([file1, file2], config)).rejects.toThrow('not found');
  });

  it('should throw error if less than 2 files provided', async () => {
    await expect(mergePDFs([file1])).rejects.toThrow('at least 2 PDF files');
  });
});

describe('splitPDF with Configuration', () => {
  let file: File;

  beforeEach(() => {
    file = createMockPDFFile('document.pdf', 10);
  });

  it('should split by page ranges', async () => {
    const config: SplitPdfConfig = {
      mode: 'ranges',
      pageRanges: ['1-3', '5', '7-9'],
      outputFormat: 'separate',
    };

    const results = await splitPDF(file, config);
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBe(3);
    expect(results[0].name).toContain('document_pages');
  });

  it('should extract specific pages', async () => {
    const config: SplitPdfConfig = {
      mode: 'extract',
      extractPages: [1, 3, 5, 7],
      outputFormat: 'separate',
    };

    const results = await splitPDF(file, config);
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBe(4);
  });

  it('should split every N pages', async () => {
    const config: SplitPdfConfig = {
      mode: 'every-n-pages',
      splitEvery: 3,
      outputFormat: 'separate',
    };

    const results = await splitPDF(file, config);
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should merge extracted pages into single PDF', async () => {
    const config: SplitPdfConfig = {
      mode: 'extract',
      extractPages: [1, 2, 3],
      outputFormat: 'merged',
    };

    const results = await splitPDF(file, config);
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBe(1);
    expect(results[0].name).toContain('extracted');
  });

  it('should throw error for invalid page range', async () => {
    const config: SplitPdfConfig = {
      mode: 'ranges',
      pageRanges: ['1-100'], // Exceeds page count
      outputFormat: 'separate',
    };

    await expect(splitPDF(file, config)).rejects.toThrow();
  });

  it('should throw error if missing required config for mode', async () => {
    const config: SplitPdfConfig = {
      mode: 'ranges',
      // Missing pageRanges
      outputFormat: 'separate',
    };

    await expect(splitPDF(file, config)).rejects.toThrow('Page ranges are required');
  });
});

describe('compressPDF with Configuration', () => {
  let file: File;

  beforeEach(() => {
    file = createMockPDFFile('large-document.pdf', 20);
  });

  it('should compress with default config', async () => {
    const result = await compressPDF(file);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should compress with low compression level', async () => {
    const config: CompressPdfConfig = {
      compressionLevel: 'low',
      optimizeImages: false,
      removeMetadata: false,
    };

    const result = await compressPDF(file, config);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should compress with high compression level', async () => {
    const config: CompressPdfConfig = {
      compressionLevel: 'high',
      optimizeImages: true,
      removeMetadata: false,
    };

    const result = await compressPDF(file, config);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should compress with extreme compression and remove metadata', async () => {
    const config: CompressPdfConfig = {
      compressionLevel: 'extreme',
      optimizeImages: true,
      removeMetadata: true,
    };

    const result = await compressPDF(file, config);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should remove metadata when requested', async () => {
    const config: CompressPdfConfig = {
      compressionLevel: 'medium',
      optimizeImages: true,
      removeMetadata: true,
    };

    const result = await compressPDF(file, config);
    expect(result).toBeInstanceOf(Uint8Array);
    // Note: In real test, we'd verify metadata is actually removed
  });
});

describe('rotatePDF with Configuration', () => {
  let file: File;

  beforeEach(() => {
    file = createMockPDFFile('rotatable.pdf', 5);
  });

  it('should rotate all pages 90 degrees', async () => {
    const config: RotatePdfConfig = {
      rotation: 90,
      pageSelection: 'all',
    };

    const result = await rotatePDF(file, config);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should rotate specific pages 180 degrees', async () => {
    const config: RotatePdfConfig = {
      rotation: 180,
      pageSelection: 'specific',
      pageNumbers: [1, 3, 5],
    };

    const result = await rotatePDF(file, config);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should rotate all pages 270 degrees', async () => {
    const config: RotatePdfConfig = {
      rotation: 270,
      pageSelection: 'all',
    };

    const result = await rotatePDF(file, config);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should throw error for invalid rotation angle', async () => {
    const config: RotatePdfConfig = {
      rotation: 45 as 90, // Invalid angle
      pageSelection: 'all',
    };

    await expect(rotatePDF(file, config)).rejects.toThrow('must be 90, 180, or 270');
  });

  it('should throw error for invalid page numbers', async () => {
    const config: RotatePdfConfig = {
      rotation: 90,
      pageSelection: 'specific',
      pageNumbers: [1, 100], // Page 100 doesn't exist
    };

    await expect(rotatePDF(file, config)).rejects.toThrow('does not exist');
  });
});

describe('pdfToJPG with Configuration', () => {
  let file: File;

  beforeEach(() => {
    file = createMockPDFFile('convertible.pdf', 5);
  });

  it('should convert to JPG with default config', async () => {
    const results = await pdfToJPG(file);
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain('.jpg');
  });

  it('should convert to PNG format', async () => {
    const config: PdfToImageConfig = {
      format: 'png',
      quality: 1.0,
      dpi: 150,
      pageSelection: 'all',
      colorSpace: 'rgb',
    };

    const results = await pdfToJPG(file, config);
    expect(results[0].name).toContain('.png');
  });

  it('should convert to WebP format', async () => {
    const config: PdfToImageConfig = {
      format: 'webp',
      quality: 0.85,
      dpi: 150,
      pageSelection: 'all',
      colorSpace: 'rgb',
    };

    const results = await pdfToJPG(file, config);
    expect(results[0].name).toContain('.webp');
  });

  it('should convert with 300 DPI', async () => {
    const config: PdfToImageConfig = {
      format: 'jpg',
      quality: 0.92,
      dpi: 300,
      pageSelection: 'all',
      colorSpace: 'rgb',
    };

    const results = await pdfToJPG(file, config);
    expect(results).toBeInstanceOf(Array);
  });

  it('should convert specific page range', async () => {
    const config: PdfToImageConfig = {
      format: 'jpg',
      quality: 0.92,
      dpi: 150,
      pageSelection: 'range',
      pageRange: '1-3,5',
      colorSpace: 'rgb',
    };

    const results = await pdfToJPG(file, config);
    expect(results.length).toBe(4); // Pages 1, 2, 3, 5
  });

  it('should convert to grayscale', async () => {
    const config: PdfToImageConfig = {
      format: 'jpg',
      quality: 0.92,
      dpi: 150,
      pageSelection: 'all',
      colorSpace: 'grayscale',
    };

    const results = await pdfToJPG(file, config);
    expect(results).toBeInstanceOf(Array);
  });

  it('should convert to black and white', async () => {
    const config: PdfToImageConfig = {
      format: 'jpg',
      quality: 0.92,
      dpi: 150,
      pageSelection: 'all',
      colorSpace: 'blackwhite',
    };

    const results = await pdfToJPG(file, config);
    expect(results).toBeInstanceOf(Array);
  });

  it('should handle complex page range parsing', async () => {
    const config: PdfToImageConfig = {
      format: 'jpg',
      quality: 0.92,
      dpi: 150,
      pageSelection: 'range',
      pageRange: '1,3-5,2', // Should dedupe and sort
      colorSpace: 'rgb',
    };

    const results = await pdfToJPG(file, config);
    expect(results.length).toBeGreaterThan(0);
  });
});

describe('Configuration Integration Tests', () => {
  it('should handle end-to-end workflow: merge → split → compress', async () => {
    const file1 = createMockPDFFile('part1.pdf', 5);
    const file2 = createMockPDFFile('part2.pdf', 5);

    // Step 1: Merge
    const mergeConfig: MergePdfConfig = {
      pageOrder: [
        { fileId: 'part1.pdf', fileName: 'part1.pdf', pageIndices: [0, 1, 2, 3, 4] },
        { fileId: 'part2.pdf', fileName: 'part2.pdf', pageIndices: [0, 1, 2, 3, 4] },
      ],
      removePages: [],
    };
    const merged = await mergePDFs([file1, file2], mergeConfig);
    expect(merged).toBeInstanceOf(Uint8Array);

    // Step 2: Create File from merged result for next operation
    const mergedFile = new File([merged], 'merged.pdf', { type: 'application/pdf' });
    Object.defineProperty(mergedFile, 'arrayBuffer', {
      value: async () => merged.buffer,
    });

    // Step 3: Split
    const splitConfig: SplitPdfConfig = {
      mode: 'every-n-pages',
      splitEvery: 5,
      outputFormat: 'separate',
    };
    const split = await splitPDF(mergedFile, splitConfig);
    expect(split).toBeInstanceOf(Array);

    // Step 4: Compress first split result
    const firstSplitFile = new File([split[0].pdf], split[0].name, { type: 'application/pdf' });
    Object.defineProperty(firstSplitFile, 'arrayBuffer', {
      value: async () => split[0].pdf.buffer,
    });

    const compressConfig: CompressPdfConfig = {
      compressionLevel: 'high',
      optimizeImages: true,
      removeMetadata: true,
    };
    const compressed = await compressPDF(firstSplitFile, compressConfig);
    expect(compressed).toBeInstanceOf(Uint8Array);
  });
});
