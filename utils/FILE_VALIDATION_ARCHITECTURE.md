# File Validation System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FILE VALIDATION SYSTEM                               │
│                    Production-Ready Architecture                         │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User Tier  │────▶│  Validation  │────▶│  Processing  │
│  Management  │     │    Engine    │     │    Layer     │
└──────────────┘     └──────────────┘     └──────────────┘
       │                     │                     │
       │                     │                     │
       ▼                     ▼                     ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │     │   Memory     │     │   Progress   │
│ Capabilities │     │   Manager    │     │   Tracker    │
└──────────────┘     └──────────────┘     └──────────────┘
```

## Core Components

### 1. FileSizeValidator
**Purpose**: Main validation engine for file size and security checks

**Responsibilities**:
- Single file validation
- Batch file validation
- User tier enforcement
- Memory estimation
- Processing time estimation
- Security scanning integration

**Key Methods**:
```typescript
validateFile(file, operationType) → ValidationResult
validateBatch(files, operationType) → BatchValidationResult
setUserTier(tier)
getWarningMessage(fileSize, operationType)
```

**Flow**:
```
File Input
   │
   ▼
Size Check ──✗──▶ Error: "File too large"
   │
   ✓
   ▼
Memory Check ──✗──▶ Error: "Insufficient memory"
   │
   ✓
   ▼
Security Scan ──✗──▶ Error: "Malicious file detected"
   │
   ✓
   ▼
Generate Warnings (if applicable)
   │
   ▼
Return ValidationResult
```

### 2. BrowserCapabilityDetector
**Purpose**: Detect and cache browser/device capabilities

**Responsibilities**:
- Device type detection (mobile/tablet/desktop)
- Memory availability detection
- Feature support detection (Workers, WASM, OffscreenCanvas)
- Capability caching (30-second cache)
- Max concurrent operation calculation

**Key Methods**:
```typescript
getCapabilities() → BrowserCapability
canHandle(operationType, totalSize) → { canHandle, reason? }
```

**Detection Logic**:
```
Screen Size
   │
   ├─ < 768px ────▶ Mobile
   ├─ < 1024px ───▶ Tablet
   └─ >= 1024px ──▶ Desktop
        │
        ▼
Memory Detection
   │
   ├─ Chrome/Edge ─▶ performance.memory API
   └─ Other ───────▶ Estimated based on device
        │
        ▼
Calculate Max Concurrent Operations
   │
   ├─ Mobile ──────▶ 2-3 concurrent
   ├─ Tablet ──────▶ 3-4 concurrent
   └─ Desktop ─────▶ 5-8 concurrent
```

### 3. ProgressTracker
**Purpose**: Track and report processing progress in real-time

**Responsibilities**:
- Overall progress calculation
- Per-file progress tracking
- Time remaining estimation
- Bytes processed tracking
- Completed files tracking

**Key Methods**:
```typescript
start(files)
updateFileProgress(bytesProcessed, totalBytes)
completeFile(fileName)
getProgress() → ProgressEstimation
reset()
```

**Progress Calculation**:
```
Overall Progress = (completedFiles + currentFileProgress) / totalFiles × 100

Time Remaining = (elapsedTime / currentProgress) × (100 - currentProgress)

Bytes Progress = bytesProcessed / totalBytes × 100
```

### 4. MemoryCleanupManager
**Purpose**: Prevent memory leaks and manage resource cleanup

**Responsibilities**:
- Object URL tracking and revocation
- Blob reference management
- ArrayBuffer tracking
- Delayed cleanup scheduling
- Memory statistics reporting

**Key Methods**:
```typescript
registerObjectUrl(url)
registerBlob(blob)
registerArrayBuffer(buffer)
revokeObjectUrl(url)
cleanup()
```

**Cleanup Flow**:
```
Resource Created
   │
   ▼
Register in Manager
   │
   ▼
Use Resource
   │
   ▼
Call cleanup() or cleanupDelayed()
   │
   ▼
Revoke Object URLs
   │
   ▼
Clear References
   │
   ▼
Request GC (if available)
```

## Data Flow Architecture

### Single File Validation Flow

```
┌──────────┐
│   File   │
└────┬─────┘
     │
     ▼
