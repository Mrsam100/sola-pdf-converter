/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Maximum canvas dimension (most browsers support up to 16384)
 * Conservative limit to prevent browser tab crashes
 */
const MAX_DIMENSION = 16384;

/**
 * Validate image dimensions after loading.
 * Prevents browser crashes from extremely large images.
 */
const validateDimensions = (width: number, height: number): void => {
    if (width <= 0 || height <= 0) {
        throw new Error('Image has invalid dimensions. The file may be corrupted.');
    }
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        throw new Error(
            `Image dimensions (${width}x${height}) exceed the maximum supported size of ${MAX_DIMENSION}x${MAX_DIMENSION}px. Please resize the image first.`
        );
    }
    if (width * height > 100_000_000) {
        throw new Error(
            'Image has too many pixels (over 100 million). This would consume too much memory. Please resize the image first.'
        );
    }
};

/**
 * Load an image from a File, returning the HTMLImageElement.
 * Automatically revokes the object URL after loading to prevent memory leaks.
 */
const loadImage = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            img.src = '';
            reject(new Error('Image took too long to load. The file may be corrupted.'));
        }, 30_000);

        img.onload = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(objectUrl);
            resolve(img);
        };

        img.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image. The file may be corrupted or in an unsupported format.'));
        };

        img.src = objectUrl;
    });
};

/** Allowlist of safe image MIME types (excludes SVG which can contain scripts) */
const SAFE_IMAGE_TYPES = new Set([
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
    'image/heic', 'image/heif', 'image/bmp', 'image/tiff', 'image/gif',
]);

/** Validate file is a safe image type and not empty */
const validateImageType = (file: File): void => {
    if (!file.type || !SAFE_IMAGE_TYPES.has(file.type)) {
        throw new Error('Please select a valid image file (PNG, JPG, WebP, HEIC, BMP, or TIFF).');
    }
    if (file.size === 0) {
        throw new Error('The selected file is empty.');
    }
};

/**
 * Remove background using canvas-based edge-pixel color detection.
 * Works best on solid-color backgrounds. Used as fallback when ML model is unavailable.
 */
export const removeBackgroundCanvas = async (file: File, threshold: number = 30): Promise<Blob> => {
    validateImageType(file);

    const img = await loadImage(file);

    validateDimensions(img.width, img.height);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not get canvas context');
    }

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Sample edge pixels to determine background color (more robust)
    const samplePoints = [];

    // Sample top and bottom edges
    for (let x = 0; x < canvas.width; x += Math.max(1, Math.floor(canvas.width / 20))) {
        samplePoints.push({ x, y: 0 });
        samplePoints.push({ x, y: canvas.height - 1 });
    }

    // Sample left and right edges
    for (let y = 0; y < canvas.height; y += Math.max(1, Math.floor(canvas.height / 20))) {
        samplePoints.push({ x: 0, y });
        samplePoints.push({ x: canvas.width - 1, y });
    }

    // Calculate average background color
    let bgR = 0, bgG = 0, bgB = 0;
    samplePoints.forEach(point => {
        const i = (point.y * canvas.width + point.x) * 4;
        bgR += data[i];
        bgG += data[i + 1];
        bgB += data[i + 2];
    });
    bgR /= samplePoints.length;
    bgG /= samplePoints.length;
    bgB /= samplePoints.length;

    // Remove background by making similar colors transparent
    // Use squared distances to avoid expensive Math.sqrt per pixel
    const thresholdSq = threshold * threshold;
    const featherThresholdSq = (threshold * 1.5) * (threshold * 1.5);
    const featherRange = threshold * 0.5;

    for (let i = 0; i < data.length; i += 4) {
        const dr = data[i] - bgR;
        const dg = data[i + 1] - bgG;
        const db = data[i + 2] - bgB;
        const diffSq = dr * dr + dg * dg + db * db;

        if (diffSq < thresholdSq) {
            data[i + 3] = 0; // Fully transparent
        } else if (diffSq < featherThresholdSq) {
            // Feather edges for smoother result (need real distance only in feather zone)
            const diff = Math.sqrt(diffSq);
            const alpha = ((diff - threshold) / featherRange) * 255;
            data[i + 3] = Math.min(255, alpha) | 0;
        }
    }

    ctx.putImageData(imageData, 0, 0);

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            // Release canvas memory
            canvas.width = 0;
            canvas.height = 0;

            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Failed to create blob'));
            }
        }, 'image/png');
    });
};

