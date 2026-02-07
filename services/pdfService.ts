/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PDFDocument, degrees, PDFPage, rgb } from 'pdf-lib';
import type {
    ImageToPdfConfig,
    MergePdfConfig,
    SplitPdfConfig,
    CompressPdfConfig,
    RotatePdfConfig,
    PdfToImageConfig,
    PageSize,
    MarginSize,
    PageSizeDimensions,
    MarginDimensions
} from '../types';

/**
 * Merge multiple PDF files into a single PDF
 * @param files - Array of PDF File objects to merge
 * @param config - Optional configuration for page ordering and selection
 * @returns Promise<Uint8Array> - The merged PDF as a byte array
 */
export const mergePDFs = async (
    files: File[],
    config?: MergePdfConfig,
    onProgress?: (progress: number, status: string) => void,
    abortSignal?: { current: boolean }
): Promise<Uint8Array> => {
    if (files.length === 0) {
        throw new Error('No files provided for merging');
    }

    if (files.length === 1) {
        throw new Error('Please select at least 2 PDF files to merge');
    }

    onProgress?.(5, 'Preparing to merge...');

    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    // Determine processing order
    let processOrder: Array<{ file: File; pageIndices?: number[] }> = [];

    if (config?.pageOrder && config.pageOrder.length > 0) {
        // Use configured page order
        processOrder = config.pageOrder.map(order => {
            const file = files.find(f => f.name === order.fileName);
            if (!file) {
                throw new Error(`File "${order.fileName}" not found in provided files`);
            }
            return {
                file,
                pageIndices: order.pageIndices.length > 0 ? order.pageIndices : undefined
            };
        });
    } else {
        // Default: merge all files in original order, all pages
        processOrder = files.map(file => ({ file, pageIndices: undefined }));
    }

    // Process each file according to order
    const total = processOrder.length;
    for (let idx = 0; idx < total; idx++) {
        if (abortSignal?.current) throw new Error('Merge cancelled');

        const { file, pageIndices } = processOrder[idx];
        const pct = 10 + ((idx / total) * 80);
        onProgress?.(pct, `Processing file ${idx + 1} of ${total}: ${file.name}`);

        // Validate file type
        if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
            throw new Error(`File "${file.name}" is not a PDF. Please select only PDF files.`);
        }

        try {
            // Read the file as ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();

            // Load the PDF
            const pdf = await PDFDocument.load(arrayBuffer);

            // Determine which pages to copy
            const pagesToCopy = pageIndices || pdf.getPageIndices();

            // Validate page indices
            const totalPages = pdf.getPageCount();
            for (const pageIdx of pagesToCopy) {
                if (pageIdx < 0 || pageIdx >= totalPages) {
                    throw new Error(`Invalid page index ${pageIdx} in file "${file.name}". File has ${totalPages} pages.`);
                }
            }

            // Copy specified pages from this PDF to the merged PDF
            const copiedPages = await mergedPdf.copyPages(pdf, pagesToCopy);

            // Add each copied page to the merged document
            copiedPages.forEach((page) => {
                mergedPdf.addPage(page);
            });
        } catch (error) {
            if (error instanceof Error && error.message === 'Merge cancelled') throw error;
            throw new Error(`Failed to process "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    if (abortSignal?.current) throw new Error('Merge cancelled');
    onProgress?.(95, 'Saving merged PDF...');

    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save();
    onProgress?.(100, 'Merge complete!');
    return mergedPdfBytes;
};

/**
 * Split a PDF into separate pages or page ranges
 * @param file - The PDF file to split
 * @param config - Configuration for split mode and options
 * @returns Promise<Uint8Array[]> - Array of split PDF byte arrays
 */
export const splitPDF = async (
    file: File,
    config: SplitPdfConfig,
    onProgress?: (progress: number, status: string) => void,
    abortSignal?: { current: boolean }
): Promise<{ pdf: Uint8Array; name: string }[]> => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('File is not a PDF');
    }

    onProgress?.(5, 'Loading PDF...');

    // Read the file
    const arrayBuffer = await file.arrayBuffer();
    const sourcePdf = await PDFDocument.load(arrayBuffer);
    const totalPages = sourcePdf.getPageCount();

    if (totalPages === 0) {
        throw new Error('PDF has no pages');
    }

    if (abortSignal?.current) throw new Error('Split cancelled');
    onProgress?.(10, 'Parsing split configuration...');

    const baseName = file.name.replace(/\.pdf$/i, '');
    let parsedRanges: number[][] = [];

    // Parse based on split mode
    switch (config.mode) {
        case 'ranges':
            if (!config.pageRanges || config.pageRanges.length === 0) {
                throw new Error('Page ranges are required for range split mode');
            }

            for (const range of config.pageRanges) {
                const trimmed = range.trim();

                if (trimmed.includes('-')) {
                    // Range like "1-3"
                    const [start, end] = trimmed.split('-').map(num => parseInt(num.trim(), 10));

                    if (isNaN(start) || isNaN(end)) {
                        throw new Error(`Invalid page range: "${range}"`);
                    }

                    if (start < 1 || end > totalPages || start > end) {
                        throw new Error(`Invalid range "${range}". PDF has ${totalPages} pages.`);
                    }

                    const pages: number[] = [];
                    for (let i = start; i <= end; i++) {
                        pages.push(i - 1); // Convert to 0-based index
                    }
                    parsedRanges.push(pages);
                } else {
                    // Single page like "5"
                    const pageNum = parseInt(trimmed, 10);

                    if (isNaN(pageNum)) {
                        throw new Error(`Invalid page number: "${range}"`);
                    }

                    if (pageNum < 1 || pageNum > totalPages) {
                        throw new Error(`Page ${pageNum} does not exist. PDF has ${totalPages} pages.`);
                    }

                    parsedRanges.push([pageNum - 1]); // Convert to 0-based index
                }
            }
            break;

        case 'extract':
            if (!config.extractPages || config.extractPages.length === 0) {
                throw new Error('Pages to extract are required for extract mode');
            }

            for (const pageNum of config.extractPages) {
                if (pageNum < 1 || pageNum > totalPages) {
                    throw new Error(`Page ${pageNum} does not exist. PDF has ${totalPages} pages.`);
                }
                parsedRanges.push([pageNum - 1]); // Each page as separate PDF
            }
            break;

        case 'every-n-pages':
            const splitEvery = config.splitEvery || 1;
            if (splitEvery < 1) {
                throw new Error('Split interval must be at least 1');
            }

            for (let i = 0; i < totalPages; i += splitEvery) {
                const pages: number[] = [];
                for (let j = i; j < Math.min(i + splitEvery, totalPages); j++) {
                    pages.push(j);
                }
                parsedRanges.push(pages);
            }
            break;

        default:
            throw new Error(`Unknown split mode: ${config.mode}`);
    }

    // Handle output format
    if (config.outputFormat === 'merged') {
        // Merge all extracted pages into single PDF
        const mergedPdf = await PDFDocument.create();
        const allPages = parsedRanges.flat();
        const copiedPages = await mergedPdf.copyPages(sourcePdf, allPages);
        copiedPages.forEach((page) => {
            mergedPdf.addPage(page);
        });
        const pdfBytes = await mergedPdf.save();
        return [{ pdf: pdfBytes, name: `${baseName}_extracted.pdf` }];
    }

    // Create separate PDFs (default)
    const results: { pdf: Uint8Array; name: string }[] = [];

    for (let i = 0; i < parsedRanges.length; i++) {
        if (abortSignal?.current) throw new Error('Split cancelled');
        const pct = 20 + ((i / parsedRanges.length) * 70);
        onProgress?.(pct, `Creating PDF ${i + 1} of ${parsedRanges.length}...`);

        const pages = parsedRanges[i];
        const newPdf = await PDFDocument.create();

        // Copy pages
        const copiedPages = await newPdf.copyPages(sourcePdf, pages);
        copiedPages.forEach((page) => {
            newPdf.addPage(page);
        });

        const pdfBytes = await newPdf.save();

        // Generate descriptive name based on mode
        let name: string;
        if (config.mode === 'extract' && pages.length === 1) {
            name = `${baseName}_page_${pages[0] + 1}.pdf`;
        } else {
            const pagesList = pages.map(p => p + 1).join('-');
            name = `${baseName}_pages_${pagesList}.pdf`;
        }

        results.push({ pdf: pdfBytes, name });
    }

    onProgress?.(100, 'Split complete!');
    return results;
};

/**
 * Compress a PDF by removing duplicate objects and optimizing
 * @param file - The PDF file to compress
 * @param config - Configuration for compression level and options
 * @returns Promise<Uint8Array> - The compressed PDF as a byte array
 */
export const compressPDF = async (file: File, config?: CompressPdfConfig): Promise<Uint8Array> => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('File is not a PDF');
    }

    // Read the file
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);

    // Apply configuration
    const compressionLevel = config?.compressionLevel || 'medium';
    const optimizeImages = config?.optimizeImages ?? true;
    const removeMetadata = config?.removeMetadata ?? false;

    // Remove metadata if requested
    if (removeMetadata) {
        pdf.setTitle('');
        pdf.setAuthor('');
        pdf.setSubject('');
        pdf.setKeywords([]);
        pdf.setProducer('');
        pdf.setCreator('');
    }

    // Configure compression options based on level
    const compressionOptions: any = {
        addDefaultPage: false,
    };

    switch (compressionLevel) {
        case 'low':
            compressionOptions.useObjectStreams = false;
            compressionOptions.objectsPerTick = 100;
            break;

        case 'medium':
            compressionOptions.useObjectStreams = true;
            compressionOptions.objectsPerTick = 50;
            break;

        case 'high':
            compressionOptions.useObjectStreams = true;
            compressionOptions.objectsPerTick = 25;
            break;

        case 'extreme':
            compressionOptions.useObjectStreams = true;
            compressionOptions.objectsPerTick = 10;
            break;

        default:
            compressionOptions.useObjectStreams = true;
            compressionOptions.objectsPerTick = 50;
    }

    // Note: pdf-lib has limited image compression capabilities
    // For more advanced image optimization, we would need additional libraries
    // Currently we rely on pdf-lib's built-in object stream compression

    // Save with compression options
    const compressedPdfBytes = await pdf.save(compressionOptions);

    return compressedPdfBytes;
};

/**
 * Rotate PDF pages
 * @param file - The PDF file to rotate
 * @param config - Configuration for rotation angle and page selection
 * @returns Promise<Uint8Array> - The rotated PDF as a byte array
 */
export const rotatePDF = async (
    file: File,
    config: RotatePdfConfig
): Promise<Uint8Array> => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('File is not a PDF');
    }

    const rotation = config.rotation;

    if (![90, 180, 270].includes(rotation)) {
        throw new Error('Rotation must be 90, 180, or 270 degrees');
    }

    // Read the file
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);

    const pages = pdf.getPages();
    const totalPages = pages.length;

    if (totalPages === 0) {
        throw new Error('PDF has no pages');
    }

    // Determine which pages to rotate
    const pagesToRotate = config.pageSelection === 'specific' && config.pageNumbers
        ? config.pageNumbers.map(num => {
            if (num < 1 || num > totalPages) {
                throw new Error(`Page ${num} does not exist. PDF has ${totalPages} pages.`);
            }
            return num - 1; // Convert to 0-based index
          })
        : pages.map((_, index) => index); // All pages

    // Rotate the specified pages
    pagesToRotate.forEach(pageIndex => {
        const page = pages[pageIndex];
        const currentRotation = page.getRotation().angle;
        const newRotation = (currentRotation + rotation) % 360;
        page.setRotation(degrees(newRotation));
    });

    // Save the rotated PDF
    const rotatedPdfBytes = await pdf.save();
    return rotatedPdfBytes;
};

/**
 * Get PDF information
 * @param file - The PDF file to analyze
 * @returns Promise<object> - PDF metadata
 */
export const getPDFInfo = async (file: File): Promise<{
    pageCount: number;
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
}> => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('File is not a PDF');
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);

    return {
        pageCount: pdf.getPageCount(),
        title: pdf.getTitle(),
        author: pdf.getAuthor(),
        subject: pdf.getSubject(),
        creator: pdf.getCreator(),
        producer: pdf.getProducer(),
        creationDate: pdf.getCreationDate(),
        modificationDate: pdf.getModificationDate(),
    };
};

/**
 * Sanitize a filename by removing path traversal and control characters
 */
function sanitizeFilename(name: string): string {
    return name
        .replace(/[/\\]/g, '_')
        .replace(/\.\./g, '_')
        .replace(/[\x00-\x1F]/g, '')
        .replace(/^\.+/, '')
        .trim() || 'document';
}

/**
 * Download a PDF file
 * @param pdfBytes - The PDF as a byte array
 * @param filename - The filename to save as
 */
export const downloadPDF = (pdfBytes: Uint8Array, filename: string): void => {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const safe = sanitizeFilename(filename);
    const link = document.createElement('a');
    link.href = url;
    link.download = safe.endsWith('.pdf') ? safe : `${safe}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object after download starts
    setTimeout(() => URL.revokeObjectURL(url), 5000);
};

/**
 * Convert PDF pages to images
 * @param file - The PDF file to convert
 * @param config - Configuration for format, quality, DPI, and page selection
 * @returns Promise<{ image: Blob; name: string }[]> - Array of images with filenames
 */
export const pdfToJPG = async (
    file: File,
    config?: PdfToImageConfig
): Promise<{ image: Blob; name: string }[]> => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('File is not a PDF');
    }

    // Apply configuration with defaults
    const format = config?.format || 'jpg';
    const quality = config?.quality ?? 0.92;
    const dpi = config?.dpi || 150;
    const pageSelection = config?.pageSelection || 'all';
    const colorSpace = config?.colorSpace || 'rgb';

    // Calculate scale based on DPI (72 DPI = scale 1.0)
    const scale = dpi / 72;

    // Import configured pdfjs
    const { pdfjsLib } = await import('./pdfConfig');

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const totalPages = pdf.numPages;
    const baseName = file.name.replace(/\.pdf$/i, '');

    // Determine which pages to convert
    let pagesToConvert: number[] = [];

    if (pageSelection === 'all') {
        pagesToConvert = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else if (pageSelection === 'range' && config?.pageRange) {
        // Parse page range (e.g., "1-3,5,7-9")
        const ranges = config.pageRange.split(',');
        for (const range of ranges) {
            const trimmed = range.trim();
            if (trimmed.includes('-')) {
                const [start, end] = trimmed.split('-').map(n => parseInt(n.trim(), 10));
                if (!isNaN(start) && !isNaN(end)) {
                    for (let i = start; i <= Math.min(end, totalPages); i++) {
                        if (i >= 1 && !pagesToConvert.includes(i)) {
                            pagesToConvert.push(i);
                        }
                    }
                }
            } else {
                const pageNum = parseInt(trimmed, 10);
                if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages && !pagesToConvert.includes(pageNum)) {
                    pagesToConvert.push(pageNum);
                }
            }
        }
        pagesToConvert.sort((a, b) => a - b);
    } else if (pageSelection === 'current') {
        // Default to first page for 'current' mode
        pagesToConvert = [1];
    } else {
        // Fallback to all pages
        pagesToConvert = Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const results: { image: Blob; name: string }[] = [];

    // Determine MIME type and file extension
    const mimeType = format === 'jpg' ? 'image/jpeg' : format === 'png' ? 'image/png' : 'image/webp';
    const extension = format;

    for (const pageNum of pagesToConvert) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        // Create canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
            throw new Error('Failed to get canvas context');
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Render PDF page to canvas
        await page.render({
            canvasContext: context,
            viewport: viewport,
        }).promise;

        // Apply color space conversion
        if (colorSpace === 'grayscale' || colorSpace === 'blackwhite') {
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                // Convert to grayscale using luminosity method
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

                if (colorSpace === 'blackwhite') {
                    // Apply threshold for black and white
                    const bw = gray > 128 ? 255 : 0;
                    data[i] = data[i + 1] = data[i + 2] = bw;
                } else {
                    // Grayscale
                    data[i] = data[i + 1] = data[i + 2] = gray;
                }
            }

            context.putImageData(imageData, 0, 0);
        }

        // Convert canvas to blob
        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create image blob'));
                    }
                },
                mimeType,
                format === 'webp' ? quality : (format === 'jpg' ? quality : undefined)
            );
        });

        results.push({
            image: blob,
            name: `${baseName}_page_${pageNum}.${extension}`,
        });
    }

    return results;
};

