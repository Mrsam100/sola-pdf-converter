/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PDFDocument, degrees } from 'pdf-lib';

/**
 * Merge multiple PDF files into a single PDF
 * @param files - Array of PDF File objects to merge
 * @returns Promise<Uint8Array> - The merged PDF as a byte array
 */
export const mergePDFs = async (files: File[]): Promise<Uint8Array> => {
    if (files.length === 0) {
        throw new Error('No files provided for merging');
    }

    if (files.length === 1) {
        throw new Error('Please select at least 2 PDF files to merge');
    }

    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    // Process each file
    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file type
        if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
            throw new Error(`File "${file.name}" is not a PDF. Please select only PDF files.`);
        }

        try {
            // Read the file as ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();

            // Load the PDF
            const pdf = await PDFDocument.load(arrayBuffer);

            // Copy all pages from this PDF to the merged PDF
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

            // Add each copied page to the merged document
            copiedPages.forEach((page) => {
                mergedPdf.addPage(page);
            });
        } catch (error) {
            throw new Error(`Failed to process "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save();
    return mergedPdfBytes;
};

/**
 * Split a PDF into separate pages or page ranges
 * @param file - The PDF file to split
 * @param pageRanges - Array of page ranges (e.g., ["1-3", "5", "7-9"])
 * @returns Promise<Uint8Array[]> - Array of split PDF byte arrays
 */
export const splitPDF = async (
    file: File,
    pageRanges: string[]
): Promise<{ pdf: Uint8Array; name: string }[]> => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('File is not a PDF');
    }

    // Read the file
    const arrayBuffer = await file.arrayBuffer();
    const sourcePdf = await PDFDocument.load(arrayBuffer);
    const totalPages = sourcePdf.getPageCount();

    if (totalPages === 0) {
        throw new Error('PDF has no pages');
    }

    // Parse page ranges
    const parsedRanges: number[][] = [];

    for (const range of pageRanges) {
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

    // Create split PDFs
    const results: { pdf: Uint8Array; name: string }[] = [];
    const baseName = file.name.replace('.pdf', '');

    for (let i = 0; i < parsedRanges.length; i++) {
        const pages = parsedRanges[i];
        const newPdf = await PDFDocument.create();

        // Copy pages
        const copiedPages = await newPdf.copyPages(sourcePdf, pages);
        copiedPages.forEach((page) => {
            newPdf.addPage(page);
        });

        const pdfBytes = await newPdf.save();

        // Generate descriptive name
        const pagesList = pages.map(p => p + 1).join('-');
        const name = `${baseName}_pages_${pagesList}.pdf`;

        results.push({ pdf: pdfBytes, name });
    }

    return results;
};

/**
 * Compress a PDF by removing duplicate objects and optimizing
 * @param file - The PDF file to compress
 * @returns Promise<Uint8Array> - The compressed PDF as a byte array
 */
export const compressPDF = async (file: File): Promise<Uint8Array> => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('File is not a PDF');
    }

    // Read the file
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);

    // Save with compression options
    // pdf-lib automatically deduplicates objects and compresses streams
    const compressedPdfBytes = await pdf.save({
        useObjectStreams: true, // Compress objects into streams
        addDefaultPage: false,   // Don't add extra pages
        objectsPerTick: 50,      // Process in batches for better performance
    });

    return compressedPdfBytes;
};

/**
 * Rotate PDF pages
 * @param file - The PDF file to rotate
 * @param rotation - Rotation angle (90, 180, or 270 degrees)
 * @param pageNumbers - Optional array of page numbers to rotate (1-based). If not provided, rotates all pages.
 * @returns Promise<Uint8Array> - The rotated PDF as a byte array
 */
export const rotatePDF = async (
    file: File,
    rotation: 90 | 180 | 270,
    pageNumbers?: number[]
): Promise<Uint8Array> => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('File is not a PDF');
    }

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
    const pagesToRotate = pageNumbers
        ? pageNumbers.map(num => {
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
 * Download a PDF file
 * @param pdfBytes - The PDF as a byte array
 * @param filename - The filename to save as
 */
export const downloadPDF = (pdfBytes: Uint8Array, filename: string): void => {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(url), 100);
};

/**
 * Convert PDF pages to JPG images
 * @param file - The PDF file to convert
 * @param quality - JPG quality (0-1, default 0.92)
 * @returns Promise<{ image: Blob; name: string }[]> - Array of JPG images with filenames
 */
export const pdfToJPG = async (
    file: File,
    quality: number = 0.92
): Promise<{ image: Blob; name: string }[]> => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('File is not a PDF');
    }

    // Import configured pdfjs
    const { pdfjsLib } = await import('./pdfConfig');

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const results: { image: Blob; name: string }[] = [];
    const baseName = file.name.replace('.pdf', '');

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);

        // Set scale for better quality (2x for high resolution)
        const scale = 2.0;
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
                'image/jpeg',
                quality
            );
        });

        results.push({
            image: blob,
            name: `${baseName}_page_${pageNum}.jpg`,
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
    setTimeout(() => URL.revokeObjectURL(url), 100);
};

/**
 * Convert JPG/PNG images to a single PDF
 * @param files - Array of image files to convert
 * @returns Promise<Uint8Array> - The PDF as a byte array
 */
export const imagesToPDF = async (files: File[]): Promise<Uint8Array> => {
    if (files.length === 0) {
        throw new Error('No files provided');
    }

    // Validate all files are images
    for (const file of files) {
        if (!file.type.startsWith('image/')) {
            throw new Error(`File "${file.name}" is not an image. Please select only image files.`);
        }
    }

    const pdfDoc = await PDFDocument.create();

    for (const file of files) {
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

                // Convert to JPEG
                const jpegBlob = await new Promise<Blob>((resolve, reject) => {
                    canvas.toBlob(
                        (blob) => {
                            if (blob) resolve(blob);
                            else reject(new Error('Failed to convert image'));
                        },
                        'image/jpeg',
                        0.92
                    );
                });

                const jpegBuffer = await jpegBlob.arrayBuffer();
                image = await pdfDoc.embedJpg(jpegBuffer);
            }

            // Create a page with the image dimensions
            const page = pdfDoc.addPage([image.width, image.height]);

            // Draw the image on the page (fill entire page)
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
            });
        } catch (error) {
            throw new Error(`Failed to process "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
};
