# ZIP Generator Utility

Production-level ZIP file generator for batch downloads with stream-based processing, progress tracking, and memory-efficient handling of large files.

## Features

- **Stream-based ZIP creation** - Doesn't load all files in memory
- **Progress tracking** - Real-time progress callbacks with detailed information
- **File naming** - Automatic handling of conflicts and sanitization
- **Compression control** - Adjustable compression levels (0-9)
- **Large file support** - Chunked processing for optimal memory usage
- **Browser compatible** - Uses JSZip for cross-browser support
- **TypeScript support** - Full type definitions included
- **Error handling** - Comprehensive error handling with custom error types
- **Folder organization** - Support for organizing files into folder structures
- **Metadata preservation** - Maintains file modification dates

## Installation

The required dependency (JSZip) is already included in the project:

```bash
npm install jszip
npm install --save-dev @types/jszip
```

## Basic Usage

### Simple ZIP generation with auto-download

```typescript
import { generateZip } from './utils/zipGenerator';

const files = [
  { name: 'document1.pdf', data: pdfBlob1 },
  { name: 'document2.pdf', data: pdfBlob2 },
];

const result = await generateZip(files, {
  zipFileName: 'my-documents',
  autoDownload: true,
});

console.log(`Generated ${result.fileName} (${result.size} bytes)`);
```

### Progress tracking

```typescript
const result = await generateZip(files, {
  zipFileName: 'batch-download',
  onProgress: (progress) => {
    console.log(`${progress.stage}: ${progress.percent}%`);
    console.log(`Processing ${progress.currentFile}`);
    console.log(`Files: ${progress.filesProcessed}/${progress.totalFiles}`);
  },
});
```

### Compression level control

```typescript
// Fast compression (larger file)
const fast = await generateZip(files, {
  compressionLevel: 1,
});

// Maximum compression (smaller file, slower)
const compressed = await generateZip(files, {
  compressionLevel: 9,
});
```

## Advanced Usage

### Organizing files into folders

```typescript
import { generateZip, organizeFilesIntoFolders } from './utils/zipGenerator';

const files = [
  { name: 'report.pdf', data: blob1 },
  { name: 'photo.jpg', data: blob2 },
];

const organized = organizeFilesIntoFolders(files, (file) => {
  if (file.name.endsWith('.pdf')) return 'documents';
  if (file.name.endsWith('.jpg')) return 'images';
  return 'other';
});

await generateZip(organized, { zipFileName: 'organized-files' });

// ZIP structure:
// documents/report.pdf
// images/photo.jpg
```

### Validation before generation

```typescript
import { validateFiles, generateZip } from './utils/zipGenerator';

try {
  // Validate files (max 100MB)
  validateFiles(files, 100 * 1024 * 1024);

  // Generate ZIP
  const result = await generateZip(files, {
    zipFileName: 'validated-files',
  });
} catch (error) {
  console.error('Validation or generation failed:', error);
}
```

### Size estimation

```typescript
import { estimateZipSize } from './utils/zipGenerator';

const estimatedSize = estimateZipSize(files, 6);
console.log(`Estimated ZIP size: ${estimatedSize} bytes`);

if (estimatedSize > 50 * 1024 * 1024) {
  console.warn('ZIP will be larger than 50MB');
}
```

### Batch conversion results

```typescript
import { generateZipFromResults } from './utils/zipGenerator';

const conversionResults = [
  { data: pdfData1, name: 'converted1.pdf' },
  { data: pdfData2, name: 'converted2.pdf' },
];

const result = await generateZipFromResults(
  conversionResults,
  'batch-conversion',
  {
    compressionLevel: 6,
    autoDownload: true,
  }
);
```

## React Integration

```tsx
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
        onProgress: setProgress,
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
          <div>Files: {progress.filesProcessed} / {progress.totalFiles}</div>
          <progress value={progress.percent} max={100} />
        </div>
      )}
    </div>
  );
}
```

## API Reference

### `generateZip(files, options?)`

Generates a ZIP file from an array of files with progress tracking.

**Parameters:**
- `files: ZipFileInput[]` - Array of files to include in the ZIP
- `options?: ZipGeneratorOptions` - Configuration options

**Returns:** `Promise<ZipGenerationResult>`

**Example:**
```typescript
const result = await generateZip(files, {
  compressionLevel: 6,
  zipFileName: 'my-archive',
  autoDownload: true,
  onProgress: (progress) => console.log(progress.percent),
});
```

### `generateZipFromResults(results, baseFileName?, options?)`

Generates a ZIP file from conversion results with automatic naming.

**Parameters:**
- `results: Array<{ data: Uint8Array | Blob; name: string }>` - Conversion results
- `baseFileName?: string` - Base name for the ZIP file (default: 'converted-files')
- `options?: Omit<ZipGeneratorOptions, 'zipFileName'>` - Additional options

**Returns:** `Promise<ZipGenerationResult>`

### `estimateZipSize(files, compressionLevel?)`

Estimates the compressed size of a ZIP file.

**Parameters:**
- `files: ZipFileInput[]` - Array of files to estimate
- `compressionLevel?: CompressionLevel` - Compression level (0-9, default: 6)

**Returns:** `number` - Estimated size in bytes

### `validateFiles(files, maxTotalSize?)`

Validates files before ZIP generation.