/**
 * Download an image file
 * @param blob - The image blob
 * @param filename - The filename to save as
 */
export const downloadImage = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
};

/**
 * Get page size dimensions in points (1 point = 1/72 inch)
 * @param pageSize - The page size name or custom dimensions
 * @returns Page dimensions in points
 */
const getPageSizeDimensions = (pageSize: PageSize, customSize?: PageSizeDimensions): PageSizeDimensions => {
    const sizes: Record<PageSize, PageSizeDimensions> = {
        A4: { width: 595, height: 842 },
        Letter: { width: 612, height: 792 },
        Legal: { width: 612, height: 1008 },
        A3: { width: 842, height: 1191 },
        A5: { width: 420, height: 595 },
        Custom: customSize || { width: 595, height: 842 },
    };
    return sizes[pageSize] || sizes.A4;
};

/**
 * Get margin dimensions in points
 * @param marginSize - The margin size
 * @returns Margin dimensions in points
 */
const getMarginDimensions = (marginSize: MarginSize, customMargin?: MarginDimensions): MarginDimensions => {
    const margins: Record<MarginSize, MarginDimensions> = {
        none: { top: 0, right: 0, bottom: 0, left: 0 },
        small: { top: 28.35, right: 28.35, bottom: 28.35, left: 28.35 }, // 10mm
        medium: { top: 56.7, right: 56.7, bottom: 56.7, left: 56.7 }, // 20mm
        large: { top: 85.05, right: 85.05, bottom: 85.05, left: 85.05 }, // 30mm
    };
    return customMargin || margins[marginSize] || margins.small;
};

