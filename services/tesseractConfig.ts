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
        // Create worker - let tesseract.js v6 auto-resolve worker/core paths from the bundled package.
        // Language data is fetched from the tessdata CDN (version-independent).
        const worker = await createWorker(language, 1, {
            langPath: 'https://tessdata.projectnaptha.com/4.0.0',
            logger: (info: any) => {
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
