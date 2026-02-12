/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Document, Paragraph, TextRun, HeadingLevel, Packer, SectionType } from 'docx';
import { createConfiguredWorker } from './tesseractConfig';

// ── Constants ─────────────────────────────────────

/** Maximum pages for OCR — prevents multi-hour freezes on large docs */
const MAX_OCR_PAGES = 200;

// ── Unicode Detection & Warnings ──────────────────

/**
 * 🔒 SECURITY FIX: Detect Unicode characters that may be lost during conversion
 *
 * Detects CJK (Chinese, Japanese, Korean), Arabic, Hebrew, Cyrillic, and other
 * complex scripts that may not convert properly to Word format.
 */
const detectUnicodeCharacters = (text: string): {
    hasCJK: boolean;
    hasArabic: boolean;
    hasHebrew: boolean;
    hasCyrillic: boolean;
    hasComplexUnicode: boolean;
    stats: { cjk: number; arabic: number; hebrew: number; cyrillic: number; other: number };
} => {
    let cjkCount = 0;
    let arabicCount = 0;
    let hebrewCount = 0;
    let cyrillicCount = 0;
    let otherComplexCount = 0;

    for (const char of text) {
        const code = char.charCodeAt(0);

        // CJK Unified Ideographs
        if ((code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
            (code >= 0x3400 && code <= 0x4DBF) || // CJK Extension A
            (code >= 0x20000 && code <= 0x2A6DF) || // CJK Extension B
            (code >= 0x3040 && code <= 0x309F) || // Hiragana
            (code >= 0x30A0 && code <= 0x30FF) || // Katakana
            (code >= 0xAC00 && code <= 0xD7AF)) { // Hangul
            cjkCount++;
        }
        // Arabic
        else if (code >= 0x0600 && code <= 0x06FF) {
            arabicCount++;
        }
        // Hebrew
        else if (code >= 0x0590 && code <= 0x05FF) {
            hebrewCount++;
        }
        // Cyrillic
        else if (code >= 0x0400 && code <= 0x04FF) {
            cyrillicCount++;
        }
        // Other complex Unicode (Thai, Devanagari, etc.)
        else if (code > 0x0250) {
            otherComplexCount++;
        }
    }

    return {
        hasCJK: cjkCount > 0,
        hasArabic: arabicCount > 0,
        hasHebrew: hebrewCount > 0,
        hasCyrillic: cyrillicCount > 0,
        hasComplexUnicode: (cjkCount + arabicCount + hebrewCount + cyrillicCount + otherComplexCount) > 0,
        stats: { cjk: cjkCount, arabic: arabicCount, hebrew: hebrewCount, cyrillic: cyrillicCount, other: otherComplexCount }
    };
};

/**
 * Generate user-friendly warning message for Unicode data loss
 */
export const getUnicodeWarning = (text: string): string | null => {
    const detection = detectUnicodeCharacters(text);

    if (!detection.hasComplexUnicode) {
        return null;
    }

    const warnings: string[] = [];
    if (detection.hasCJK) {
        warnings.push(`⚠️ Chinese/Japanese/Korean characters detected (${detection.stats.cjk})`);
    }
    if (detection.hasArabic) {
        warnings.push(`⚠️ Arabic characters detected (${detection.stats.arabic})`);
    }
    if (detection.hasHebrew) {
        warnings.push(`⚠️ Hebrew characters detected (${detection.stats.hebrew})`);
    }
    if (detection.hasCyrillic) {
        warnings.push(`⚠️ Cyrillic characters detected (${detection.stats.cyrillic})`);
    }
    if (detection.stats.other > 0) {
        warnings.push(`⚠️ Other complex Unicode detected (${detection.stats.other})`);
    }

    return `
⚠️ **DATA LOSS WARNING**: This document contains non-Latin characters that may not convert properly to Word format.

${warnings.join('\n')}

**Recommendation**:
- Use "Save as PDF" instead if preserving original formatting is critical
- Review the converted document carefully for missing or corrupted characters
- Consider using a specialized conversion tool for documents with complex scripts
`.trim();
};

// ── Types ─────────────────────────────────────────

interface PageData {
    pageNumber: number;
    paragraphs: string[]; // each paragraph is a block of text
}

export interface AbortSignal {
    current: boolean;
}

// ── Text Extraction (Non-OCR) ─────────────────────

export const extractTextFromPDF = async (
    file: File,
    abortSignal?: AbortSignal
): Promise<{ pages: PageData[]; pageCount: number }> => {
    const { pdfjsLib } = await import('./pdfConfig');

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    try {
        const pages: PageData[] = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            if (abortSignal?.current) {
                throw new Error('Conversion cancelled');
            }

            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            const items = textContent.items as any[];
            const lines: string[] = [];
            let currentLine = '';
            let lastY: number | null = null;
            let lastFontSize = 12; // default fallback

            for (const item of items) {
                if (!item.str && !item.hasEOL) continue;

                const currentY = item.transform ? item.transform[5] : null;
                const fontSize = item.transform ? Math.abs(item.transform[3]) : lastFontSize;
                if (fontSize > 0) lastFontSize = fontSize;

                if (lastY !== null && currentY !== null && item.str) {
                    const yDiff = Math.abs(lastY - currentY);
                    // Use font-size-relative threshold instead of hardcoded 2
                    if (yDiff > lastFontSize * 0.5) {
                        // New line detected — push current line
                        if (currentLine.trim()) lines.push(currentLine.trim());
                        currentLine = '';
                    } else if (currentLine.length > 0 && !currentLine.endsWith(' ')) {
                        currentLine += ' ';
                    }
                } else if (currentLine.length > 0 && item.str && !currentLine.endsWith(' ')) {
                    currentLine += ' ';
                }

                currentLine += item.str || '';
                if (currentY !== null && item.str?.trim()) lastY = currentY;

                if (item.hasEOL) {
                    if (currentLine.trim()) lines.push(currentLine.trim());
                    currentLine = '';
                    lastY = null;
                }
            }

            // Push remaining text
            if (currentLine.trim()) lines.push(currentLine.trim());

            // Group lines into paragraphs (consecutive lines become one paragraph,
            // blank lines separate paragraphs)
            const paragraphs: string[] = [];
            let currentParagraph = '';

            for (const line of lines) {
                if (line.trim() === '') {
                    if (currentParagraph.trim()) {
                        paragraphs.push(currentParagraph.trim());
                        currentParagraph = '';
                    }
                } else {
                    if (currentParagraph) currentParagraph += ' ';
                    currentParagraph += line;
                }
            }
            if (currentParagraph.trim()) {
                paragraphs.push(currentParagraph.trim());
            }

            pages.push({ pageNumber: pageNum, paragraphs });
        }

        return { pages, pageCount: pdf.numPages };
    } finally {
        pdf.destroy();
    }
};

