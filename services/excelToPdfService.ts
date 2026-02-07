/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Excel to PDF — 100% client-side
 * 1. Parse .xlsx/.xls/.csv using SheetJS
 * 2. Render tables into PDF pages using pdf-lib
 */

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import * as XLSX from 'xlsx';

// ── Types ─────────────────────────────────────────

interface SheetData {
    name: string;
    rows: string[][];
    colWidths: number[]; // character widths per column
}

// ── Excel Parsing ─────────────────────────────────

function parseExcelFile(arrayBuffer: ArrayBuffer): SheetData[] {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheets: SheetData[] = [];

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet['!ref']) continue;

        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: '',
            raw: false,
        }) as string[][];

        if (rows.length === 0) continue;

        // Determine max columns
        const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0);

        // Normalize: ensure all rows have same column count
        const normalized = rows.map(row => {
            const padded = [...row];
            while (padded.length < maxCols) padded.push('');
            return padded.map(cell => String(cell ?? ''));
        });

        // Calculate column widths (in characters)
        const colWidths: number[] = [];
        for (let c = 0; c < maxCols; c++) {
            let maxLen = 5; // minimum 5 chars
            for (const row of normalized) {
                const cellLen = (row[c] || '').length;
                if (cellLen > maxLen) maxLen = cellLen;
            }
            colWidths.push(Math.min(maxLen, 40)); // cap at 40 chars
        }

        sheets.push({ name: sheetName, rows: normalized, colWidths });
    }

    return sheets;
}

// ── PDF Table Rendering ───────────────────────────

function drawTableOnPDF(
    pdfDoc: PDFDocument,
    sheet: SheetData,
    fonts: { regular: PDFFont; bold: PDFFont },
    isFirstSheet: boolean,
    filename: string
): void {
    const PAGE_W = 595.28; // A4
    const PAGE_H = 841.89;
    const MARGIN = 40;
    const CELL_PAD = 4;
    const FONT_SIZE = 8;
    const HEADER_FONT_SIZE = 9;
    const LINE_HEIGHT = FONT_SIZE + CELL_PAD * 2;
    const HEADER_HEIGHT = HEADER_FONT_SIZE + CELL_PAD * 2;
    const MAX_TABLE_W = PAGE_W - 2 * MARGIN;

    // Calculate column pixel widths proportional to character widths
    const totalCharWidth = sheet.colWidths.reduce((s, w) => s + w, 0);
    const colPixelWidths = sheet.colWidths.map(w => (w / totalCharWidth) * MAX_TABLE_W);

    let page: PDFPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    // Title
    if (isFirstSheet) {
        const title = filename.replace(/\.(xlsx?|csv)$/i, '');
        const titleW = fonts.bold.widthOfTextAtSize(title, 14);
        page.drawText(title, {
            x: PAGE_W / 2 - titleW / 2,
            y,
            size: 14,
            font: fonts.bold,
            color: rgb(0, 0, 0),
        });
        y -= 24;
    }

    // Sheet name (if multiple sheets exist)
    if (sheet.name && sheet.name !== 'Sheet1') {
        page.drawText(sheet.name, {
            x: MARGIN,
            y,
            size: 11,
            font: fonts.bold,
            color: rgb(0.2, 0.2, 0.2),
        });
        y -= 18;
    }

    let pageNum = 1;

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

    /** Truncate text to fit within pixel width */
    function truncateText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string {
        if (!text) return '';
        try {
            const fullWidth = font.widthOfTextAtSize(text, fontSize);
            if (fullWidth <= maxWidth) return text;

            // Binary search for fitting length
            let lo = 0, hi = text.length;
            while (lo < hi) {
                const mid = (lo + hi + 1) >> 1;
                const w = font.widthOfTextAtSize(text.substring(0, mid) + '...', fontSize);
                if (w <= maxWidth) lo = mid; else hi = mid - 1;
            }
            return lo > 0 ? text.substring(0, lo) + '...' : '';
        } catch {
            // Unicode encoding issue — strip and retry
            const safe = text.replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
            return safe.substring(0, 20);
        }
    }

    /** Draw one row of cells */
    function drawRow(row: string[], rowY: number, isHeader: boolean) {
        const fontSize = isHeader ? HEADER_FONT_SIZE : FONT_SIZE;
        const rowHeight = isHeader ? HEADER_HEIGHT : LINE_HEIGHT;
        const font = isHeader ? fonts.bold : fonts.regular;
        const bgColor = isHeader ? rgb(0.93, 0.93, 0.95) : null;

        let x = MARGIN;

        for (let c = 0; c < row.length; c++) {
            const colW = colPixelWidths[c] || 60;

            // Background for header
            if (bgColor) {
                page.drawRectangle({
                    x, y: rowY - rowHeight, width: colW, height: rowHeight,
                    color: bgColor,
                });
            }

            // Cell border
            page.drawRectangle({
                x, y: rowY - rowHeight, width: colW, height: rowHeight,
                borderColor: rgb(0.75, 0.75, 0.75),
                borderWidth: 0.5,
            });

            // Cell text
            const cellText = truncateText(String(row[c] ?? ''), font, fontSize, colW - CELL_PAD * 2);
            if (cellText) {
                try {
                    page.drawText(cellText, {
                        x: x + CELL_PAD,
                        y: rowY - rowHeight + CELL_PAD,
                        size: fontSize,
                        font,
                        color: rgb(0, 0, 0),
                    });
                } catch {
                    // Unicode fallback
                    const safe = cellText.replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
                    if (safe.trim()) {
                        try {
                            page.drawText(safe, {
                                x: x + CELL_PAD,
                                y: rowY - rowHeight + CELL_PAD,
                                size: fontSize,
                                font,
                                color: rgb(0, 0, 0),
                            });
                        } catch { /* skip unsupported characters */ }
                    }
                }
            }

            x += colW;
        }
    }

    // Render rows
    for (let r = 0; r < sheet.rows.length; r++) {
        const isHeader = r === 0;
        const rowHeight = isHeader ? HEADER_HEIGHT : LINE_HEIGHT;

        // Check if we need a new page
        if (y - rowHeight < MARGIN + 20) {
            newPage();
        }

        drawRow(sheet.rows[r], y, isHeader);
        y -= rowHeight;
    }

    addPageNumber();
}

