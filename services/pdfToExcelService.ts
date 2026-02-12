/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PDF to Excel — 100% client-side
 * 1. Extract text items with positions from PDF via pdf.js
 * 2. Detect table rows/columns from spatial clustering
 * 3. Build 2D grid → write .xlsx with SheetJS
 */

import * as XLSX from 'xlsx';

// ── Types ─────────────────────────────────────────

interface TextItem {
    text: string;
    x: number;
    y: number;
    width: number;
    fontSize: number;
}

interface TableRow {
    y: number;
    cells: { col: number; text: string }[];
}

export interface AbortSignal {
    current: boolean;
}

// ── Column Detection ──────────────────────────────

/** Cluster X positions into column boundaries */
function detectColumns(items: TextItem[], tolerance: number): number[] {
    const xPositions = items.map(i => Math.round(i.x)).sort((a, b) => a - b);
    if (xPositions.length === 0) return [];

    const clusters: number[] = [xPositions[0]];

    for (const x of xPositions) {
        const lastCluster = clusters[clusters.length - 1];
        if (x - lastCluster > tolerance) {
            clusters.push(x);
        }
    }

    return clusters;
}

/** Find which column a given x-position belongs to */
function findColumn(x: number, columns: number[], tolerance: number): number {
    for (let i = 0; i < columns.length; i++) {
        if (Math.abs(x - columns[i]) <= tolerance) return i;
    }
    // Fallback: nearest column
    let minDist = Infinity;
    let best = 0;
    for (let i = 0; i < columns.length; i++) {
        const dist = Math.abs(x - columns[i]);
        if (dist < minDist) { minDist = dist; best = i; }
    }
    return best;
}

// ── Row Detection ─────────────────────────────────

/** Group text items into rows by Y position */
function detectRows(items: TextItem[], tolerance: number): TableRow[] {
    if (items.length === 0) return [];

    // Sort by Y descending (PDF origin is bottom-left, higher Y = higher on page)
    const sorted = [...items].sort((a, b) => b.y - a.y);

    const rows: { y: number; items: TextItem[] }[] = [];
    let currentRow = { y: sorted[0].y, items: [sorted[0]] };

    for (let i = 1; i < sorted.length; i++) {
        const item = sorted[i];
        if (Math.abs(currentRow.y - item.y) <= tolerance) {
            currentRow.items.push(item);
        } else {
            rows.push(currentRow);
            currentRow = { y: item.y, items: [item] };
        }
    }
    rows.push(currentRow);

    return rows.map(r => ({
        y: r.y,
        cells: r.items
            .sort((a, b) => a.x - b.x)
            .map(item => ({ col: 0, text: item.text })),
    }));
}

// ── Table Extraction ──────────────────────────────

function extractTableFromItems(items: TextItem[]): string[][] {
    if (items.length === 0) return [];

    /**
     * 🔒 ROBUSTNESS FIX: Use median font size instead of average
     *
     * Problem: Mixed fonts (e.g., headers=16px, body=10px) cause average=13px
     *          which is wrong for both header and body clustering
     * Solution: Use median which is robust to outliers + fallback tolerances
     */
    // Calculate median font size (more robust than average for mixed fonts)
    const fontSizes = items.map(i => i.fontSize).sort((a, b) => a - b);
    const medianFontSize = fontSizes[Math.floor(fontSizes.length / 2)];

    // Use median as base, but add min/max bounds for safety
    const baseFontSize = Math.max(8, Math.min(medianFontSize, 20)); // Clamp between 8-20px
    const rowTolerance = baseFontSize * 0.4;
    const colTolerance = baseFontSize * 1.5;

    // Detect columns and rows with robust tolerance
    const columns = detectColumns(items, colTolerance);
    const rows = detectRows(items, rowTolerance);

    if (columns.length === 0) return rows.map(r => [r.cells.map(c => c.text).join(' ')]);

    // Build 2D grid
    const grid: string[][] = [];

    for (const row of rows) {
        const gridRow = new Array(columns.length).fill('');
        for (const cell of row.cells) {
            // Find original item to get exact x
            const origItem = items.find(i => i.text === cell.text && Math.abs(i.y - row.y) <= rowTolerance);
            const colIndex = origItem
                ? findColumn(origItem.x, columns, colTolerance)
                : findColumn(0, columns, colTolerance);

            if (gridRow[colIndex]) {
                gridRow[colIndex] += ' ' + cell.text;
            } else {
                gridRow[colIndex] = cell.text;
            }
        }
        // Only add row if it has content
        if (gridRow.some(c => c.trim())) {
            grid.push(gridRow);
        }
    }

    return grid;
}

