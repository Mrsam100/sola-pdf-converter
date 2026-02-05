# ZIP Generator - Quick Integration Guide

## Quick Start (5 minutes)

### 1. Basic Download Button

Add a download button to your component:

```tsx
import { generateZip } from './utils/zipGenerator';

function DownloadButton({ files }: { files: File[] }) {
  const handleDownload = async () => {
    const zipFiles = files.map(f => ({ name: f.name, data: f }));
    await generateZip(zipFiles, {
      zipFileName: 'download',
      autoDownload: true,
    });
  };

  return <button onClick={handleDownload}>Download ZIP</button>;
}
```

### 2. With Progress Bar

```tsx
import { useState } from 'react';
import { generateZip, type ZipProgress } from './utils/zipGenerator';

function DownloadWithProgress({ files }: { files: File[] }) {
  const [progress, setProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const zipFiles = files.map(f => ({ name: f.name, data: f }));
      await generateZip(zipFiles, {
        zipFileName: 'download',
        autoDownload: true,
        onProgress: (p) => setProgress(p.percent),
      });
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div>
      <button onClick={handleDownload} disabled={isGenerating}>
        {isGenerating ? `Generating... ${progress}%` : 'Download ZIP'}
      </button>
      {isGenerating && <progress value={progress} max={100} />}
    </div>
  );
}
```

### 3. Batch Conversion Download

After converting multiple files:

```tsx
import { generateZipFromResults } from './utils/zipGenerator';

async function downloadConvertedFiles(results: Array<{ data: Uint8Array; name: string }>) {
  await generateZipFromResults(results, 'converted-files', {
    compressionLevel: 6,
    autoDownload: true,
    onProgress: (p) => console.log(`${p.stage}: ${p.percent}%`),
  });
}
```

## Integration with Existing Components

### PDF Converter Component

```tsx
// In your converter component
import { generateZipFromResults } from './utils/zipGenerator';

function PDFConverter() {
  const [convertedFiles, setConvertedFiles] = useState<
    Array<{ data: Uint8Array; name: string }>
  >([]);

  const handleBatchDownload = async () => {
    if (convertedFiles.length === 0) return;

    try {
      await generateZipFromResults(convertedFiles, 'batch-conversion', {
        compressionLevel: 5, // Faster for PDFs
        autoDownload: true,
        onProgress: (progress) => {
          // Update UI
          console.log(`Preparing download: ${progress.percent}%`);
        },
      });
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to create download. Please try again.');
    }
  };

  return (
    <div>
      {/* Your conversion UI */}
      {convertedFiles.length > 1 && (
        <button onClick={handleBatchDownload}>
          Download All ({convertedFiles.length} files)
        </button>
      )}
    </div>
  );
}
```

### File Manager Component

```tsx
import { generateZip, organizeFilesIntoFolders } from './utils/zipGenerator';

function FileManager({ files }: { files: File[] }) {
  const handleDownloadOrganized = async () => {
    // Organize by file type
    const zipFiles = files.map(f => ({ name: f.name, data: f }));
    const organized = organizeFilesIntoFolders(zipFiles, (file) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') return 'PDFs';
      if (['jpg', 'jpeg', 'png'].includes(ext || '')) return 'Images';
      return 'Other';
    });

    await generateZip(organized, {
      zipFileName: 'organized-files',
      autoDownload: true,
    });
  };

  return <button onClick={handleDownloadOrganized}>Download Organized</button>;
}
```

## Common Use Cases

### Use Case 1: Single File Downloads

```tsx
// Simple single file download
async function downloadSingleFile(blob: Blob, filename: string) {
  await generateZip(
    [{ name: filename, data: blob }],
    { zipFileName: filename.replace(/\.[^.]+$/, ''), autoDownload: true }
  );
}
```

### Use Case 2: Multiple File Downloads

```tsx
// Batch download with validation
import { validateFiles, generateZip } from './utils/zipGenerator';

async function downloadMultipleFiles(files: File[]) {
  const zipFiles = files.map(f => ({ name: f.name, data: f }));

  try {
    validateFiles(zipFiles, 500 * 1024 * 1024); // Max 500MB
    await generateZip(zipFiles, {
      zipFileName: 'batch-download',
      autoDownload: true,
    });
  } catch (error) {
    alert('Files are too large or invalid');
  }
}
```

### Use Case 3: Conversion Pipeline

