/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PDF to PowerPoint — 100% client-side
 * 1. Render each PDF page to canvas at high DPI via pdf.js
 * 2. Convert canvas to JPEG image
 * 3. Build PPTX with one slide per page using pptxgenjs
 */

export interface AbortSignal {
    current: boolean;
}

export const pdfToPowerPoint = async (
    file: File,
    onProgress?: (progress: number, status: string) => void,
    abortSignal?: AbortSignal
): Promise<Uint8Array> => {
    const { pdfjsLib } = await import('./pdfConfig');
    const PptxGenJS = (await import('pptxgenjs')).default;

    onProgress?.(5, 'Loading PDF...');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    try {
        const totalPages = pdf.numPages;
        onProgress?.(10, `Converting ${totalPages} page${totalPages > 1 ? 's' : ''} to slides...`);

        const pptx = new PptxGenJS();
        pptx.title = file.name.replace(/\.pdf$/i, '');
        pptx.author = 'Sola PDF Converter';

        // Read first page to determine aspect ratio
        const firstPage = await pdf.getPage(1);
        const firstVp = firstPage.getViewport({ scale: 1 });
        const isLandscape = firstVp.width > firstVp.height;

        // Set slide dimensions to match PDF page ratio
        if (isLandscape) {
            const w = 13.33;
            const h = w * (firstVp.height / firstVp.width);
            pptx.defineLayout({ name: 'PDF', width: w, height: h });
        } else {
            const h = 7.5;
            const w = h * (firstVp.width / firstVp.height);
            pptx.defineLayout({ name: 'PDF', width: w, height: h });
        }
        pptx.layout = 'PDF';

        /**
         * 🔒 MEMORY FIX: Adaptive canvas scaling to prevent memory explosion
         *
         * Problem: scale=2 creates huge canvases (e.g., 1224x1584px = 7.7MB per page)
         *          For large PDFs, this causes browser crashes
         * Solution: Use adaptive scaling based on page dimensions
         */
        const MAX_CANVAS_PIXELS = 1920 * 1080; // 2MP max to prevent memory issues

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            if (abortSignal?.current) throw new Error('Conversion cancelled');

            const pct = 10 + (pageNum / totalPages) * 80;
            onProgress?.(pct, `Rendering page ${pageNum} of ${totalPages}...`);

            const page = await pdf.getPage(pageNum);

            // 🔒 MEMORY FIX: Calculate adaptive scale based on page size
            const baseVp = page.getViewport({ scale: 1 });
            const basePixels = baseVp.width * baseVp.height;

            // Default scale=1.5 (108 DPI) for good quality
            // But reduce if canvas would be too large
            let scale = 1.5;
            if (basePixels * scale * scale > MAX_CANVAS_PIXELS) {
                scale = Math.sqrt(MAX_CANVAS_PIXELS / basePixels);
            }

            const vp = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.width = vp.width;
            canvas.height = vp.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Failed to create canvas context');

            await page.render({ canvasContext: ctx, viewport: vp }).promise;

            const imageData = canvas.toDataURL('image/jpeg', 0.92);

            const slide = pptx.addSlide();
            slide.addImage({
                data: imageData,
                x: 0,
                y: 0,
                w: '100%',
                h: '100%',
            });

            // 🔒 MEMORY FIX: Aggressive canvas cleanup
            canvas.width = 0;
            canvas.height = 0;
            ctx.clearRect(0, 0, 0, 0);

            // Force garbage collection hint (non-standard, only in some browsers)
            if (pageNum % 10 === 0 && typeof (global as any).gc === 'function') {
                try {
                    (global as any).gc();
                } catch { /* ignore */ }
            }
        }

        if (abortSignal?.current) throw new Error('Conversion cancelled');

        onProgress?.(95, 'Generating PowerPoint file...');
        const pptxData = await pptx.write({ outputType: 'uint8array' }) as Uint8Array;

        onProgress?.(100, 'Conversion complete!');
        return pptxData;
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
        .trim() || 'presentation';
}

export const downloadPPTX = (data: Uint8Array, filename: string): void => {
    const blob = new Blob([data], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safe = sanitizeFilename(filename);
    const pptxName = safe.replace(/\.pdf$/i, '.pptx');
    link.download = pptxName.endsWith('.pptx') ? pptxName : `${pptxName}.pptx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
};
