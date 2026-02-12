/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PDFDocument, rgb, StandardFonts, degrees, PDFPage } from 'pdf-lib';

export interface TextElement {
    id: string;
    pageNumber: number;
    x: number;
    y: number;
    text: string;
    fontSize: number;
    fontFamily: string;
    color: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    align: 'left' | 'center' | 'right';
}

export interface ImageElement {
    id: string;
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    opacity: number;
    imageData: string; // base64
}

export interface ShapeElement {
    id: string;
    pageNumber: number;
    type: 'rectangle' | 'circle' | 'line' | 'arrow';
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    strokeWidth: number;
    fillColor?: string;
}

export interface AnnotationElement {
    id: string;
    pageNumber: number;
    type: 'highlight' | 'strikethrough' | 'underline' | 'note';
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    text?: string;
}

export interface DrawingPath {
    id: string;
    pageNumber: number;
    points: { x: number; y: number }[];
    color: string;
    width: number;
}

export interface WhiteoutElement {
    id: string;
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface DetectedTextItem {
    id: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontFamily: string;
    color: string;
    transform: number[];
    pageNumber: number;
}

export interface EditorState {
    texts: TextElement[];
    images: ImageElement[];
    shapes: ShapeElement[];
    annotations: AnnotationElement[];
    drawings: DrawingPath[];
    whiteouts: WhiteoutElement[];
}

/**
 * Extract text items from a PDF file with canvas coordinates
 */
export const extractTextItems = async (
    file: File,
    pageNumber: number,
    scale: number = 1.5
): Promise<DetectedTextItem[]> => {
    const { pdfjsLib } = await import('./pdfConfig');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await (pdfjsLib.getDocument({ data: arrayBuffer })).promise;
    return extractTextItemsFromDoc(pdf, pageNumber, scale);
};

/**
 * Extract text items from a cached PDF document with canvas coordinates
 */
export const extractTextItemsFromDoc = async (
    doc: any,
    pageNumber: number,
    scale: number = 1.5
): Promise<DetectedTextItem[]> => {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const textContent = await page.getTextContent();

    const items: DetectedTextItem[] = [];
    let counter = 0;

    for (const item of textContent.items) {
        if (!('str' in item) || !item.str.trim()) continue;

        const tx = item.transform;
        const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
        const [canvasX, canvasY] = viewport.convertToViewportPoint(tx[4], tx[5]);
        const estimatedWidth = item.width * scale;
        const estimatedHeight = fontSize * scale;

        items.push({
            id: `detected-${pageNumber}-${counter++}`,
            text: item.str,
            x: canvasX,
            y: canvasY - estimatedHeight,
            width: estimatedWidth,
            height: estimatedHeight,
            fontSize: fontSize * scale,
            fontFamily: item.fontName || 'Helvetica',
            color: '#000000',
            transform: tx,
            pageNumber,
        });
    }

    return items;
};

/**
 * Apply whiteout elements to PDF (drawn FIRST, before other elements)
 * Coordinates are in canvas space and divided by scale
 */
export const applyWhiteoutElements = async (
    pdfDoc: PDFDocument,
    whiteouts: WhiteoutElement[],
    scale: number = 1.5
): Promise<void> => {
    const pages = pdfDoc.getPages();

    for (const wo of whiteouts) {
        const page = pages[wo.pageNumber - 1];
        const { height } = page.getSize();

        const pdfX = wo.x / scale;
        const pdfY = height - (wo.y / scale) - (wo.height / scale);
        const pdfW = wo.width / scale;
        const pdfH = wo.height / scale;

        page.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: pdfW,
            height: pdfH,
            color: rgb(1, 1, 1),
        });
    }
};

/**
 * Load PDF and get page information
 */
export const loadPDFForEditing = async (file: File): Promise<{
    pdfDoc: PDFDocument;
    pageCount: number;
    pages: PDFPage[];
}> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pages = pdfDoc.getPages();

    return {
        pdfDoc,
        pageCount: pages.length,
        pages
    };
};

/**
 * Render PDF page to canvas (parses file each time — prefer renderPDFPageFromDoc)
 */