┌─────────────────────────────────────┐
│   FileSizeValidator.validateFile    │
└────┬────────────────────────────────┘
     │
     ├─▶ Check file size vs. limit
     │   (based on UserTier + OperationType)
     │
     ├─▶ Estimate memory usage
     │   (fileSize × MEMORY_MULTIPLIERS[op])
     │
     ├─▶ Check browser capability
     │   (BrowserCapabilityDetector.canHandle)
     │
     ├─▶ Security scan
     │   (scanFileContent from inputValidation)
     │
     └─▶ Generate warnings
         (large file, high memory, etc.)
     │
     ▼
┌────────────────────┐
│  ValidationResult  │
│  - valid: boolean  │
│  - error?: string  │
│  - warning?: string│
│  - details?: {...} │
└────────────────────┘
```

### Batch Validation Flow

```
┌──────────────┐
│  File Array  │
└──────┬───────┘
       │
       ▼
┌────────────────────────────────────┐
│  FileSizeValidator.validateBatch   │
└──────┬─────────────────────────────┘
       │
       ├─▶ Check file count vs. maxFiles
       │
       ├─▶ Calculate total size
       │   (sum of all file sizes)
       │
       ├─▶ Check total size vs. maxTotalSize
       │
       ├─▶ Validate each file individually
       │   (parallel validation)
       │
       ├─▶ Check total memory requirements
       │   (totalSize × MEMORY_MULTIPLIERS[op])
       │
       └─▶ Aggregate results
           (errors, warnings, summary)
       │
       ▼
┌──────────────────────────┐
│  BatchValidationResult   │
│  - valid: boolean        │
│  - errors: string[]      │
│  - warnings: string[]    │
│  - summary: {...}        │
│  - fileResults: Map      │
└──────────────────────────┘
```

### Processing with Progress Flow

```
┌──────────────┐
│  File Array  │
└──────┬───────┘
       │
       ▼
┌──────────────────────────┐
│  progressTracker.start() │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  For each file:          │
├──────────────────────────┤
│  1. setCurrentFile()     │
│  2. Process file         │
│  3. updateFileProgress() │
│  4. completeFile()       │
└──────┬───────────────────┘
       │
       ├─▶ UI reads getProgress()
       │   - currentFile
       │   - overallProgress
       │   - estimatedTimeRemaining
       │
       ▼
┌──────────────────────────┐
│  progressTracker.reset() │
└──────────────────────────┘
```

## Memory Management Architecture

### Resource Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    RESOURCE LIFECYCLE                        │
└─────────────────────────────────────────────────────────────┘

1. CREATION
   ┌──────────────┐
   │ Create Blob  │
   └──────┬───────┘
          │
          ▼
   ┌──────────────────────┐
   │ URL.createObjectURL  │
   └──────┬───────────────┘
          │
          ▼
   ┌─────────────────────────────────────┐
   │ memoryCleanupManager.registerURL()  │
   └──────┬──────────────────────────────┘

2. USAGE
          │
          ▼
   ┌──────────────────┐
   │  Use in <img>    │
   │  Use in Worker   │
   │  Download link   │
   └──────┬───────────┘

3. CLEANUP
          │
          ▼
   ┌────────────────────────────────┐
   │ memoryCleanupManager.cleanup() │
   └──────┬─────────────────────────┘
          │
          ├─▶ URL.revokeObjectURL()
          ├─▶ Clear references
          └─▶ Request GC
```

### Memory Estimation

```
File Size: 10 MB
Operation: PDF_TO_IMAGE
Multiplier: 4x (from MEMORY_MULTIPLIERS)

Estimated Memory = 10 MB × 4 = 40 MB

┌────────────────────────────────────┐
│   Memory Requirement Check         │
├────────────────────────────────────┤
│ Available Memory: 500 MB           │
│ Required Memory: 40 MB             │
│ Usage After: 540 MB / 2048 MB      │
│ Percentage: 26.4%                  │
│                                    │
│ Status: ✓ OK (< 90% threshold)    │
└────────────────────────────────────┘
```

## User Tier System

### Tier Hierarchy

