/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Usage examples for ZIP Generator utility
 * This file demonstrates various ways to use the ZIP generator
 */

import {
  generateZip,
  generateZipFromResults,
  estimateZipSize,
  validateFiles,
  organizeFilesIntoFolders,
  type ZipFileInput,
  type ZipProgress,
} from './zipGenerator';

// ============================================================================
// Example 1: Basic ZIP generation with auto-download
// ============================================================================
export async function example1_BasicZipGeneration() {
  // Prepare files (these could be from file input or converted PDFs)
  const files: ZipFileInput[] = [
    {
      name: 'document1.pdf',
      data: new Blob(['PDF content here'], { type: 'application/pdf' }),
    },
    {
      name: 'document2.pdf',
      data: new Blob(['PDF content here'], { type: 'application/pdf' }),
    },
  ];

  // Generate and auto-download the ZIP
  const result = await generateZip(files, {
    zipFileName: 'my-documents',
    autoDownload: true,
  });

  console.log(`ZIP generated: ${result.fileName}`);
  console.log(`Size: ${result.size} bytes`);
  console.log(`Files: ${result.fileCount}`);
  console.log(`Time: ${result.generationTime}ms`);
}

// ============================================================================
// Example 2: Progress tracking with UI updates
// ============================================================================
export async function example2_ProgressTracking() {
  const files: ZipFileInput[] = [
    { name: 'file1.pdf', data: new Blob(['Content 1']) },
    { name: 'file2.pdf', data: new Blob(['Content 2']) },
    { name: 'file3.pdf', data: new Blob(['Content 3']) },
  ];

  // Track progress and update UI
  const result = await generateZip(files, {
    zipFileName: 'batch-download',
    onProgress: (progress: ZipProgress) => {
      console.log(`Stage: ${progress.stage}`);
      console.log(`Progress: ${progress.percent}%`);
      console.log(`Current file: ${progress.currentFile}`);
      console.log(`Files: ${progress.filesProcessed}/${progress.totalFiles}`);

      // Update UI - example with a progress bar
      // updateProgressBar(progress.percent);
      // updateStatusText(`${progress.stage}: ${progress.currentFile}`);
    },
  });

  return result;
}

// ============================================================================
// Example 3: Compression level control for large files
// ============================================================================
export async function example3_CompressionControl() {
  const largeFiles: ZipFileInput[] = [
    {
      name: 'large-document1.pdf',
      data: new Blob([new Uint8Array(10 * 1024 * 1024)]), // 10MB
    },
    {
      name: 'large-document2.pdf',
      data: new Blob([new Uint8Array(15 * 1024 * 1024)]), // 15MB
    },
  ];

  // Low compression for faster processing
  const fastResult = await generateZip(largeFiles, {
    compressionLevel: 1, // Faster, larger file
    zipFileName: 'fast-archive',
  });

  // High compression for smaller file size
  const smallResult = await generateZip(largeFiles, {
    compressionLevel: 9, // Slower, smaller file
    zipFileName: 'compressed-archive',
  });

  console.log('Fast compression:', fastResult.size, 'bytes');
  console.log('High compression:', smallResult.size, 'bytes');
  console.log('Size reduction:', fastResult.size - smallResult.size, 'bytes');
}

// ============================================================================
// Example 4: Organizing files into folders
// ============================================================================
export async function example4_OrganizedFolders() {
  const files: ZipFileInput[] = [
    { name: 'report.pdf', data: new Blob(['PDF content']) },
    { name: 'invoice.pdf', data: new Blob(['PDF content']) },
    { name: 'photo1.jpg', data: new Blob(['Image content']) },
    { name: 'photo2.jpg', data: new Blob(['Image content']) },
  ];

  // Organize files into folders by type
  const organizedFiles = organizeFilesIntoFolders(files, (file) => {
    if (file.name.endsWith('.pdf')) return 'documents';
    if (file.name.endsWith('.jpg')) return 'images';
    return 'other';
  });

  const result = await generateZip(organizedFiles, {
    zipFileName: 'organized-archive',
  });

  // ZIP structure will be:
  // documents/report.pdf
  // documents/invoice.pdf
  // images/photo1.jpg
  // images/photo2.jpg

  return result;
}