// ── Main Service ──────────────────────────────────

export const excelToPDF = async (
    file: File,
    onProgress?: (progress: number, status: string) => void
): Promise<Uint8Array> => {
    onProgress?.(5, 'Reading spreadsheet...');
    const arrayBuffer = await file.arrayBuffer();

    onProgress?.(20, 'Parsing spreadsheet data...');
    const sheets = parseExcelFile(arrayBuffer);

    if (sheets.length === 0) {
        throw new Error('No data could be read from this file. The spreadsheet may be empty or in an unsupported format.');
    }

    onProgress?.(40, 'Creating PDF...');
    const pdfDoc = await PDFDocument.create();
    const docTitle = file.name.replace(/\.(xlsx?|csv)$/i, '');
    pdfDoc.setTitle(docTitle);
    pdfDoc.setCreator('Sola PDF Converter');
    pdfDoc.setCreationDate(new Date());

    const fonts = {
        regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
        bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    };

    for (let i = 0; i < sheets.length; i++) {
        const pct = 40 + (i / sheets.length) * 50;
        onProgress?.(pct, `Rendering sheet "${sheets[i].name}"...`);
        drawTableOnPDF(pdfDoc, sheets[i], fonts, i === 0, file.name);
    }

    onProgress?.(95, 'Finalizing PDF...');
    const pdfBytes = await pdfDoc.save();
    onProgress?.(100, 'Conversion complete!');
    return pdfBytes;
};

// ── Download ──────────────────────────────────────

function sanitizeFilename(name: string): string {
    return name
        .replace(/[/\\]/g, '_')
        .replace(/\.\./g, '_')
        .replace(/[\x00-\x1F]/g, '')
        .replace(/^\.+/, '')
        .trim() || 'document';
}

export const downloadPDF = (pdfBytes: Uint8Array, filename: string): void => {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safe = sanitizeFilename(filename);
    const pdfFilename = safe.replace(/\.(xlsx?|csv)$/i, '.pdf');
    link.download = pdfFilename.endsWith('.pdf') ? pdfFilename : `${pdfFilename}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
};
