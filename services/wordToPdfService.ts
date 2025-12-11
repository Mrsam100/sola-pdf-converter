/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import mammoth from 'mammoth';

/**
 * Extract HTML and text from Word document
 */
export const parseWordDocument = async (
    file: File,
    onProgress?: (progress: number, status: string) => void
): Promise<{ html: string; text: string }> => {
    onProgress?.(10, 'Reading Word document...');

    const arrayBuffer = await file.arrayBuffer();

    onProgress?.(30, 'Parsing document content...');

    // Use mammoth to convert .docx to HTML
    const result = await mammoth.convertToHtml({ arrayBuffer });

    onProgress?.(60, 'Extracting text...');

    // Also get plain text
    const textResult = await mammoth.extractRawText({ arrayBuffer });

    return {
        html: result.value,
        text: textResult.value
    };
};

/**
 * Convert HTML/text to PDF
 */
export const textToPDF = async (
    text: string,
    filename: string,
    onProgress?: (progress: number, status: string) => void
): Promise<Uint8Array> => {
    onProgress?.(70, 'Creating PDF document...');

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Page dimensions
    const pageWidth = 595.28; // A4 width in points (210mm)
    const pageHeight = 841.89; // A4 height in points (297mm)
    const margin = 50;
    const maxWidth = pageWidth - 2 * margin;
    const lineHeight = 14;
    const fontSize = 11;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;

    // Split text into paragraphs
    const paragraphs = text.split(/\n\n+/);

    onProgress?.(80, 'Formatting text...');

    for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i].trim();
        if (paragraph.length === 0) continue;

        // Check if this is a heading (heuristic: shorter lines at start of paragraphs, or ALL CAPS)
        const isHeading = paragraph.length < 60 && (
            paragraph === paragraph.toUpperCase() ||
            i === 0 ||
            paragraphs[i - 1]?.trim().length === 0
        );

        const currentFont = isHeading ? boldFont : font;
        const currentSize = isHeading ? fontSize + 2 : fontSize;

        // Word wrap
        const words = paragraph.split(' ');
        let line = '';

        for (const word of words) {
            const testLine = line + (line ? ' ' : '') + word;
            const lineWidth = currentFont.widthOfTextAtSize(testLine, currentSize);

            if (lineWidth > maxWidth && line) {
                // Check if we need a new page
                if (yPosition < margin + lineHeight) {
                    page = pdfDoc.addPage([pageWidth, pageHeight]);
                    yPosition = pageHeight - margin;
                }

                // Draw the line
                page.drawText(line, {
                    x: margin,
                    y: yPosition,
                    size: currentSize,
                    font: currentFont,
                    color: rgb(0, 0, 0),
                });

                yPosition -= lineHeight;
                line = word;
            } else {
                line = testLine;
            }
        }

        // Draw remaining line
        if (line) {
            if (yPosition < margin + lineHeight) {
                page = pdfDoc.addPage([pageWidth, pageHeight]);
                yPosition = pageHeight - margin;
            }

            page.drawText(line, {
                x: margin,
                y: yPosition,
                size: currentSize,
                font: currentFont,
                color: rgb(0, 0, 0),
            });

            yPosition -= lineHeight;
        }

        // Add extra space after paragraph
        yPosition -= lineHeight / 2;
    }

    onProgress?.(95, 'Finalizing PDF...');

    const pdfBytes = await pdfDoc.save();
    onProgress?.(100, 'Conversion complete!');

    return pdfBytes;
};

/**
 * Full Word to PDF conversion
 */
export const wordToPDF = async (
    file: File,
    onProgress?: (progress: number, status: string) => void
): Promise<Uint8Array> => {
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.docx') &&
        !file.type.includes('wordprocessingml')) {
        throw new Error('Please select a Word document (.docx file)');
    }

    onProgress?.(0, 'Starting conversion...');

    // Parse Word document
    const { text } = await parseWordDocument(file, (prog, status) => {
        // Scale parsing progress to 0-60%
        onProgress?.(prog * 0.6, status);
    });

    // Convert text to PDF
    const pdfBytes = await textToPDF(text, file.name, (prog, status) => {
        // Scale PDF creation progress to 60-100%
        onProgress?.(60 + (prog - 70) * 0.4, status);
    });

    return pdfBytes;
};

/**
 * Download PDF file
 */
export const downloadPDF = (pdfBytes: Uint8Array, filename: string): void => {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    const pdfFilename = filename.replace(/\.docx?$/i, '.pdf');
    link.download = pdfFilename.endsWith('.pdf') ? pdfFilename : `${pdfFilename}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 100);
};