```tsx
// After batch conversion
async function completeConversion(
  originalFiles: File[],
  convertedData: Uint8Array[]
) {
  const results = convertedData.map((data, i) => ({
    data,
    name: originalFiles[i].name.replace(/\.[^.]+$/, '.pdf'),
  }));

  await generateZipFromResults(results, 'converted-pdfs', {
    compressionLevel: 4, // Low compression for PDFs (already compressed)
    autoDownload: true,
  });
}
```

## Error Handling Best Practices

```tsx
import { generateZip, ZipGenerationError } from './utils/zipGenerator';

async function safeDownload(files: File[]) {
  try {
    const zipFiles = files.map(f => ({ name: f.name, data: f }));
    await generateZip(zipFiles, {
      zipFileName: 'download',
      autoDownload: true,
    });
  } catch (error) {
    if (error instanceof ZipGenerationError) {
      // Show user-friendly message
      if (error.message.includes('No files')) {
        alert('Please select files to download');
      } else if (error.message.includes('size exceeds')) {
        alert('Files are too large. Please select fewer files.');
      } else {
        alert('Download failed. Please try again.');
      }
    } else {
      console.error('Unexpected error:', error);
      alert('An unexpected error occurred.');
    }
  }
}
```

## Performance Optimization

### For Large Files (>100MB total)

```tsx
await generateZip(files, {
  compressionLevel: 1, // Faster, less compression
  streamFiles: true,   // Enable streaming
  chunkSize: 128 * 1024 * 1024, // 128MB chunks
});
```

### For Many Small Files (>100 files)

```tsx
await generateZip(files, {
  compressionLevel: 6, // Good compression
  streamFiles: false,  // Batch mode is faster for small files
});
```

### For Mixed Sizes

```tsx
await generateZip(files, {
  compressionLevel: 5, // Balanced
  streamFiles: true,   // Safe default
});
```

## UI Components

### Complete Download Manager

```tsx
import { useState } from 'react';
import {
  generateZip,
  estimateZipSize,
  type ZipProgress,
} from './utils/zipGenerator';

function DownloadManager({ files }: { files: File[] }) {
  const [progress, setProgress] = useState<ZipProgress | null>(null);
  const [estimatedSize, setEstimatedSize] = useState<number>(0);

  const handleEstimate = () => {
    const zipFiles = files.map(f => ({ name: f.name, data: f }));
    const size = estimateZipSize(zipFiles, 6);
    setEstimatedSize(size);
  };

  const handleDownload = async () => {
    const zipFiles = files.map(f => ({ name: f.name, data: f }));
    await generateZip(zipFiles, {
      zipFileName: 'download',
      compressionLevel: 6,
      autoDownload: true,
      onProgress: setProgress,
    });
    setProgress(null);
  };

  return (
    <div>
      <div>Files selected: {files.length}</div>
      <button onClick={handleEstimate}>Estimate Size</button>
      {estimatedSize > 0 && (
        <div>Estimated ZIP size: {(estimatedSize / 1024 / 1024).toFixed(2)} MB</div>
      )}
      <button onClick={handleDownload} disabled={!!progress}>
        Download ZIP
      </button>
      {progress && (
        <div>
          <div>{progress.stage}</div>
          <progress value={progress.percent} max={100} />
          <div>{progress.percent}%</div>
        </div>
      )}
    </div>
  );
}
```

## Testing Your Integration

```tsx
// Test with sample data
const testFiles = [
  new File(['Test 1'], 'test1.txt', { type: 'text/plain' }),
  new File(['Test 2'], 'test2.txt', { type: 'text/plain' }),
];

// Should work without errors
await generateZip(
  testFiles.map(f => ({ name: f.name, data: f })),
  { zipFileName: 'test', autoDownload: false }
);
```

## Troubleshooting

### Issue: Download doesn't start
- Check `autoDownload: true` is set
- Ensure user interaction triggered the download (browser requirement)

### Issue: Memory issues with large files
- Reduce `chunkSize`
- Lower `compressionLevel`
- Enable `streamFiles: true`

### Issue: Progress not updating
- Make sure `onProgress` callback is set
- Check that callback updates state/UI

### Issue: File names are mangled
- Files are automatically sanitized for safety
- Use `folder` property for organization

## Next Steps

1. See `zipGenerator.README.md` for complete API documentation
2. Check `zipGenerator.example.ts` for 12 detailed examples
3. Review `zipGenerator.test.ts` for test cases and edge cases
4. Integrate into your components following patterns above

## Support

For issues or questions:
1. Check the main README
2. Review test cases for examples
3. See example file for advanced usage