// ============================================================================
// Example 5: Batch conversion with ZIP download
// ============================================================================
export async function example5_BatchConversionDownload() {
  // Simulate conversion results
  const conversionResults = [
    { data: new Uint8Array([1, 2, 3]), name: 'converted1.pdf' },
    { data: new Uint8Array([4, 5, 6]), name: 'converted2.pdf' },
    { data: new Uint8Array([7, 8, 9]), name: 'converted3.pdf' },
  ];

  // Generate ZIP from conversion results
  const result = await generateZipFromResults(
    conversionResults,
    'batch-conversion',
    {
      compressionLevel: 6,
      autoDownload: true,
      onProgress: (progress) => {
        console.log(`Converting: ${progress.percent}%`);
      },
    }
  );

  return result;
}

// ============================================================================
// Example 6: Size estimation before generation
// ============================================================================
export async function example6_SizeEstimation() {
  const files: ZipFileInput[] = [
    { name: 'doc1.pdf', data: new Blob([new Uint8Array(5 * 1024 * 1024)]) }, // 5MB
    { name: 'doc2.pdf', data: new Blob([new Uint8Array(3 * 1024 * 1024)]) }, // 3MB
  ];

  // Estimate size with different compression levels
  const sizeNoCompression = estimateZipSize(files, 0);
  const sizeMediumCompression = estimateZipSize(files, 6);
  const sizeMaxCompression = estimateZipSize(files, 9);

  console.log('Estimated size (no compression):', sizeNoCompression, 'bytes');
  console.log('Estimated size (medium):', sizeMediumCompression, 'bytes');
  console.log('Estimated size (maximum):', sizeMaxCompression, 'bytes');

  // Check if estimated size is acceptable
  const maxAllowedSize = 10 * 1024 * 1024; // 10MB
  if (sizeMediumCompression > maxAllowedSize) {
    console.warn('ZIP will be too large, consider splitting or higher compression');
  }

  // Generate with chosen compression level
  const result = await generateZip(files, {
    compressionLevel: 6,
  });

  return result;
}

// ============================================================================
// Example 7: Validation before generation
// ============================================================================
export async function example7_FileValidation() {
  const files: ZipFileInput[] = [
    { name: 'valid.pdf', data: new Blob(['Content']) },
    { name: 'also-valid.pdf', data: new Blob(['Content']) },
  ];

  try {
    // Validate files before processing
    validateFiles(files, 100 * 1024 * 1024); // Max 100MB

    // If validation passes, generate ZIP
    const result = await generateZip(files, {
      zipFileName: 'validated-files',
    });

    console.log('Validation passed, ZIP generated successfully');
    return result;
  } catch (error) {
    console.error('Validation failed:', error);
    // Handle validation error (show message to user, etc.)
    throw error;
  }
}

// ============================================================================
// Example 8: Handling errors gracefully
// ============================================================================
export async function example8_ErrorHandling() {
  const files: ZipFileInput[] = [
    { name: 'test.pdf', data: new Blob(['Content']) },
  ];

  try {
    const result = await generateZip(files, {
      zipFileName: 'my-files',
      autoDownload: true,
      onProgress: (progress) => {
        console.log(`Progress: ${progress.percent}%`);
      },
    });

    console.log('Success:', result);
    return result;
  } catch (error) {
    console.error('ZIP generation failed:', error);

    // Check error type and provide user-friendly message
    if (error instanceof Error) {
      if (error.message.includes('No files provided')) {
        console.error('User-friendly: Please select files to download');
      } else if (error.message.includes('compression level')) {
        console.error('User-friendly: Invalid settings, please try again');
      } else {
        console.error('User-friendly: Failed to create download. Please try again.');
      }
    }

    throw error;
  }
}

