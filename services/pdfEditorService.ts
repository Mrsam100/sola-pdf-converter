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

export interface EditorState {
    texts: TextElement[];
    images: ImageElement[];
    shapes: ShapeElement[];
    annotations: AnnotationElement[];
    drawings: DrawingPath[];
}

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
 * Render PDF page to canvas
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

    const page = await pdf.getPage(pageNumber);
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
        canvas: canvas
    }).promise;

    return {
        canvas,
        width: viewport.width,
        height: viewport.height
    };
};

/**
 * Apply text elements to PDF
 */
export const applyTextElements = async (
    pdfDoc: PDFDocument,
    texts: TextElement[]
): Promise<void> => {
    const pages = pdfDoc.getPages();

    for (const textEl of texts) {
        const page = pages[textEl.pageNumber - 1];
        const { height } = page.getSize();

        // Convert hex color to RGB
        const color = hexToRgb(textEl.color);

        // Get font
        let font;
        if (textEl.fontFamily === 'Courier') {
            font = await pdfDoc.embedFont(StandardFonts.Courier);
        } else if (textEl.fontFamily === 'Times New Roman') {
            font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        } else {
            font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        }

        // Draw text (flip Y coordinate)
        page.drawText(textEl.text, {
            x: textEl.x,
            y: height - textEl.y - textEl.fontSize,
            size: textEl.fontSize,
            font: font,
            color: rgb(color.r, color.g, color.b),
        });
    }
};

/**
 * Apply image elements to PDF
 */
export const applyImageElements = async (
    pdfDoc: PDFDocument,
    images: ImageElement[]
): Promise<void> => {
    const pages = pdfDoc.getPages();

    for (const imgEl of images) {
        const page = pages[imgEl.pageNumber - 1];
        const { height } = page.getSize();

        try {
            // Determine image type from base64
            let embeddedImage;
            if (imgEl.imageData.includes('image/png')) {
                const imageBytes = base64ToArrayBuffer(imgEl.imageData.split(',')[1]);
                embeddedImage = await pdfDoc.embedPng(imageBytes);
            } else {
                const imageBytes = base64ToArrayBuffer(imgEl.imageData.split(',')[1]);
                embeddedImage = await pdfDoc.embedJpg(imageBytes);
            }

            // Draw image (flip Y coordinate)
            page.drawImage(embeddedImage, {
                x: imgEl.x,
                y: height - imgEl.y - imgEl.height,
                width: imgEl.width,
                height: imgEl.height,
                rotate: degrees(imgEl.rotation),
                opacity: imgEl.opacity,
            });
        } catch (error) {
            console.error('Failed to embed image:', error);
        }
    }
};

/**
 * Apply shape elements to PDF
 */
export const applyShapeElements = async (
    pdfDoc: PDFDocument,
    shapes: ShapeElement[]
): Promise<void> => {
    const pages = pdfDoc.getPages();

    for (const shape of shapes) {
        const page = pages[shape.pageNumber - 1];
        const { height } = page.getSize();
        const color = hexToRgb(shape.color);

        if (shape.type === 'rectangle') {
            page.drawRectangle({
                x: shape.x,
                y: height - shape.y - shape.height,
                width: shape.width,
                height: shape.height,
                borderColor: rgb(color.r, color.g, color.b),
                borderWidth: shape.strokeWidth,
                color: shape.fillColor ? hexToRgb(shape.fillColor) : undefined,
            });
        } else if (shape.type === 'circle') {
            page.drawEllipse({
                x: shape.x + shape.width / 2,
                y: height - shape.y - shape.height / 2,
                xScale: shape.width / 2,
                yScale: shape.height / 2,
                borderColor: rgb(color.r, color.g, color.b),
                borderWidth: shape.strokeWidth,
                color: shape.fillColor ? hexToRgb(shape.fillColor) : undefined,
            });
        } else if (shape.type === 'line') {
            page.drawLine({
                start: { x: shape.x, y: height - shape.y },
                end: { x: shape.x + shape.width, y: height - shape.y - shape.height },
                thickness: shape.strokeWidth,
                color: rgb(color.r, color.g, color.b),
            });
        }
    }
};

/**
 * Apply annotation elements to PDF
 */
export const applyAnnotationElements = async (
    pdfDoc: PDFDocument,
    annotations: AnnotationElement[]
): Promise<void> => {
    const pages = pdfDoc.getPages();

    for (const annotation of annotations) {
        const page = pages[annotation.pageNumber - 1];
        const { height } = page.getSize();
        const color = hexToRgb(annotation.color);

        if (annotation.type === 'highlight') {
            page.drawRectangle({
                x: annotation.x,
                y: height - annotation.y - annotation.height,
                width: annotation.width,
                height: annotation.height,
                color: rgb(color.r, color.g, color.b),
                opacity: 0.3,
            });
        } else if (annotation.type === 'strikethrough' || annotation.type === 'underline') {
            const y = annotation.type === 'strikethrough'
                ? height - annotation.y - annotation.height / 2
                : height - annotation.y - annotation.height;

            page.drawLine({
                start: { x: annotation.x, y },
                end: { x: annotation.x + annotation.width, y },
                thickness: 2,
                color: rgb(color.r, color.g, color.b),
            });
        }
    }
};

/**
 * Apply drawing paths to PDF
 */
export const applyDrawingPaths = async (
    pdfDoc: PDFDocument,
    drawings: DrawingPath[]
): Promise<void> => {
    const pages = pdfDoc.getPages();

    for (const drawing of drawings) {
        const page = pages[drawing.pageNumber - 1];
        const { height } = page.getSize();
        const color = hexToRgb(drawing.color);

        // Draw each segment of the path
        for (let i = 0; i < drawing.points.length - 1; i++) {
            const start = drawing.points[i];
            const end = drawing.points[i + 1];

            page.drawLine({
                start: { x: start.x, y: height - start.y },
                end: { x: end.x, y: height - end.y },
                thickness: drawing.width,
                color: rgb(color.r, color.g, color.b),
            });
        }
    }
};

/**
 * Save edited PDF
 */
export const saveEditedPDF = async (
    file: File,
    editorState: EditorState
): Promise<Uint8Array> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    // Apply all modifications
    await applyTextElements(pdfDoc, editorState.texts);
    await applyImageElements(pdfDoc, editorState.images);
    await applyShapeElements(pdfDoc, editorState.shapes);
    await applyAnnotationElements(pdfDoc, editorState.annotations);
    await applyDrawingPaths(pdfDoc, editorState.drawings);

    // Save the modified PDF
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
};

// Helper functions
function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 0 };
}

function base64ToArrayBuffer(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}