```
┌──────────────────────────────────────────────────────────┐
│                    USER TIER SYSTEM                       │
└──────────────────────────────────────────────────────────┘

FREE TIER
┌────────────────────────────────────┐
│ Max File Size:                     │
│ - Images: 10 MB                    │
│ - PDFs: 50 MB                      │
│ - Documents: 25 MB                 │
│                                    │
│ Batch Limits:                      │
│ - Max Files: 20                    │
│ - Total Size: 100 MB               │
│ - Concurrent: 3                    │
└────────────────────────────────────┘
            │
            │ UPGRADE
            ▼
PREMIUM TIER
┌────────────────────────────────────┐
│ Max File Size:                     │
│ - Images: 100 MB                   │
│ - PDFs: 200 MB                     │
│ - Documents: 100 MB                │
│                                    │
│ Batch Limits:                      │
│ - Max Files: 100                   │
│ - Total Size: 500 MB               │
│ - Concurrent: 5                    │
└────────────────────────────────────┘
            │
            │ UPGRADE
            ▼
ENTERPRISE TIER
┌────────────────────────────────────┐
│ Max File Size:                     │
│ - Images: 500 MB                   │
│ - PDFs: 1 GB                       │
│ - Documents: 500 MB                │
│                                    │
│ Batch Limits:                      │
│ - Max Files: 500                   │
│ - Total Size: 5 GB                 │
│ - Concurrent: 10                   │
└────────────────────────────────────┘
```

## Security Architecture

### Multi-Layer Security

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                           │
└─────────────────────────────────────────────────────────────┘

Layer 1: FILE TYPE VALIDATION
┌────────────────────────────────────┐
│ - Check MIME type                  │
│ - Check file extension             │
│ - Accept if either matches         │
└────────────────────────────────────┘
            │
            ▼
Layer 2: SIZE VALIDATION
┌────────────────────────────────────┐
│ - Check against tier limits        │
│ - Prevent DoS via large files      │
│ - Check batch total size           │
└────────────────────────────────────┘
            │
            ▼
