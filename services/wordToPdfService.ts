/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import mammoth from 'mammoth';

// ── Types ──────────────────────────────────────────

interface TextRun {
    text: string;
    bold: boolean;
    italic: boolean;
}

interface ContentBlock {
    type: 'heading' | 'paragraph' | 'list-item';
    level?: number;
    runs: TextRun[];
}

interface WordItem {
    text: string;
    font: PDFFont;
    lineBreak?: boolean;
}

// ── HTML Parsing ───────────────────────────────────

function parseHTMLToBlocks(html: string): ContentBlock[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const blocks: ContentBlock[] = [];

    function extractRuns(node: Node, bold = false, italic = false): TextRun[] {
        const runs: TextRun[] = [];
        for (const child of Array.from(node.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent || '';
                if (text) runs.push({ text, bold, italic });
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const el = child as Element;
                const tag = el.tagName.toLowerCase();
                if (tag === 'br') {
                    runs.push({ text: '\n', bold, italic });
                } else {
                    const b = bold || tag === 'strong' || tag === 'b';
                    const i = italic || tag === 'em' || tag === 'i';
                    runs.push(...extractRuns(el, b, i));
                }
            }
        }
        return runs;
    }

    function processElement(el: Element) {
        const tag = el.tagName.toLowerCase();

        if (/^h[1-6]$/.test(tag)) {
            blocks.push({
                type: 'heading',
                level: parseInt(tag[1]),
                runs: extractRuns(el, true, false),
            });
        } else if (tag === 'p') {
            const runs = extractRuns(el);
            if (runs.some(r => r.text.trim())) {
                blocks.push({ type: 'paragraph', runs });
            }
        } else if (tag === 'ul' || tag === 'ol') {
            for (const li of Array.from(el.children)) {
                if (li.tagName.toLowerCase() === 'li') {
                    blocks.push({ type: 'list-item', runs: extractRuns(li) });
                }
            }
        } else if (tag === 'table') {
            for (const row of Array.from(el.querySelectorAll('tr'))) {
                const cells = Array.from(row.querySelectorAll('td, th'));
                const text = cells.map(c => (c.textContent || '').trim()).join('  |  ');
                if (text.trim()) {
                    blocks.push({
                        type: 'paragraph',
                        runs: [{ text, bold: false, italic: false }],
                    });
                }
            }
        } else {
            const children = Array.from(el.children);
            if (children.length > 0) {
                children.forEach(processElement);
            } else {
                const runs = extractRuns(el);
                if (runs.some(r => r.text.trim())) {
                    blocks.push({ type: 'paragraph', runs });
                }
            }
        }
    }

    Array.from(doc.body.children).forEach(processElement);
    return blocks;
}

// ── Safe Text Drawing (Unicode fallback) ───────────

function safeDrawText(
    page: PDFPage,
    text: string,
    options: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb> }
) {
    try {
        page.drawText(text, options);
    } catch {
        const safe = text.replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
        if (safe.trim()) {
            try { page.drawText(safe, options); } catch { /* unsupported */ }
        }
    }
}

// ── Word Document Parsing ──────────────────────────

export const parseWordDocument = async (
    file: File,
    onProgress?: (progress: number, status: string) => void
): Promise<{ html: string }> => {
    onProgress?.(10, 'Reading Word document...');
    const arrayBuffer = await file.arrayBuffer();
    onProgress?.(30, 'Parsing document content...');
    const result = await mammoth.convertToHtml({ arrayBuffer });
    onProgress?.(50, 'Content extracted.');
    return { html: result.value };
};

// ── HTML to PDF Conversion ─────────────────────────

