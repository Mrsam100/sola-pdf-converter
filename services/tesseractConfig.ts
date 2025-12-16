/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createWorker } from 'tesseract.js';

/**
 * Create a configured Tesseract worker with proper CDN paths
 * This ensures OCR works reliably by using the official CDN for language files
 */
export const createConfiguredWorker = async (language: string = 'eng') => {
    try {
        // Create worker with explicit CDN configuration
        const worker = await createWorker(language, 1, {
            // Use official Tesseract.js CDN for worker and language files
            workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
            langPath: 'https://tessdata.projectnaptha.com/4.0.0',
            corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
            logger: (info: any) => {
                // Log progress for debugging
                if (info.status === 'recognizing text') {
                    console.log(`OCR Progress: ${Math.round(info.progress * 100)}%`);
                }
            }
        });

        return worker;
    } catch (error) {
        console.error('Failed to create Tesseract worker:', error);
        throw new Error('Failed to initialize OCR engine. Please check your internet connection and try again.');
    }
};
