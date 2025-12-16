/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx';
import { createConfiguredWorker } from './tesseractConfig';

/**
 * Extract text from PDF using pdf.js (Non-OCR mode)
 * This extracts selectable text from PDFs
 */
export const extractTextFromPDF = async (file: File): Promise<{ text: string; pageCount: number }> => {
    const { pdfjsLib } = await import('./pdfConfig');

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Extract text items
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');

        fullText += `\n\n--- Page ${pageNum} ---\n\n${pageText}`;
    }

    return {
        text: fullText.trim(),
        pageCount: pdf.numPages
    };
};

/**
 * Extract text from PDF using OCR (for scanned PDFs or images)
 * This performs optical character recognition on PDF pages
 */
export const extractTextWithOCR = async (
    file: File,
    onProgress?: (progress: number, status: string) => void
): Promise<{ text: string; pageCount: number }> => {
    let worker: any = null;

    try {
        // Load PDF first to render pages
        const { pdfjsLib } = await import('./pdfConfig');

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        // Initialize Tesseract worker
        onProgress?.(5, 'Initializing OCR engine...');

        try {
            worker = await createConfiguredWorker('eng');
        } catch (workerError) {
            console.error('Failed to initialize OCR worker:', workerError);
            throw new Error('Failed to initialize OCR engine. Please check your internet connection and try again.');
        }

        let fullText = '';

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const progressPercent = 5 + (pageNum / pdf.numPages) * 90;
            onProgress?.(progressPercent, `Processing page ${pageNum} of ${pdf.numPages}...`);

            const page = await pdf.getPage(pageNum);

            // Render page to canvas
            const scale = 2.0; // Higher scale for better OCR accuracy
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            if (!context) {
                throw new Error('Failed to get canvas context for rendering PDF page');
            }

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            try {
                await page.render({
                    canvasContext: context,
                    viewport: viewport,
                }).promise;
            } catch (renderError) {
                console.error(`Failed to render page ${pageNum}:`, renderError);
                throw new Error(`Failed to render PDF page ${pageNum}. The PDF may be corrupted.`);
            }

            // Perform OCR on the canvas
            try {
                const { data: { text } } = await worker.recognize(canvas);
                fullText += `\n\n--- Page ${pageNum} ---\n\n${text.trim()}`;
            } catch (ocrError) {
                console.error(`OCR failed on page ${pageNum}:`, ocrError);
                throw new Error(`OCR failed on page ${pageNum}. Please try with a different PDF or check your connection.`);
            }

            // Clean up canvas to free memory
            canvas.width = 0;
            canvas.height = 0;
            page.cleanup();
        }

        // Terminate worker
        if (worker) {
            await worker.terminate();
        }
        onProgress?.(100, 'OCR complete!');

        return {
            text: fullText.trim(),
            pageCount: pdf.numPages
        };
    } catch (error) {
        // Ensure worker is terminated even on error
        if (worker) {
            try {
                await worker.terminate();
            } catch (terminateError) {
                console.error('Failed to terminate OCR worker:', terminateError);
            }
        }
        throw error;
    }
};

/**
 * Convert extracted text to Word document (.docx)
 */
export const textToWord = async (
    text: string,
    filename: string = 'converted-document.docx'
): Promise<Blob> => {
    // Split text into pages
    const pages = text.split(/\n\n--- Page \d+ ---\n\n/);

    // Remove first empty element if present
    if (pages[0].trim() === '') {
        pages.shift();
    }

    const paragraphs: Paragraph[] = [];

    // Add title
    paragraphs.push(
        new Paragraph({
            text: filename.replace('.pdf', ''),
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 },
        })
    );

    // Process each page
    pages.forEach((pageText, index) => {
        // Add page heading
        paragraphs.push(
            new Paragraph({
                text: `Page ${index + 1}`,
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 100 },
            })
        );

        // Split page text into paragraphs
        const pageParagraphs = pageText
            .split('\n\n')
            .map(p => p.trim())
            .filter(p => p.length > 0);

        // Add paragraphs
        pageParagraphs.forEach(paraText => {
            // Handle potential line breaks within paragraphs
            const lines = paraText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

            if (lines.length > 0) {
                paragraphs.push(
                    new Paragraph({
                        children: lines.map((line, lineIndex) =>
                            new TextRun({
                                text: line + (lineIndex < lines.length - 1 ? ' ' : ''),
                            })
                        ),
                        spacing: { after: 100 },
                    })
                );
            }
        });
    });

    // Create document
    const doc = new Document({
        sections: [
            {
                properties: {},
                children: paragraphs,
            },
        ],
    });

    // Generate blob
    const blob = await Packer.toBlob(doc);
    return blob;
};

/**
 * Full PDF to Word conversion (Non-OCR)
 */
export const pdfToWord = async (
    file: File,
    onProgress?: (progress: number, status: string) => void
): Promise<Blob> => {
    onProgress?.(10, 'Extracting text from PDF...');
    const { text } = await extractTextFromPDF(file);

    onProgress?.(70, 'Creating Word document...');
    const wordBlob = await textToWord(text, file.name);

    onProgress?.(100, 'Conversion complete!');
    return wordBlob;
};

/**
 * Full PDF to Word conversion with OCR
 */
export const pdfToWordWithOCR = async (
    file: File,
    onProgress?: (progress: number, status: string) => void
): Promise<Blob> => {
    const { text } = await extractTextWithOCR(file, (progress, status) => {
        // Scale OCR progress to 0-90%
        onProgress?.(progress * 0.9, status);
    });

    onProgress?.(90, 'Creating Word document...');
    const wordBlob = await textToWord(text, file.name);

    onProgress?.(100, 'Conversion complete!');
    return wordBlob;
};

/**
 * Download Word document
 */
export const downloadWord = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
};