// ============================================================================
// Example 9: React component integration
// ============================================================================
export function Example9_ReactComponent() {
  /*
  import React, { useState } from 'react';
  import { generateZip, type ZipProgress } from './utils/zipGenerator';

  function BatchDownload({ files }: { files: File[] }) {
    const [progress, setProgress] = useState<ZipProgress | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleDownload = async () => {
      setIsGenerating(true);

      try {
        const zipFiles = files.map(file => ({
          name: file.name,
          data: file,
        }));

        await generateZip(zipFiles, {
          zipFileName: 'batch-download',
          autoDownload: true,
          compressionLevel: 6,
          onProgress: (p) => setProgress(p),
        });

        alert('Download started!');
      } catch (error) {
        console.error('Download failed:', error);
        alert('Download failed. Please try again.');
      } finally {
        setIsGenerating(false);
        setProgress(null);
      }
    };

    return (
      <div>
        <button onClick={handleDownload} disabled={isGenerating}>
          {isGenerating ? 'Generating...' : 'Download All'}
        </button>

        {progress && (
          <div>
            <div>Stage: {progress.stage}</div>
            <div>Progress: {progress.percent}%</div>
            <div>
              Files: {progress.filesProcessed} / {progress.totalFiles}
            </div>
            <progress value={progress.percent} max={100} />
          </div>
        )}
      </div>
    );
  }
  */
}

// ============================================================================
// Example 10: Advanced - Chunked processing for very large batches
// ============================================================================
export async function example10_ChunkedProcessing() {
  // Simulate a very large batch of files
  const allFiles: ZipFileInput[] = Array(500)
    .fill(null)
    .map((_, i) => ({
      name: `document-${i + 1}.pdf`,
      data: new Blob([`Content ${i}`]),
    }));

  // Process in chunks to avoid memory issues
  const chunkSize = 100;
  const chunks: ZipFileInput[][] = [];

  for (let i = 0; i < allFiles.length; i += chunkSize) {
    chunks.push(allFiles.slice(i, i + chunkSize));
  }

  console.log(`Processing ${chunks.length} chunks of ${chunkSize} files each`);

  // Create separate ZIPs for each chunk
  const results = await Promise.all(
    chunks.map((chunk, index) =>
      generateZip(chunk, {
        zipFileName: `batch-part-${index + 1}`,
        compressionLevel: 5,
        autoDownload: false, // Download programmatically later
        onProgress: (progress) => {
          console.log(`Chunk ${index + 1}: ${progress.percent}%`);
        },
      })
    )
  );

  // Optionally, trigger downloads sequentially
  for (const result of results) {
    // Manual download trigger with delay
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.fileName;
    link.click();
    URL.revokeObjectURL(url);

    // Wait a bit between downloads
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}

// ============================================================================
// Example 11: Date preservation and metadata
// ============================================================================
export async function example11_MetadataPreservation() {
  const files: ZipFileInput[] = [
    {
      name: 'old-document.pdf',
      data: new Blob(['Content']),
      lastModified: new Date('2020-01-01'),
    },
    {
      name: 'new-document.pdf',
      data: new Blob(['Content']),
      lastModified: new Date('2024-01-01'),
    },
  ];

  const result = await generateZip(files, {
    zipFileName: 'dated-documents',
    comment: 'Generated by Sola PDF Converter on ' + new Date().toISOString(),
  });

  return result;
}

// ============================================================================
// Example 12: Custom folder structure by date
// ============================================================================
export async function example12_DateBasedFolders() {
  const files: ZipFileInput[] = [
    {
      name: 'report-jan.pdf',
      data: new Blob(['Content']),
      lastModified: new Date('2024-01-15'),
    },
    {
      name: 'report-feb.pdf',
      data: new Blob(['Content']),
      lastModified: new Date('2024-02-15'),
    },
    {
      name: 'report-mar.pdf',
      data: new Blob(['Content']),
      lastModified: new Date('2024-03-15'),
    },
  ];

  // Organize by month
  const organizedFiles = organizeFilesIntoFolders(files, (file) => {
    if (file.lastModified) {
      const month = file.lastModified.toLocaleString('en-US', { month: 'long' });
      const year = file.lastModified.getFullYear();
      return `${year}/${month}`;
    }
    return 'Undated';
  });

  const result = await generateZip(organizedFiles, {
    zipFileName: 'reports-by-month',
  });

  // ZIP structure:
  // 2024/January/report-jan.pdf
  // 2024/February/report-feb.pdf
  // 2024/March/report-mar.pdf

  return result;
}