// ========================================
// ML-Powered Background Removal
// Uses @huggingface/transformers (briaai/RMBG-1.4)
// Same lazy-loading pattern as Whisper in audioService.ts
// ========================================

/** Progress callback for background removal operations */
type BgRemovalProgressCallback = (progress: number, status: string) => void;

/** Cached pipeline instance — lazy-loaded, persists across calls */
let bgRemovalPipeline: any = null;
/** Which device the pipeline was created with */
let bgRemovalDevice: 'webgpu' | 'wasm' = 'wasm';

/** Detect best available device: prefer WebGPU (GPU, fast) over WASM (CPU, slow) */
const detectBestDevice = async (): Promise<'webgpu' | 'wasm'> => {
    try {
        const gpu = (navigator as any).gpu;
        if (gpu) {
            // 3s timeout: some drivers hang on requestAdapter
            const adapter = await Promise.race([
                gpu.requestAdapter(),
                new Promise<null>(resolve => setTimeout(() => resolve(null), 3000)),
            ]);
            if (adapter) return 'webgpu';
        }
    } catch { /* WebGPU not available */ }
    return 'wasm';
};

/** Race a promise against a timeout. Prevents infinite hangs. */
const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
            () => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s. Please try again.`)),
            ms
        );
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

/**
 * Classify ML pipeline errors into user-friendly messages.
 * Covers network, memory/OOM, WASM support, timeout, and generic failures.
 */
const classifyMLError = (err: unknown, phase?: string): Error => {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();

    if (lower.includes('timed out')) {
        return new Error(msg); // Already user-friendly from withTimeout
    }
    if (lower.includes('fetch') || lower.includes('network') || lower.includes('failed to load')) {
        return new Error(
            'Could not download the AI model. Please check your internet connection and try again.'
        );
    }
    if (lower.includes('memory') || lower.includes('oom') || lower.includes('alloc')) {
        return new Error(
            'Not enough memory to run the AI model. Try closing other browser tabs and try again.'
        );
    }
    if (lower.includes('wasm') || lower.includes('webassembly')) {
        return new Error(
            'Your browser does not support WebAssembly, which is required for background removal. Please use a modern browser (Chrome, Firefox, Edge, or Safari).'
        );
    }

    return new Error(
        phase === 'processing'
            ? 'AI model failed while processing the image. Please try again.'
            : 'Failed to load the AI model. Please try again.'
    );
};

/**
 * Convert a RawImage result to a Blob.
 * Handles 1-channel (grayscale), 3-channel (RGB), and 4-channel (RGBA) output.
 * Creates real HTMLCanvasElement (guaranteed toBlob support).
 * Falls back to RawImage.toCanvas() + convertToBlob (OffscreenCanvas).
 */
const rawImageToBlob = async (resultImage: any): Promise<Blob> => {
    const width: number = resultImage.width;
    const height: number = resultImage.height;
    const data = resultImage.data;
    const pixelCount = width * height;

    // Infer channel count from data length if .channels is absent
    const channels: number = resultImage.channels
        || (data && pixelCount > 0 ? Math.round(data.length / pixelCount) : 0);

    // Method 1: Build RGBA from raw pixel data → real HTMLCanvasElement
    if (width > 0 && height > 0 && data && data.length > 0) {
        let rgba: Uint8ClampedArray;

        if (channels === 4 && data.length === pixelCount * 4) {
            rgba = new Uint8ClampedArray(data);
        } else if (channels === 3 && data.length === pixelCount * 3) {
            rgba = new Uint8ClampedArray(pixelCount * 4);
            for (let i = 0; i < pixelCount; i++) {
                rgba[i * 4]     = data[i * 3];
                rgba[i * 4 + 1] = data[i * 3 + 1];
                rgba[i * 4 + 2] = data[i * 3 + 2];
                rgba[i * 4 + 3] = 255;
            }
        } else if (channels === 1 && data.length === pixelCount) {
            rgba = new Uint8ClampedArray(pixelCount * 4);
            for (let i = 0; i < pixelCount; i++) {
                rgba[i * 4]     = data[i];
                rgba[i * 4 + 1] = data[i];
                rgba[i * 4 + 2] = data[i];
                rgba[i * 4 + 3] = 255;
            }
        } else {
            throw new Error(
                `Unexpected image data: ${data.length} bytes for ${width}x${height} (${channels}ch). Please try a different image.`
            );
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not create canvas context');
        const pixelData = new Uint8ClampedArray(width * height * 4);
        pixelData.set(rgba);
        const imageData = new ImageData(pixelData, width, height);
        ctx.putImageData(imageData, 0, 0);

        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => {
                canvas.width = 0;
                canvas.height = 0;
                if (b) resolve(b);
                else reject(new Error('Failed to create output image'));
            }, 'image/png');
        });
        return blob;
    }

    // Method 2: RawImage.toCanvas() — may return OffscreenCanvas or HTMLCanvasElement
    if (typeof resultImage.toCanvas === 'function') {
        const canvas = resultImage.toCanvas();
        if (typeof canvas.convertToBlob === 'function') {
            const blob = await canvas.convertToBlob({ type: 'image/png' });
            canvas.width = 0;
            canvas.height = 0;
            return blob;
        }
        if (typeof canvas.toBlob === 'function') {
            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((b: Blob | null) => {
                    canvas.width = 0;
                    canvas.height = 0;
                    if (b) resolve(b);
                    else reject(new Error('Failed to create output image'));
                }, 'image/png');
            });
            return blob;
        }
    }

    throw new Error('AI model returned an unrecognized format. Please try again.');
};

/**
 * Remove background using AI segmentation model (briaai/RMBG-1.4).
 * Lazy-loads the model on first use (~45MB download, cached in IndexedDB).
 * Subsequent calls reuse the cached pipeline instance.
 *
 * 🔥 CRITICAL FIX: Properly applies the AI mask to original image for transparency
 * 🔥 ENHANCED: Increased timeouts (300s download, 120s inference) for slow connections
 * 🔥 ENHANCED: Better retry mechanism and error recovery
 */
export const removeBackgroundML = async (
    file: File,
    onProgress?: BgRemovalProgressCallback
): Promise<Blob> => {
    validateImageType(file);

    // Pre-validate dimensions before sending to ONNX (prevents WASM OOM)
    const img = await loadImage(file);
    validateDimensions(img.width, img.height);

    onProgress?.(5, 'Loading AI engine...');

    const { pipeline: createPipeline } = await import('@huggingface/transformers');

    if (!bgRemovalPipeline) {
        onProgress?.(8, 'Downloading AI model (first time only, ~45MB)...');

        bgRemovalDevice = await detectBestDevice();

        const progressCb = (p: any) => {
            if (p.status === 'progress' && typeof p.progress === 'number') {
                const uiPct = 8 + (p.progress * 0.37);
                onProgress?.(uiPct, `Downloading model... ${Math.round(p.progress)}%`);
            }
        };

        const makePipeline = (device: string) => createPipeline(
            'image-segmentation' as any,
            'briaai/RMBG-1.4',
            { dtype: 'q8' as any, device: device as any, progress_callback: progressCb }
        );

        try {
            bgRemovalPipeline = await withTimeout(
                makePipeline(bgRemovalDevice),
                300_000,
                'Model download'
            );
        } catch (firstErr) {
            if (bgRemovalDevice === 'webgpu') {
                bgRemovalDevice = 'wasm';
                onProgress?.(8, 'Retrying with WASM mode...');
                try {
                    bgRemovalPipeline = await withTimeout(
                        makePipeline('wasm'),
                        300_000,
                        'Model download (WASM fallback)'
                    );
                } catch (wasmErr) {
                    bgRemovalPipeline = null;
                    throw classifyMLError(wasmErr);
                }
            } else {
                bgRemovalPipeline = null;
                throw classifyMLError(firstErr);
            }
        }

        onProgress?.(50, 'AI model ready! Processing image...');
    } else {
        onProgress?.(50, 'Processing image with AI...');
    }

    const imageUrl = URL.createObjectURL(file);

    try {
        const isGpu = bgRemovalDevice === 'webgpu';
        onProgress?.(55, isGpu ? 'Processing image...' : 'Processing image... This may take 30-60 seconds');

        // Tick progress during inference so the UI doesn't appear frozen
        let inferenceProgress = 55;
        const progressTicker = setInterval(() => {
            inferenceProgress = Math.min(85, inferenceProgress + 1);
            onProgress?.(
                inferenceProgress,
                isGpu
                    ? 'Processing image...'
                    : inferenceProgress < 70
                        ? 'Processing image... This may take 30-60 seconds'
                        : inferenceProgress < 80
                        ? 'Still processing... Almost done'
                        : 'Finalizing...'
            );
        }, 1000);

        let output: any;
        try {
            // 🔥 FIX: Increased timeout from 60s to 120s (2 minutes) for complex images
            output = await withTimeout(
                bgRemovalPipeline(imageUrl),
                120_000,
                'Image processing'
            );
        } catch (err) {
            throw classifyMLError(err, 'processing');
        } finally {
            clearInterval(progressTicker);
        }

        onProgress?.(90, 'Applying mask to original image...');

        // Extract the mask from the model output
        // For image-segmentation pipeline, output format is: [{ mask: RawImage, ... }]
        let maskImage: any;

        if (output && typeof output === 'object') {
            if (Array.isArray(output)) {
                maskImage = output[0]?.mask || output[0];
            } else if (output.mask) {
                maskImage = output.mask;
            } else {
                maskImage = output;
            }
        }

        if (!maskImage || !maskImage.data) {
            throw new Error('AI model returned an unexpected format. Please try again.');
        }

        // Apply the mask to create transparency on the original image
        const blob = await applyMaskToImage(img, maskImage);

        onProgress?.(100, 'Background removed!');

        return blob;
    } finally {
        URL.revokeObjectURL(imageUrl);
    }
};

/**
 * Apply an AI-generated mask to the original image to create transparency.
 * The mask is a grayscale image where white (255) = keep, black (0) = remove.
 *
 * 🔥 CRITICAL: This is the missing piece - we need to composite the mask with the original!
 * 🔥 AUTO-DETECT: Automatically detects if mask is inverted and corrects it
 */
const applyMaskToImage = async (originalImg: HTMLImageElement, maskImage: any): Promise<Blob> => {
    const width = originalImg.width;
    const height = originalImg.height;

    // Create canvas for compositing
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context');

    // Draw original image
    ctx.drawImage(originalImg, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    // Extract mask data
    const maskData = maskImage.data;
    if (!maskData || maskData.length === 0) {
        throw new Error('Mask data is empty or invalid');
    }

    const maskChannels = maskImage.channels || 1;
    const maskWidth = maskImage.width;
    const maskHeight = maskImage.height;

    // Auto-detect if mask is inverted by sampling center region
    // In typical photos, the center contains the subject (should be white/255 in mask)
    let centerSum = 0;
    let centerCount = 0;
    const centerRegion = 0.3;
    const startX = Math.floor(maskWidth * (0.5 - centerRegion / 2));
    const endX = Math.floor(maskWidth * (0.5 + centerRegion / 2));
    const startY = Math.floor(maskHeight * (0.5 - centerRegion / 2));
    const endY = Math.floor(maskHeight * (0.5 + centerRegion / 2));

    for (let y = startY; y < endY; y += 10) {
        for (let x = startX; x < endX; x += 10) {
            const idx = (y * maskWidth + x) * maskChannels;
            centerSum += maskData[idx] || 0;
            centerCount++;
        }
    }

    const centerAvg = centerSum / centerCount;
    const isInverted = centerAvg < 127;

    // Scale factors if mask size doesn't match image size
    const scaleX = maskWidth / width;
    const scaleY = maskHeight / height;

    // Apply mask to alpha channel
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const pixelIndex = (y * width + x) * 4;
            const maskX = Math.floor(x * scaleX);
            const maskY = Math.floor(y * scaleY);
            const maskIndex = (maskY * maskWidth + maskX) * maskChannels;

            let maskValue = maskData[maskIndex];
            if (maskValue === undefined || maskValue === null) {
                maskValue = 0;
            }

            // Invert mask if detected as inverted
            if (isInverted) {
                maskValue = 255 - maskValue;
            }

            // Apply mask to alpha channel (0 = transparent, 255 = opaque)
            pixels[pixelIndex + 3] = maskValue;
        }
    }

    ctx.putImageData(imageData, 0, 0);

    // Convert to blob
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            canvas.width = 0;
            canvas.height = 0;
            if (blob) resolve(blob);
            else reject(new Error('Failed to create output image'));
        }, 'image/png');
    });
};

/**
 * Options for background removal.
 */
export interface RemoveBackgroundOptions {
    /** 'ai' (default) uses ML model; 'quick' uses canvas-based color detection */
    mode?: 'ai' | 'quick';
    /** Sensitivity threshold for 'quick' mode (10-100, default 30) */
    threshold?: number;
    /** Progress callback for model download and processing */
    onProgress?: BgRemovalProgressCallback;
}

/** Result from background removal */
export interface RemoveBackgroundResult {
    blob: Blob;
    method: 'ai' | 'canvas';
    fallbackUsed: boolean;
}

/**
 * Remove background from an image.
 * Default: Uses AI model (briaai/RMBG-1.4) for accurate removal on ALL backgrounds.
 *
 * 🔥 STRICT MODE: NEVER falls back silently. Always shows real errors.
 * Users MUST get AI-powered removal or see exactly why it failed.
 */
export const removeBackground = async (
    file: File,
    options: RemoveBackgroundOptions = {}
): Promise<RemoveBackgroundResult> => {
    const { mode = 'ai', threshold = 30, onProgress } = options;

    // Quick mode: Manual user choice only (not automatic fallback)
    if (mode === 'quick') {
        onProgress?.(10, 'Processing with quick mode...');
        const blob = await removeBackgroundCanvas(file, threshold);
        onProgress?.(100, 'Done!');
        return { blob, method: 'canvas', fallbackUsed: false };
    }

    // AI mode: STRICT - throw real errors instead of silent fallback
    try {
        const blob = await removeBackgroundML(file, onProgress);
        return { blob, method: 'ai', fallbackUsed: false };
    } catch (error) {
        // 🔥 FIX: Don't silently fall back - throw the real error
        // This lets the UI show exactly what went wrong and offer retry options
        throw error;
    }
};

/**
 * Convert image to PNG format
 */
export const convertToPNG = async (file: File): Promise<Blob> => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        throw new Error('Please select a valid image file');
    }

    const img = await loadImage(file);

    validateDimensions(img.width, img.height);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not get canvas context');
    }

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Failed to create PNG blob'));
            }
        }, 'image/png');
    });
};

/**
 * Convert image to JPG format
 */
export const convertToJPG = async (file: File, quality: number = 0.92): Promise<Blob> => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        throw new Error('Please select a valid image file');
    }

    // Clamp quality to valid range
    const clampedQuality = Math.max(0, Math.min(1, quality));

    const img = await loadImage(file);

    validateDimensions(img.width, img.height);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not get canvas context');
    }

    canvas.width = img.width;
    canvas.height = img.height;

    // Fill white background for JPG (no transparency)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Failed to create JPG blob'));
            }
        }, 'image/jpeg', clampedQuality);
    });
};

/**
 * Convert HEIC to JPG
 * HEIC files are handled by the browser's image decoder if supported
 * Falls back to standard conversion which works in most modern browsers
 */
export const convertHEICToJPG = async (file: File, quality: number = 0.92): Promise<Blob> => {
    try {
        return await convertToJPG(file, quality);
    } catch {
        throw new Error(
            'HEIC format not supported by your browser. Please use Safari or convert the file using another method first.'
        );
    }
};

/**
 * Download a blob as a file
 */
export const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