// ── Main Service ──────────────────────────────────

export const pdfToExcel = async (
    file: File,
    onProgress?: (progress: number, status: string) => void,
    abortSignal?: AbortSignal
): Promise<Uint8Array> => {
    const { pdfjsLib } = await import('./pdfConfig');

    onProgress?.(5, 'Loading PDF...');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    try {
        const workbook = XLSX.utils.book_new();
        const totalPages = pdf.numPages;

        onProgress?.(10, `Extracting tables from ${totalPages} page${totalPages > 1 ? 's' : ''}...`);

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            if (abortSignal?.current) throw new Error('Conversion cancelled');

            const progressPct = 10 + (pageNum / totalPages) * 75;
            onProgress?.(progressPct, `Processing page ${pageNum} of ${totalPages}...`);

            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const items: TextItem[] = [];

            for (const item of textContent.items as any[]) {
                if (!item.str?.trim()) continue;
                const x = item.transform ? item.transform[4] : 0;
                const y = item.transform ? item.transform[5] : 0;
                const fontSize = item.transform ? Math.abs(item.transform[3]) : 12;
                const width = item.width || (item.str.length * fontSize * 0.5);

                items.push({ text: item.str.trim(), x, y, width, fontSize });
            }

            const grid = extractTableFromItems(items);

            if (grid.length > 0) {
                const sheet = XLSX.utils.aoa_to_sheet(grid);

                // Auto-size columns
                const colWidths = grid[0].map((_, colIdx) => {
                    const maxLen = grid.reduce((max, row) => {
                        const cellLen = (row[colIdx] || '').length;
                        return cellLen > max ? cellLen : max;
                    }, 5);
                    return { wch: Math.min(maxLen + 2, 60) };
                });
                sheet['!cols'] = colWidths;

                const sheetName = totalPages > 1 ? `Page ${pageNum}` : 'Sheet1';
                XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
            }
        }

        // If no tables found, create a sheet noting that
        if (workbook.SheetNames.length === 0) {
            const emptySheet = XLSX.utils.aoa_to_sheet([
                ['No tabular data could be extracted from this PDF.'],
                ['The PDF may not contain tables, or the tables may use a format that could not be detected.'],
            ]);
            XLSX.utils.book_append_sheet(workbook, emptySheet, 'Sheet1');
        }

        if (abortSignal?.current) throw new Error('Conversion cancelled');

        onProgress?.(90, 'Generating Excel file...');
        const xlsxData = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

        onProgress?.(100, 'Conversion complete!');
        return new Uint8Array(xlsxData);
    } finally {
        pdf.destroy();
    }
};

// ── Download ──────────────────────────────────────

function sanitizeFilename(name: string): string {
    return name
        .replace(/[/\\]/g, '_')
        .replace(/\.\./g, '_')
        .replace(/[\x00-\x1F]/g, '')
        .replace(/^\.+/, '')
        .trim() || 'spreadsheet';
}

export const downloadExcel = (data: Uint8Array, filename: string): void => {
    const blob = new Blob([data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safe = sanitizeFilename(filename);
    const xlsxName = safe.replace(/\.pdf$/i, '.xlsx');
    link.download = xlsxName.endsWith('.xlsx') ? xlsxName : `${xlsxName}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
};