**Parameters:**
- `files: ZipFileInput[]` - Array of files to validate
- `maxTotalSize?: number` - Maximum total size in bytes (default: 2GB)

**Throws:** `ZipGenerationError` if validation fails

### `organizeFilesIntoFolders(files, folderMapping)`

Creates a folder structure in the ZIP.

**Parameters:**
- `files: ZipFileInput[]` - Files to organize
- `folderMapping: (file: ZipFileInput) => string` - Function to determine folder for each file

**Returns:** `ZipFileInput[]` - Files with folder assignments

## Type Definitions

### `ZipFileInput`

```typescript
interface ZipFileInput {
  name: string;                          // File name in the ZIP archive
  data: Blob | Uint8Array | ArrayBuffer; // File data
  folder?: string;                       // Optional folder path (e.g., 'documents/pdfs')
  lastModified?: Date;                   // Optional last modified date
}
```

### `ZipGeneratorOptions`

```typescript
interface ZipGeneratorOptions {
  compressionLevel?: CompressionLevel;   // 0-9 (default: 6)
  onProgress?: (progress: ZipProgress) => void;
  zipFileName?: string;                  // Without .zip extension (default: 'download')
  autoDownload?: boolean;                // Auto-trigger download (default: false)
  chunkSize?: number;                    // Max chunk size in bytes (default: 64MB)
  comment?: string;                      // ZIP file comment
  streamFiles?: boolean;                 // Enable streaming (default: true)
}
```

### `ZipProgress`

```typescript
interface ZipProgress {
  stage: 'adding' | 'compressing' | 'generating' | 'complete';
  currentFile?: string;                  // Current file being processed
  filesProcessed: number;                // Number of files processed so far
  totalFiles: number;                    // Total number of files
  percent: number;                       // Overall progress percentage (0-100)
  bytesProcessed?: number;               // Estimated bytes processed
  totalBytes?: number;                   // Total bytes to process
}
```

### `ZipGenerationResult`

```typescript
interface ZipGenerationResult {
  blob: Blob;                            // The generated ZIP as a Blob
  fileName: string;                      // File name of the ZIP
  size: number;                          // Size of the ZIP in bytes
  fileCount: number;                     // Number of files included
  generationTime: number;                // Time taken to generate (ms)
}
```

### `CompressionLevel`

```typescript
type CompressionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
```

- `0` - No compression (fastest)
- `1-3` - Low compression
- `4-6` - Medium compression (default: 6)
- `7-9` - High compression (slowest)

## Error Handling

The utility throws `ZipGenerationError` for various error conditions:

```typescript
import { ZipGenerationError } from './utils/zipGenerator';

try {
  const result = await generateZip(files);
} catch (error) {
  if (error instanceof ZipGenerationError) {
    console.error('ZIP generation failed:', error.message);
    console.error('Cause:', error.cause);
    console.error('Context:', error.context);
  }
}
```

Common error scenarios:
- No files provided
- Invalid compression level
- Files exceeding maximum size
- Invalid file data
- Empty file names

## Performance Considerations

### Memory Efficiency

The utility is optimized for memory efficiency:

- Uses streaming for files larger than `chunkSize` (default: 64MB)
- Processes files sequentially to avoid memory spikes
- Automatically releases resources after generation

### Compression Performance

Compression level affects both speed and file size:

| Level | Speed | Compression | Use Case |
|-------|-------|-------------|----------|
| 0-1   | Fast  | Minimal     | Quick downloads, pre-compressed files |
| 4-6   | Medium| Good        | General use (recommended) |
| 7-9   | Slow  | Maximum     | Size-critical scenarios |

### Best Practices

1. **Use appropriate compression**: Default (6) is good for most cases
2. **Enable streaming**: Keep `streamFiles: true` for large files
3. **Validate first**: Use `validateFiles()` before generation
4. **Estimate size**: Use `estimateZipSize()` to check before generation
5. **Track progress**: Provide user feedback with `onProgress`
6. **Handle errors**: Always wrap in try-catch
7. **Organize files**: Use folder structure for better organization
8. **Chunk large batches**: Split very large batches into multiple ZIPs

## Browser Compatibility

The utility works in all modern browsers that support:
- Blob API
- FileReader API
- Promise API
- ES6+ features

Tested in:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Testing

Run the comprehensive test suite:

```bash
npm test -- zipGenerator.test.ts
```

The test suite includes:
- 41 unit tests covering all functionality
- Edge case handling
- Error scenarios
- Performance benchmarks
- Memory efficiency tests

## Examples

See `zipGenerator.example.ts` for comprehensive usage examples including:
1. Basic ZIP generation
2. Progress tracking
3. Compression control
4. Organized folders
5. Batch conversion
6. Size estimation
7. File validation
8. Error handling
9. React integration
10. Chunked processing
11. Metadata preservation
12. Date-based organization

## Security

The utility implements several security measures:

- **Path traversal prevention**: Sanitizes file names to remove `..` patterns
- **Invalid character removal**: Removes characters that could cause issues
- **Size limits**: Validates total size before generation
- **File count limits**: Maximum 10,000 files per ZIP
- **Input validation**: Checks for empty or invalid data

## License

Apache-2.0

## Support

For issues or questions, please refer to the main project documentation or create an issue in the project repository.
