/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Practical usage examples for integrating ZIP generator into Sola PDF Converter
 * This file shows how to add batch download functionality to existing components
 */

import React, { useState } from 'react';
import {
  generateZip,
  generateZipFromResults,
  organizeFilesIntoFolders,
  estimateZipSize,
  validateFiles,
  type ZipFileInput,
  type ZipProgress,
} from './zipGenerator';

// ============================================================================
// Example 1: Add batch download to existing converter component
// ============================================================================

interface ConversionResult {
  data: Uint8Array;
  name: string;
}

export function BatchDownloadButton({
  results,
  toolName,
}: {
  results: ConversionResult[];
  toolName: string;
}) {
  const [progress, setProgress] = useState<ZipProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (results.length === 0) return;

    setIsDownloading(true);
    try {
      await generateZipFromResults(
        results,
        `${toolName}-batch-${Date.now()}`,
        {
          compressionLevel: 5, // Balanced for PDFs
          autoDownload: true,
          onProgress: setProgress,
        }
      );
    } catch (error) {
      console.error('Batch download failed:', error);
      alert('Failed to create download. Please try again.');
    } finally {
      setIsDownloading(false);
      setProgress(null);
    }
  };

  if (results.length <= 1) return null;

  return (
    <div className="batch-download">
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className="download-button"
      >
        {isDownloading ? (
          <>
            Preparing Download... {progress?.percent ?? 0}%
          </>
        ) : (
          <>
            Download All ({results.length} files)
          </>
        )}
      </button>

      {progress && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress.percent}%` }}
          />
          <span className="progress-text">
            {progress.stage === 'adding' && 'Adding files...'}
            {progress.stage === 'compressing' && 'Compressing...'}
            {progress.stage === 'generating' && 'Creating ZIP...'}
            {progress.stage === 'complete' && 'Complete!'}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example 2: Enhanced file list with batch operations
// ============================================================================

export function FileListWithBatchDownload({
  files,
  onFilesChange,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
}) {
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);

  const handleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map((_, i) => i)));
    }
  };

  const handleDownloadSelected = async () => {
    const filesToDownload = files.filter((_, i) => selectedFiles.has(i));
    if (filesToDownload.length === 0) return;

    setIsDownloading(true);
    try {
      const zipFiles: ZipFileInput[] = filesToDownload.map(file => ({
        name: file.name,
        data: file,
      }));

      await generateZip(zipFiles, {
        zipFileName: `selected-files-${Date.now()}`,
        compressionLevel: 6,
        autoDownload: true,
        onProgress: (p) => {
          console.log(`Download progress: ${p.percent}%`);
        },
      });

      setSelectedFiles(new Set());
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div>
      <div className="batch-actions">
        <button onClick={handleSelectAll}>
          {selectedFiles.size === files.length ? 'Deselect All' : 'Select All'}
        </button>
        <button
          onClick={handleDownloadSelected}
          disabled={selectedFiles.size === 0 || isDownloading}
        >
          {isDownloading
            ? 'Downloading...'
            : `Download Selected (${selectedFiles.size})`}
        </button>
      </div>

      <div className="file-list">
        {files.map((file, index) => (
          <div key={index} className="file-item">
            <input
              type="checkbox"
              checked={selectedFiles.has(index)}
              onChange={(e) => {
                const newSelection = new Set(selectedFiles);
                if (e.target.checked) {
                  newSelection.add(index);
                } else {
                  newSelection.delete(index);
                }
                setSelectedFiles(newSelection);
              }}
            />
            <span>{file.name}</span>
            <span>{(file.size / 1024).toFixed(1)} KB</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Example 3: Organized batch download (by file type)
// ============================================================================

export function OrganizedBatchDownload({
  files,
}: {
  files: Array<{ name: string; data: Blob; type: string }>;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);

  const handleEstimate = () => {
    const zipFiles: ZipFileInput[] = files.map(f => ({
      name: f.name,
      data: f.data,
    }));

    const organized = organizeFilesIntoFolders(zipFiles, (file) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') return 'PDFs';
      if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return 'Images';
      if (['doc', 'docx'].includes(ext || '')) return 'Documents';
      return 'Other';
    });

    const size = estimateZipSize(organized, 6);
    setEstimatedSize(size);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const zipFiles: ZipFileInput[] = files.map(f => ({
        name: f.name,
        data: f.data,
      }));

      const organized = organizeFilesIntoFolders(zipFiles, (file) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') return 'PDFs';
        if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return 'Images';
        if (['doc', 'docx'].includes(ext || '')) return 'Documents';
        return 'Other';
      });

      await generateZip(organized, {
        zipFileName: 'organized-download',
        compressionLevel: 6,
        autoDownload: true,
        comment: 'Files organized by type - Created by Sola PDF Converter',
      });
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div>
      <div className="download-actions">
        <button onClick={handleEstimate}>Estimate Size</button>
        {estimatedSize && (
          <span>
            Estimated: {(estimatedSize / 1024 / 1024).toFixed(2)} MB
          </span>
        )}
      </div>

      <button onClick={handleDownload} disabled={isDownloading}>
        {isDownloading
          ? 'Creating Organized ZIP...'
          : 'Download Organized by Type'}
      </button>

      <p className="help-text">
        Files will be organized into folders: PDFs, Images, Documents, Other
      </p>
    </div>
  );
}

// ============================================================================
// Example 4: Smart download with validation
// ============================================================================

export function SmartBatchDownload({
  files,
}: {
  files: Array<{ name: string; data: Blob }>;
}) {
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState<ZipProgress | null>(null);

  const handleSmartDownload = async () => {
    try {
      setStatus('Validating files...');

      const zipFiles: ZipFileInput[] = files.map(f => ({
        name: f.name,
        data: f.data,
      }));

      // Validate first
      validateFiles(zipFiles, 500 * 1024 * 1024); // Max 500MB

      // Estimate size
      const estimatedSize = estimateZipSize(zipFiles, 6);
      const estimatedMB = estimatedSize / 1024 / 1024;

      setStatus(`Estimated size: ${estimatedMB.toFixed(2)} MB. Generating...`);

      // Choose compression based on size
      let compressionLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 = 6;
      if (estimatedMB > 100) {
        compressionLevel = 3; // Faster for large files
      } else if (estimatedMB < 10) {
        compressionLevel = 9; // Maximum compression for small files
      }

      await generateZip(zipFiles, {
        zipFileName: `download-${Date.now()}`,
        compressionLevel,
        autoDownload: true,
        onProgress: (p) => {
          setProgress(p);
          setStatus(
            `${p.stage}: ${p.filesProcessed}/${p.totalFiles} files (${p.percent}%)`
          );
        },
      });

      setStatus('Download complete!');
      setTimeout(() => setStatus(''), 3000);
    } catch (error: any) {
      if (error.message?.includes('size exceeds')) {
        setStatus('Error: Files are too large (max 500MB)');
      } else if (error.message?.includes('Too many files')) {
        setStatus('Error: Too many files (max 10,000)');
      } else {
        setStatus('Error: Failed to create download');
      }
      console.error(error);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div>
      <button onClick={handleSmartDownload}>Smart Download</button>

      {status && (
        <div className="status-message">
          {status}
        </div>
      )}

      {progress && (
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="progress-details">
            {progress.currentFile && (
              <span>Processing: {progress.currentFile}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example 5: Integration with existing conversion workflow
// ============================================================================

export function ConversionWorkflowWithBatchDownload() {
  const [originalFiles, setOriginalFiles] = useState<File[]>([]);
  const [convertedResults, setConvertedResults] = useState<ConversionResult[]>(
    []
  );
  const [isConverting, setIsConverting] = useState(false);

  const handleConversion = async () => {
    setIsConverting(true);
    try {
      // Simulate conversion process
      const results: ConversionResult[] = originalFiles.map((file, i) => ({
        data: new Uint8Array(1000), // Placeholder
        name: file.name.replace(/\.[^.]+$/, '.pdf'),
      }));

      setConvertedResults(results);
    } catch (error) {
      console.error('Conversion failed:', error);
    } finally {
      setIsConverting(false);
    }
  };

  const handleBatchDownload = async () => {
    if (convertedResults.length === 0) return;

    try {
      await generateZipFromResults(
        convertedResults,
        'converted-files',
        {
          compressionLevel: 4, // Low compression for PDFs
          autoDownload: true,
          onProgress: (p) => {
            console.log(`Batch download: ${p.percent}%`);
          },
        }
      );
    } catch (error) {
      console.error('Batch download failed:', error);
      alert('Failed to download files. Please try again.');
    }
  };

  return (
    <div className="conversion-workflow">
      <div className="upload-section">
        <input
          type="file"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            setOriginalFiles(files);
          }}
        />
        <button onClick={handleConversion} disabled={isConverting}>
          {isConverting ? 'Converting...' : 'Convert All'}
        </button>
      </div>

      {convertedResults.length > 0 && (
        <div className="results-section">
          <h3>Conversion Complete!</h3>
          <p>{convertedResults.length} files converted</p>

          <div className="download-options">
            {convertedResults.map((result, i) => (
              <div key={i} className="result-item">
                <span>{result.name}</span>
                <button
                  onClick={() => {
                    // Individual download
                    const blob = new Blob([result.data], {
                      type: 'application/pdf',
                    });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = result.name;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download
                </button>
              </div>
            ))}

            <button
              className="batch-download-button"
              onClick={handleBatchDownload}
            >
              Download All as ZIP
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CSS Styles (example)
// ============================================================================

export const zipDownloadStyles = `
.batch-download {
  margin: 20px 0;
}

.download-button {
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.download-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.progress-bar {
  position: relative;
  width: 100%;
  height: 30px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 10px;
}

.progress-fill {
  height: 100%;
  background: #007bff;
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #333;
  font-size: 12px;
  font-weight: bold;
}

.batch-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.file-list {
  border: 1px solid #ddd;
  border-radius: 4px;
  max-height: 400px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.file-item:last-child {
  border-bottom: none;
}

.status-message {
  margin-top: 10px;
  padding: 10px;
  background: #e3f2fd;
  border-radius: 4px;
  font-size: 14px;
}

.help-text {
  margin-top: 10px;
  font-size: 12px;
  color: #666;
}
`;