/**
 * Calculate image dimensions to fit within page bounds while maintaining aspect ratio
 * @param imageWidth - Original image width
 * @param imageHeight - Original image height
 * @param availableWidth - Available width on page
 * @param availableHeight - Available height on page
 * @param fitToPage - Whether to fit image to page bounds
 * @returns Calculated dimensions
 */
const calculateImageDimensions = (
    imageWidth: number,
    imageHeight: number,
    availableWidth: number,
    availableHeight: number,
    fitToPage: boolean
): { width: number; height: number } => {
    if (!fitToPage) {
        return { width: imageWidth, height: imageHeight };
    }

    const imageAspect = imageWidth / imageHeight;
    const pageAspect = availableWidth / availableHeight;

    let width: number;
    let height: number;

    if (imageAspect > pageAspect) {
        // Image is wider than page aspect - fit to width
        width = availableWidth;
        height = width / imageAspect;
    } else {
        // Image is taller than page aspect - fit to height
        height = availableHeight;
        width = height * imageAspect;
    }

    return { width, height };
};

/**
 * Convert JPG/PNG images to a single PDF
 * @param files - Array of image files to convert
 * @param config - Optional configuration for page settings, margins, and quality
 * @returns Promise<Uint8Array> - The PDF as a byte array
 */
export const imagesToPDF = async (
    files: File[],
    config?: ImageToPdfConfig
): Promise<Uint8Array> => {
    if (files.length === 0) {
        throw new Error('No files provided');
    }

    // Validate all files are images
    for (const file of files) {
        if (!file.type.startsWith('image/')) {
            throw new Error(`File "${file.name}" is not an image. Please select only image files.`);
        }
    }

    // Get configuration with defaults
    const pageSize = config?.pageSize || 'A4';
    const orientation = config?.orientation || 'portrait';
    const marginSize = config?.margin || 'small';
    const quality = config?.quality || 'high';
    const fitToPage = config?.fitToPage ?? true;

    // Calculate page dimensions
    const pageDims = getPageSizeDimensions(pageSize, config?.customPageSize);
    const margins = getMarginDimensions(marginSize, config?.customMargin);

    // Apply orientation
    const pageWidth = orientation === 'landscape' ? pageDims.height : pageDims.width;
    const pageHeight = orientation === 'landscape' ? pageDims.width : pageDims.height;

    // Calculate available space for image
    const availableWidth = pageWidth - margins.left - margins.right;
    const availableHeight = pageHeight - margins.top - margins.bottom;

    // Determine quality factor
    const qualityMap = {
        original: 1.0,
        high: 0.92,
        medium: 0.85,
        low: 0.7,
    };
    const jpegQuality = qualityMap[quality];

    const pdfDoc = await PDFDocument.create();

    // Reorder files if config specifies order
    let orderedFiles = [...files];
    if (config?.imageOrder && config.imageOrder.length > 0) {
        orderedFiles = config.imageOrder
            .map(id => files.find(f => f.name === id))
            .filter(f => f !== undefined) as File[];
    }

    for (const file of orderedFiles) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            let image;

            if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
                image = await pdfDoc.embedJpg(arrayBuffer);
            } else if (file.type === 'image/png') {
                image = await pdfDoc.embedPng(arrayBuffer);
            } else {
                // For other image types, convert to canvas first
                const img = await createImageBitmap(new Blob([arrayBuffer], { type: file.type }));
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    throw new Error('Failed to get canvas context');
                }

                ctx.drawImage(img, 0, 0);

                // Convert to JPEG with configured quality
                const jpegBlob = await new Promise<Blob>((resolve, reject) => {
                    canvas.toBlob(
                        (blob) => {
                            if (blob) resolve(blob);
                            else reject(new Error('Failed to convert image'));
                        },
                        'image/jpeg',
                        jpegQuality
                    );
                });

                const jpegBuffer = await jpegBlob.arrayBuffer();
                image = await pdfDoc.embedJpg(jpegBuffer);
            }

            // Create a page with configured dimensions
            const page = pdfDoc.addPage([pageWidth, pageHeight]);

            // Calculate image dimensions to fit within margins
            const imageDims = calculateImageDimensions(
                image.width,
                image.height,
                availableWidth,
                availableHeight,
                fitToPage
            );

            // Center image on page
            const x = margins.left + (availableWidth - imageDims.width) / 2;
            const y = margins.bottom + (availableHeight - imageDims.height) / 2;

            // Draw the image
            page.drawImage(image, {
                x,
                y,
                width: imageDims.width,
                height: imageDims.height,
            });
        } catch (error) {
            throw new Error(`Failed to process "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
};

/**
 * Encrypt a PDF with a password
 * @param file - The PDF file to encrypt
 * @param userPassword - Password for opening the PDF
 * @param ownerPassword - Optional password for modifying PDF permissions (defaults to userPassword)
 * @returns Promise<Uint8Array> - The encrypted PDF as a byte array
 */
export interface EncryptPermissions {
    printing?: boolean;
    copying?: boolean;
    modifying?: boolean;
}

export const encryptPDF = async (
    file: File,
    userPassword: string,
    ownerPassword?: string,
    permissions?: EncryptPermissions
): Promise<Uint8Array> => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('File is not a PDF');
    }

    if (!userPassword || userPassword.trim() === '') {
        throw new Error('Password is required');
    }

    // Read the file
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);

    // Save with encryption
    const encryptedPdfBytes = await pdf.save({
        userPassword: userPassword,
        ownerPassword: ownerPassword || userPassword,
        permissions: {
            printing: permissions?.printing !== false ? 'highResolution' : 'none' as any,
            modifying: permissions?.modifying ?? false,
            copying: permissions?.copying ?? false,
            annotating: permissions?.modifying ?? false,
            fillingForms: permissions?.modifying ?? false,
            contentAccessibility: true,
            documentAssembly: false,
        },
    });

    return encryptedPdfBytes;
};

/**
 * Unlock (decrypt) a password-protected PDF
 * @param file - The encrypted PDF file
 * @param password - Password to unlock the PDF
 * @returns Promise<Uint8Array> - The unlocked PDF as a byte array
 */
export const unlockPDF = async (
    file: File,
    password: string
): Promise<Uint8Array> => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('File is not a PDF');
    }

    if (!password || password.trim() === '') {
        throw new Error('Password is required');
    }

    try {
        // Read the file
        const arrayBuffer = await file.arrayBuffer();

        // Try to load with password
        const pdf = await PDFDocument.load(arrayBuffer, {
            password: password,
            ignoreEncryption: false,
        });

        // Save without encryption
        const unlockedPdfBytes = await pdf.save();
        return unlockedPdfBytes;
    } catch (error) {
        if (error instanceof Error && error.message.includes('password')) {
            throw new Error('Incorrect password. Please try again.');
        }
        throw new Error(`Failed to unlock PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Check if a PDF is encrypted
 * @param file - The PDF file to check
 * @returns Promise<boolean> - True if encrypted, false otherwise
 */
export const isPDFEncrypted = async (file: File): Promise<boolean> => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('File is not a PDF');
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        await PDFDocument.load(arrayBuffer);
        return false; // Successfully loaded without password
    } catch (error) {
        if (error instanceof Error && (
            error.message.includes('encrypted') ||
            error.message.includes('password')
        )) {
            return true; // PDF is encrypted
        }
        throw error; // Some other error occurred
    }
};