// ── OCR Extraction ────────────────────────────────

export const extractTextWithOCR = async (
    file: File,
    onProgress?: (progress: number, status: string) => void,
    abortSignal?: AbortSignal
): Promise<{ pages: PageData[]; pageCount: number }> => {
    let worker: any = null;
    const { pdfjsLib } = await import('./pdfConfig');

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    try {
        // Enforce page limit for OCR
        if (pdf.numPages > MAX_OCR_PAGES) {
            throw new Error(
                `This PDF has ${pdf.numPages} pages. OCR is limited to ${MAX_OCR_PAGES} pages ` +
                `to prevent browser freezes. For large documents, try the non-OCR mode first.`
            );
        }

        onProgress?.(5, 'Initializing OCR engine...');

        try {
            worker = await createConfiguredWorker('eng');
        } catch {
            throw new Error(
                'Failed to initialize OCR engine. Please check your internet connection and try again.'
            );
        }

        const pages: PageData[] = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            // Check abort before each page
            if (abortSignal?.current) {
                throw new Error('Conversion cancelled');
            }

            const progressPercent = 5 + (pageNum / pdf.numPages) * 90;
            onProgress?.(progressPercent, `Processing page ${pageNum} of ${pdf.numPages}...`);

            const page = await pdf.getPage(pageNum);

            // Render page to canvas at 2x scale for better OCR accuracy
            const scale = 2.0;
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            if (!context) {
                throw new Error('Failed to get canvas context for rendering PDF page');
            }

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            try {
                await page.render({ canvasContext: context, viewport }).promise;
            } catch {
                throw new Error(
                    `Failed to render PDF page ${pageNum}. The PDF may be corrupted.`
                );
            }

            // Perform OCR
            try {
                const { data: { text } } = await worker.recognize(canvas);

                // Split OCR text into paragraphs (double newlines)
                const paragraphs = text
                    .split(/\n\s*\n/)
                    .map((p: string) => p.trim())
                    .filter((p: string) => p.length > 0);

                pages.push({ pageNumber: pageNum, paragraphs });
            } catch {
                throw new Error(
                    `OCR failed on page ${pageNum}. Please try with a different PDF or check your connection.`
                );
            }

            // Clean up canvas to free memory
            canvas.width = 0;
            canvas.height = 0;
            page.cleanup();
        }

        // Terminate worker
        if (worker) {
            await worker.terminate();
            worker = null;
        }

        onProgress?.(100, 'OCR complete!');
        return { pages, pageCount: pdf.numPages };
    } catch (error) {
        // Ensure worker is terminated on error
        if (worker) {
            try { await worker.terminate(); } catch { /* ignore */ }
        }
        throw error;
    } finally {
        pdf.destroy();
    }
};