Layer 3: CONTENT SCANNING
┌────────────────────────────────────┐
│ - Read first 1KB of file           │
│ - Check magic bytes                │
│ - Detect executables (MZ, ELF)     │
│ - Detect scripts (#!)              │
└────────────────────────────────────┘
            │
            ▼
Layer 4: MEMORY PROTECTION
┌────────────────────────────────────┐
│ - Estimate memory usage            │
│ - Check available memory           │
│ - Prevent browser crashes          │
└────────────────────────────────────┘
            │
            ▼
Layer 5: INPUT SANITIZATION
┌────────────────────────────────────┐
│ - Sanitize file names              │
│ - Prevent path traversal           │
│ - Remove dangerous characters      │
└────────────────────────────────────┘
```

### Malicious File Detection

```
File Header (First 1024 bytes)
        │
        ▼
   ┌─────────┐
   │ Read    │
   │ Bytes   │
   └────┬────┘
        │
        ▼
Compare against known signatures:
        │
        ├─▶ [0x4D, 0x5A] ────▶ EXE ──▶ REJECT
        ├─▶ [0x7F, 0x45, ...] ▶ ELF ──▶ REJECT
        ├─▶ [0x23, 0x21] ────▶ Script ▶ REJECT
        └─▶ No match ─────────────────▶ ACCEPT
```

## Performance Optimization

### Caching Strategy

```
┌─────────────────────────────────────────────────────────────┐
│              BROWSER CAPABILITY CACHING                      │
└─────────────────────────────────────────────────────────────┘

Request 1 (t=0s)
   │
   ▼
Detect Capabilities ─────▶ Cache Result (TTL: 30s)
   │
   ▼
Return Result

Request 2 (t=10s)
   │
   ▼
Check Cache ──▶ Hit! ──▶ Return Cached Result

Request 3 (t=35s)
   │
   ▼
Check Cache ──▶ Expired ──▶ Re-detect ──▶ Update Cache
   │
   ▼
Return Result
```

### Concurrent Processing

```
┌─────────────────────────────────────────────────────────────┐
│              OPTIMAL BATCH PROCESSING                        │
└─────────────────────────────────────────────────────────────┘

Device Type: Desktop
Max Concurrent: 8

Files: [F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, F11, F12]
        │
        ▼
Batch 1: [F1, F2, F3, F4, F5, F6, F7, F8] ──▶ Process ──▶ Cleanup
        │
        ▼
Batch 2: [F9, F10, F11, F12] ──────────────▶ Process ──▶ Cleanup

Time Saved = Sequential Time - Concurrent Time
           = 12 × T - 2 × T (approx)
           = 10 × T saved!
```

## Integration Points

### With Existing Systems

```
┌─────────────────────────────────────────────────────────────┐
│                  SYSTEM INTEGRATIONS                         │
└─────────────────────────────────────────────────────────────┘

FILE VALIDATION SYSTEM
        │
        ├─▶ monitoring.ts
        │   - logger.info()
        │   - performanceMonitor.startTimer()
        │   - Error tracking
        │
        ├─▶ inputValidation.ts
        │   - scanFileContent()
        │   - sanitizeFilename()
        │
        ├─▶ memoryManagement.ts
        │   - createBlobURL()
        │   - revokeBlobURL()
        │   - getMemoryUsage()
        │
        └─▶ UI Components
            - File upload forms
            - Progress bars
            - Error messages
            - Upgrade prompts
```

## State Machine

### Validation State Flow

```
┌──────────┐
│   IDLE   │
└────┬─────┘
     │ validateFile() or validateBatch()
     ▼
┌──────────────┐
│  VALIDATING  │
└────┬─────────┘
     │
     ├─▶ Size Check
     ├─▶ Memory Check
     ├─▶ Security Scan
     │
     ▼
┌──────────────┐      ┌──────────────┐
│   VALID      │      │   INVALID    │
└──────────────┘      └──────────────┘
     │                      │
     │                      ├─▶ Show Error
     │                      └─▶ Suggest Upgrade
     ▼
┌──────────────┐
│  PROCESSING  │
└────┬─────────┘
     │
     ├─▶ Track Progress
     ├─▶ Update UI
     │
     ▼
┌──────────────┐
│  COMPLETED   │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│   CLEANUP    │
└──────────────┘
```

## Scalability Design

### Handling Millions of Users

```
┌─────────────────────────────────────────────────────────────┐
│              SCALABILITY FEATURES                            │
└─────────────────────────────────────────────────────────────┘

CLIENT-SIDE VALIDATION
┌────────────────────────────────────┐
│ ✓ No server load                  │
│ ✓ Instant feedback                │
│ ✓ Reduced API calls                │
└────────────────────────────────────┘

EFFICIENT CACHING
┌────────────────────────────────────┐
│ ✓ Browser capabilities (30s TTL)  │
│ ✓ Reduces repeated calculations    │
│ ✓ Memory-efficient                 │
└────────────────────────────────────┘

MEMORY AWARENESS
┌────────────────────────────────────┐
│ ✓ Prevents browser crashes         │
│ ✓ Adapts to device capabilities    │
│ ✓ Automatic cleanup                │
└────────────────────────────────────┘

PROGRESSIVE LIMITS
┌────────────────────────────────────┐
│ ✓ Free tier: Lower limits          │
│ ✓ Premium: Higher limits            │
│ ✓ Distributes server load          │
└────────────────────────────────────┘

ASYNC VALIDATION
┌────────────────────────────────────┐
│ ✓ Non-blocking operations          │
│ ✓ Parallel file validation         │
│ ✓ Responsive UI                    │
└────────────────────────────────────┘
```

## Error Handling Flow

```
┌──────────────┐
│    Error     │
└──────┬───────┘
       │
       ├─▶ File too large
       │   └─▶ Show upgrade suggestion
       │
       ├─▶ Too many files
       │   └─▶ Show batch limit
       │
       ├─▶ Insufficient memory
       │   └─▶ Suggest closing tabs
       │
       ├─▶ Malicious file
       │   └─▶ Block and warn user
       │
       └─▶ Unknown error
           └─▶ Log and show generic error
```

## Monitoring and Logging

```
┌─────────────────────────────────────────────────────────────┐
│                  MONITORING POINTS                           │
└─────────────────────────────────────────────────────────────┘

Performance Metrics:
- file_validation (single)
- batch_validation
- Average validation time
- Peak memory usage

Success/Error Tracking:
- Validation pass/fail rates
- Error types distribution
- User tier distribution
- Operation type usage

User Experience:
- File size distribution
- Batch size distribution
- Processing time
- Upgrade conversion rate
```

## Future Enhancements

```
PLANNED FEATURES
├── WebWorker Integration
│   └── Offload validation to background thread
├── Server-Side Validation
│   └── Additional security layer
├── ML-based Threat Detection
│   └── Advanced malware detection
├── Progressive File Upload
│   └── Upload while validating
└── Smart Caching
    └── Predict user needs, pre-validate
```

---

**Last Updated:** 2026-02-05
**Version:** 1.0.0