export const renderPDFPage = async (
    file: File,
    pageNumber: number,
    scale: number = 1.5
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> => {
    const { pdfjsLib } = await import('./pdfConfig');
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    return renderPDFPageFromDoc(pdf, pageNumber, scale);
};

/**
 * Render PDF page to canvas from a cached PDFDocumentProxy
 */
export const renderPDFPageFromDoc = async (
    doc: any,
    pageNumber: number,
    scale: number = 1.5
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> => {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Failed to get canvas context');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
        canvasContext: context,
        viewport: viewport,
    }).promise;

    return {
        canvas,
        width: viewport.width,
        height: viewport.height
    };
};

/**
 * Apply text elements to PDF
 * All coordinates stored in canvas space — divided by scale for PDF embedding
 */
export const applyTextElements = async (
    pdfDoc: PDFDocument,
    texts: TextElement[],
    scale: number = 1.5
): Promise<void> => {
    const pages = pdfDoc.getPages();

    for (const textEl of texts) {
        const page = pages[textEl.pageNumber - 1];
        const { height } = page.getSize();

        const color = hexToRgb(textEl.color);

        let font;
        if (textEl.fontFamily === 'Courier') {
            font = await pdfDoc.embedFont(StandardFonts.Courier);
        } else if (textEl.fontFamily === 'Times New Roman') {
            font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        } else {
            font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        }

        const pdfFontSize = textEl.fontSize / scale;

        page.drawText(textEl.text, {
            x: textEl.x / scale,
            y: height - (textEl.y / scale) - pdfFontSize,
            size: pdfFontSize,
            font: font,
            color: rgb(color.r, color.g, color.b),
        });
    }
};

/**
 * Apply image elements to PDF
 * All coordinates stored in canvas space — divided by scale for PDF embedding
 */
export const applyImageElements = async (
    pdfDoc: PDFDocument,
    images: ImageElement[],
    scale: number = 1.5
): Promise<void> => {
    const pages = pdfDoc.getPages();

    for (const imgEl of images) {
        const page = pages[imgEl.pageNumber - 1];
        const { height } = page.getSize();

        let embeddedImage;
        const mimeType = imgEl.imageData.split(',')[0].split(':')[1]?.split(';')[0] || '';

        if (mimeType === 'image/png') {
            const imageBytes = base64ToArrayBuffer(imgEl.imageData.split(',')[1]);
            embeddedImage = await pdfDoc.embedPng(imageBytes);
        } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
            const imageBytes = base64ToArrayBuffer(imgEl.imageData.split(',')[1]);
            embeddedImage = await pdfDoc.embedJpg(imageBytes);
        } else {
            throw new Error(`Unsupported image format: ${mimeType}. Only PNG and JPEG images can be embedded in PDF.`);
        }

        page.drawImage(embeddedImage, {
            x: imgEl.x / scale,
            y: height - (imgEl.y / scale) - (imgEl.height / scale),
            width: imgEl.width / scale,
            height: imgEl.height / scale,
            rotate: degrees(imgEl.rotation),
            opacity: imgEl.opacity,
        });
    }
};

/**
 * Apply shape elements to PDF
 * All coordinates stored in canvas space — divided by scale for PDF embedding
 */
export const applyShapeElements = async (
    pdfDoc: PDFDocument,
    shapes: ShapeElement[],
    scale: number = 1.5
): Promise<void> => {
    const pages = pdfDoc.getPages();

    for (const shape of shapes) {
        const page = pages[shape.pageNumber - 1];
        const { height } = page.getSize();
        const color = hexToRgb(shape.color);

        if (shape.type === 'rectangle') {
            const fill = shape.fillColor ? hexToRgb(shape.fillColor) : undefined;
            page.drawRectangle({
                x: shape.x / scale,
                y: height - (shape.y / scale) - (shape.height / scale),
                width: shape.width / scale,
                height: shape.height / scale,
                borderColor: rgb(color.r, color.g, color.b),
                borderWidth: shape.strokeWidth / scale,
                color: fill ? rgb(fill.r, fill.g, fill.b) : undefined,
            });
        } else if (shape.type === 'circle') {
            const fill = shape.fillColor ? hexToRgb(shape.fillColor) : undefined;
            page.drawEllipse({
                x: (shape.x + shape.width / 2) / scale,
                y: height - (shape.y + shape.height / 2) / scale,
                xScale: (shape.width / 2) / scale,
                yScale: (shape.height / 2) / scale,
                borderColor: rgb(color.r, color.g, color.b),
                borderWidth: shape.strokeWidth / scale,
                color: fill ? rgb(fill.r, fill.g, fill.b) : undefined,
            });
        } else if (shape.type === 'line') {
            page.drawLine({
                start: { x: shape.x / scale, y: height - shape.y / scale },
                end: { x: (shape.x + shape.width) / scale, y: height - (shape.y + shape.height) / scale },
                thickness: shape.strokeWidth / scale,
                color: rgb(color.r, color.g, color.b),
            });
        }
    }
};