// ── Word Document Generation ──────────────────────

export const pagesToWord = async (
    pages: PageData[],
    filename: string = 'converted-document.docx'
): Promise<Blob> => {
    const docTitle = filename.replace(/\.pdf$/i, '');

    // Build sections — one section per page with page breaks
    const sections = pages.map((pageData, index) => {
        const children: Paragraph[] = [];

        // First page gets the document title
        if (index === 0) {
            children.push(
                new Paragraph({
                    text: docTitle,
                    heading: HeadingLevel.HEADING_1,
                    spacing: { after: 200 },
                })
            );
        }

        // Add paragraphs from this page
        if (pageData.paragraphs.length === 0) {
            // Empty page — add a blank paragraph
            children.push(new Paragraph({ text: '' }));
        } else {
            for (const paraText of pageData.paragraphs) {
                // Preserve line breaks within paragraphs
                const lines = paraText.split('\n').filter(l => l.length > 0);

                children.push(
                    new Paragraph({
                        children: lines.map((line, lineIndex) =>
                            new TextRun({
                                text: line,
                                break: lineIndex > 0 ? 1 : undefined,
                            })
                        ),
                        spacing: { after: 120 },
                    })
                );
            }
        }

        return {
            properties: index > 0
                ? { type: SectionType.NEXT_PAGE as const }
                : {},
            children,
        };
    });

    // Fallback: if no pages, create a minimal document
    if (sections.length === 0) {
        sections.push({
            properties: {},
            children: [new Paragraph({ text: 'No content could be extracted from this PDF.' })],
        });
    }

    const doc = new Document({ sections });
    return Packer.toBlob(doc);
};

// ── Legacy textToWord (backward-compatible) ───────

export const textToWord = async (
    text: string,
    filename: string = 'converted-document.docx'
): Promise<Blob> => {
    // Parse the legacy "--- Page N ---" format into PageData
    const rawPages = text.split(/\n*--- Page \d+ ---\n\n/);
    if (rawPages[0].trim() === '') rawPages.shift();

    const pages: PageData[] = rawPages.map((pageText, i) => ({
        pageNumber: i + 1,
        paragraphs: pageText
            .split('\n\n')
            .map(p => p.trim())
            .filter(p => p.length > 0),
    }));

    return pagesToWord(pages, filename);
};

// ── Main Conversion Pipelines ─────────────────────

export const pdfToWord = async (
    file: File,
    onProgress?: (progress: number, status: string) => void,
    abortSignal?: AbortSignal
): Promise<Blob> => {
    onProgress?.(10, 'Extracting text from PDF...');
    const { pages } = await extractTextFromPDF(file, abortSignal);

    if (abortSignal?.current) throw new Error('Conversion cancelled');

    onProgress?.(70, 'Creating Word document...');
    const wordBlob = await pagesToWord(pages, file.name);

    onProgress?.(100, 'Conversion complete!');
    return wordBlob;
};

export const pdfToWordWithOCR = async (
    file: File,
    onProgress?: (progress: number, status: string) => void,
    abortSignal?: AbortSignal
): Promise<Blob> => {
    const { pages } = await extractTextWithOCR(
        file,
        (progress, status) => {
            onProgress?.(progress * 0.9, status);
        },
        abortSignal
    );

    if (abortSignal?.current) throw new Error('Conversion cancelled');

    onProgress?.(90, 'Creating Word document...');
    const wordBlob = await pagesToWord(pages, file.name);

    onProgress?.(100, 'Conversion complete!');
    return wordBlob;
};

// ── Download ──────────────────────────────────────

/** Sanitize filename — strip path traversal and control characters */
function sanitizeFilename(name: string): string {
    return name
        .replace(/[/\\]/g, '_')      // path separators
        .replace(/\.\./g, '_')       // path traversal
        .replace(/[\x00-\x1F]/g, '') // control characters
        .replace(/^\.+/, '')         // leading dots (hidden files)
        .trim() || 'document';
}

export const downloadWord = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safe = sanitizeFilename(filename);
    link.download = safe.endsWith('.docx') ? safe : `${safe}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
};