export const htmlToPDF = async (
    html: string,
    filename: string,
    onProgress?: (progress: number, status: string) => void
): Promise<Uint8Array> => {
    onProgress?.(55, 'Creating PDF document...');

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(filename.replace(/\.docx?$/i, ''));
    pdfDoc.setCreator('Sola PDF Converter');
    pdfDoc.setCreationDate(new Date());

    const fonts = {
        regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
        bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
        italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
        boldItalic: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
    };

    const PAGE_W = 595.28; // A4
    const PAGE_H = 841.89;
    const MARGIN = 56;
    const MAX_W = PAGE_W - 2 * MARGIN;
    const BODY_SIZE = 11;

    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;
    let pageNum = 1;

    function getFont(bold: boolean, italic: boolean): PDFFont {
        if (bold && italic) return fonts.boldItalic;
        if (bold) return fonts.bold;
        if (italic) return fonts.italic;
        return fonts.regular;
    }

    function headingSize(level: number): number {
        return [20, 16, 14, 13, 12, 11][Math.min(level - 1, 5)];
    }

    function addPageNumber() {
        const s = String(pageNum);
        const w = fonts.regular.widthOfTextAtSize(s, 9);
        page.drawText(s, {
            x: PAGE_W / 2 - w / 2,
            y: MARGIN / 2,
            size: 9,
            font: fonts.regular,
            color: rgb(0.5, 0.5, 0.5),
        });
    }

    function newPage() {
        addPageNumber();
        pageNum++;
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
    }

    function ensureSpace(needed: number) {
        if (y - needed < MARGIN) newPage();
    }

    const blocks = parseHTMLToBlocks(html);
    onProgress?.(65, 'Formatting content...');

    for (let bi = 0; bi < blocks.length; bi++) {
        const block = blocks[bi];
        const isHeading = block.type === 'heading';
        const isList = block.type === 'list-item';
        const fontSize = isHeading ? headingSize(block.level || 2) : BODY_SIZE;
        const lineHeight = fontSize * 1.45;

        if (isHeading && bi > 0) y -= lineHeight * 0.6;

        // Flatten runs into word items
        const items: WordItem[] = [];
        for (const run of block.runs) {
            const font = isHeading ? fonts.bold : getFont(run.bold, run.italic);
            const lines = run.text.split('\n');
            for (let li = 0; li < lines.length; li++) {
                if (li > 0) items.push({ text: '', font, lineBreak: true });
                const words = lines[li].split(/\s+/).filter(w => w.length > 0);
                for (const word of words) {
                    items.push({ text: word, font });
                }
            }
        }

        if (items.every(i => !i.text.trim() && !i.lineBreak)) continue;

        const listIndent = isList ? fonts.regular.widthOfTextAtSize('      ', fontSize) : 0;
        const startX = MARGIN + listIndent;
        const lineMaxW = MAX_W - listIndent;

        // Bullet for list items
        if (isList) {
            ensureSpace(lineHeight);
            safeDrawText(page, '-', {
                x: MARGIN + 8, y, size: fontSize,
                font: fonts.regular, color: rgb(0, 0, 0),
            });
        }

        // Render word by word with wrapping
        let x = startX;
        let lineStarted = false;

        for (const item of items) {
            if (item.lineBreak) {
                y -= lineHeight;
                ensureSpace(lineHeight);
                x = startX;
                lineStarted = false;
                continue;
            }
            if (!item.text) continue;

            const wordW = item.font.widthOfTextAtSize(item.text, fontSize);
            const spaceW = item.font.widthOfTextAtSize(' ', fontSize);

            if (lineStarted && x + spaceW + wordW > startX + lineMaxW) {
                y -= lineHeight;
                ensureSpace(lineHeight);
                x = startX;
                lineStarted = false;
            }

            if (lineStarted) x += spaceW;

            ensureSpace(lineHeight);
            safeDrawText(page, item.text, {
                x, y, size: fontSize,
                font: item.font, color: rgb(0, 0, 0),
            });
            x += wordW;
            lineStarted = true;
        }

        y -= lineHeight;
        y -= isHeading ? lineHeight * 0.3 : lineHeight * 0.15;

        if (bi % 20 === 0) {
            onProgress?.(65 + (bi / blocks.length) * 30, 'Formatting content...');
        }
    }

    addPageNumber();

    onProgress?.(97, 'Finalizing PDF...');
    const pdfBytes = await pdfDoc.save();
    onProgress?.(100, 'Conversion complete!');
    return pdfBytes;
};

// ── Main Conversion Pipeline ───────────────────────

export const wordToPDF = async (
    file: File,
    onProgress?: (progress: number, status: string) => void
): Promise<Uint8Array> => {
    if (!file.name.toLowerCase().endsWith('.docx') &&
        !file.type.includes('wordprocessingml')) {
        throw new Error('Please select a Word document (.docx file)');
    }

    onProgress?.(0, 'Starting conversion...');

    const { html } = await parseWordDocument(file, (prog, status) => {
        onProgress?.(prog * 0.5, status);
    });

    const pdfBytes = await htmlToPDF(html, file.name, (prog, status) => {
        const scaled = 25 + ((prog - 55) / 45) * 75;
        onProgress?.(Math.min(Math.max(scaled, 25), 100), status);
    });

    return pdfBytes;
};

// ── Download ───────────────────────────────────────

/** Sanitize filename — strip path traversal and control characters */
function sanitizeFilename(name: string): string {
    return name
        .replace(/[/\\]/g, '_')      // path separators
        .replace(/\.\./g, '_')       // path traversal
        .replace(/[\x00-\x1F]/g, '') // control characters
        .replace(/^\.+/, '')         // leading dots (hidden files)
        .trim() || 'document';
}

export const downloadPDF = (pdfBytes: Uint8Array, filename: string): void => {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safe = sanitizeFilename(filename);
    const pdfFilename = safe.replace(/\.docx?$/i, '.pdf');
    link.download = pdfFilename.endsWith('.pdf') ? pdfFilename : `${pdfFilename}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
};