/**
 * Apply annotation elements to PDF
 * All coordinates stored in canvas space — divided by scale for PDF embedding
 */
export const applyAnnotationElements = async (
    pdfDoc: PDFDocument,
    annotations: AnnotationElement[],
    scale: number = 1.5
): Promise<void> => {
    const pages = pdfDoc.getPages();

    for (const annotation of annotations) {
        const page = pages[annotation.pageNumber - 1];
        const { height } = page.getSize();
        const color = hexToRgb(annotation.color);

        if (annotation.type === 'highlight') {
            page.drawRectangle({
                x: annotation.x / scale,
                y: height - (annotation.y / scale) - (annotation.height / scale),
                width: annotation.width / scale,
                height: annotation.height / scale,
                color: rgb(color.r, color.g, color.b),
                opacity: 0.3,
            });
        } else if (annotation.type === 'strikethrough' || annotation.type === 'underline') {
            const y = annotation.type === 'strikethrough'
                ? height - (annotation.y + annotation.height / 2) / scale
                : height - (annotation.y + annotation.height) / scale;

            page.drawLine({
                start: { x: annotation.x / scale, y },
                end: { x: (annotation.x + annotation.width) / scale, y },
                thickness: 2 / scale,
                color: rgb(color.r, color.g, color.b),
            });
        }
    }
};

/**
 * Apply drawing paths to PDF
 * All coordinates stored in canvas space — divided by scale for PDF embedding
 */
export const applyDrawingPaths = async (
    pdfDoc: PDFDocument,
    drawings: DrawingPath[],
    scale: number = 1.5
): Promise<void> => {
    const pages = pdfDoc.getPages();

    for (const drawing of drawings) {
        const page = pages[drawing.pageNumber - 1];
        const { height } = page.getSize();
        const color = hexToRgb(drawing.color);

        for (let i = 0; i < drawing.points.length - 1; i++) {
            const start = drawing.points[i];
            const end = drawing.points[i + 1];

            page.drawLine({
                start: { x: start.x / scale, y: height - start.y / scale },
                end: { x: end.x / scale, y: height - end.y / scale },
                thickness: drawing.width / scale,
                color: rgb(color.r, color.g, color.b),
            });
        }
    }
};

/**
 * Save edited PDF — whiteouts applied first, then all other elements
 * All element coordinates are in canvas space and will be converted to PDF space
 */
export const saveEditedPDF = async (
    file: File,
    editorState: EditorState,
    scale: number = 1.5
): Promise<Uint8Array> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    // Apply whiteouts FIRST (covers original content)
    if (editorState.whiteouts.length > 0) {
        await applyWhiteoutElements(pdfDoc, editorState.whiteouts, scale);
    }

    // Then overlay new content — pass scale for coordinate conversion
    try {
        await applyTextElements(pdfDoc, editorState.texts, scale);
        await applyImageElements(pdfDoc, editorState.images, scale);
        await applyShapeElements(pdfDoc, editorState.shapes, scale);
        await applyAnnotationElements(pdfDoc, editorState.annotations, scale);
        await applyDrawingPaths(pdfDoc, editorState.drawings, scale);
    } catch (err) {
        throw new Error(`Failed to apply edits to PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
};

// Helper functions
function hexToRgb(hex: string): { r: number; g: number; b: number } {
    // Remove # if present
    const cleanHex = hex.replace(/^#/, '');

    // Handle 3-digit shorthand (#fff → #ffffff)
    const fullHex = cleanHex.length === 3
        ? cleanHex.split('').map(char => char + char).join('')
        : cleanHex;

    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 0 };
}

function base64ToArrayBuffer(base64: string): Uint8Array {
    try {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    } catch (err) {
        throw new Error(`Invalid base64 string: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
}
