/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { PlacedField, SignatureData } from '../types';

interface EmbedSignaturesOptions {
  file: File;
  placedFields: PlacedField[];
  signatures: Map<string, SignatureData>;
  signerName: string;
  pageScales: Map<number, { scaleX: number; scaleY: number; pageWidth: number; pageHeight: number }>;
}

/**
 * Convert a dataURL to a Uint8Array
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Detect if a dataURL is PNG or JPEG
 */
function getImageType(dataUrl: string): 'png' | 'jpg' {
  if (dataUrl.startsWith('data:image/png')) return 'png';
  return 'jpg';
}

/**
 * Embed signatures and fields into a PDF file
 */
export async function embedSignatures(options: EmbedSignaturesOptions): Promise<Uint8Array> {
  const { file, placedFields, signatures, signerName, pageScales } = options;

  if (placedFields.length === 0) {
    throw new Error('No signature fields have been placed on the document.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Group fields by page
  const fieldsByPage = new Map<number, PlacedField[]>();
  for (const field of placedFields) {
    const existing = fieldsByPage.get(field.pageNumber) || [];
    existing.push(field);
    fieldsByPage.set(field.pageNumber, existing);
  }

  // Embed signature images (deduplicate by signatureId)
  const embeddedImages = new Map<string, Awaited<ReturnType<typeof pdfDoc.embedPng>>>();
  for (const field of placedFields) {
    if (field.signatureId && !embeddedImages.has(field.signatureId)) {
      const sigData = signatures.get(field.signatureId);
      if (sigData) {
        const imgBytes = dataUrlToUint8Array(sigData.dataUrl);
        const imgType = getImageType(sigData.dataUrl);
        const embedded = imgType === 'png'
          ? await pdfDoc.embedPng(imgBytes)
          : await pdfDoc.embedJpg(imgBytes);
        embeddedImages.set(field.signatureId, embedded);
      }
    }
  }

  // Process each page
  for (const [pageNum, fields] of fieldsByPage) {
    const pageIndex = pageNum - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width: pdfWidth, height: pdfHeight } = page.getSize();

    // Get the scale info for this page
    const scaleInfo = pageScales.get(pageNum);
    const scaleX = scaleInfo ? scaleInfo.scaleX : 1;
    const scaleY = scaleInfo ? scaleInfo.scaleY : 1;

    for (const field of fields) {
      // Convert canvas coordinates to PDF coordinates
      // Canvas: origin top-left, Y goes down
      // PDF: origin bottom-left, Y goes up
      const pdfX = field.x / scaleX;
      const pdfFieldWidth = field.width / scaleX;
      const pdfFieldHeight = field.height / scaleY;
      const pdfY = pdfHeight - (field.y / scaleY) - pdfFieldHeight;

      if (field.type === 'signature' || field.type === 'initials') {
        // Draw signature/initials image
        if (field.signatureId && embeddedImages.has(field.signatureId)) {
          const img = embeddedImages.get(field.signatureId)!;
          page.drawImage(img, {
            x: pdfX,
            y: pdfY,
            width: pdfFieldWidth,
            height: pdfFieldHeight,
          });
        }
      } else if (field.type === 'name') {
        // Draw signer name as text
        const fontSize = Math.min(pdfFieldHeight * 0.6, 16);
        page.drawText(signerName, {
          x: pdfX + 4,
          y: pdfY + (pdfFieldHeight - fontSize) / 2,
          size: fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      } else if (field.type === 'date') {
        // Draw current date as text
        const dateStr = new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const fontSize = Math.min(pdfFieldHeight * 0.6, 14);
        page.drawText(dateStr, {
          x: pdfX + 4,
          y: pdfY + (pdfFieldHeight - fontSize) / 2,
          size: fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }
    }
  }

  return pdfDoc.save();
}
