/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Remove background from an image using canvas manipulation
 * This is a client-side implementation using color threshold detection
 */
export const removeBackground = async (file: File, threshold: number = 30): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            reject(new Error('Please select a valid image file'));
            return;
        }

        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
        }

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Sample edge pixels to determine background color (more robust)
            const samplePoints = [];
            const edgeWidth = Math.min(20, Math.floor(canvas.width * 0.05));
            const edgeHeight = Math.min(20, Math.floor(canvas.height * 0.05));

            // Sample top and bottom edges
            for (let x = 0; x < canvas.width; x += Math.floor(canvas.width / 20)) {
                samplePoints.push({ x, y: 0 });
                samplePoints.push({ x, y: canvas.height - 1 });
            }

            // Sample left and right edges
            for (let y = 0; y < canvas.height; y += Math.floor(canvas.height / 20)) {
                samplePoints.push({ x: 0, y });
                samplePoints.push({ x: canvas.width - 1, y });
            }

            // Calculate average background color
            let bgR = 0, bgG = 0, bgB = 0;
            samplePoints.forEach(point => {
                const i = (point.y * canvas.width + point.x) * 4;
                bgR += data[i];
                bgG += data[i + 1];
                bgB += data[i + 2];
            });
            bgR /= samplePoints.length;
            bgG /= samplePoints.length;
            bgB /= samplePoints.length;

            // Remove background by making similar colors transparent
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Calculate color difference using Euclidean distance
                const diff = Math.sqrt(
                    Math.pow(r - bgR, 2) +
                    Math.pow(g - bgG, 2) +
                    Math.pow(b - bgB, 2)
                );

                // Apply transparency based on threshold
                if (diff < threshold) {
                    data[i + 3] = 0; // Fully transparent
                } else if (diff < threshold * 1.5) {
                    // Feather edges for smoother result
                    const alpha = ((diff - threshold) / (threshold * 0.5)) * 255;
                    data[i + 3] = Math.min(255, alpha);
                }
            }

            ctx.putImageData(imageData, 0, 0);

            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to create blob'));
                }
            }, 'image/png');
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
};

/**
 * Convert image to PNG format
 */
export const convertToPNG = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            reject(new Error('Please select a valid image file'));
            return;
        }

        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
        }

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to create PNG blob'));
                }
            }, 'image/png');
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
};

/**
 * Convert image to JPG format
 */
export const convertToJPG = async (file: File, quality: number = 0.92): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            reject(new Error('Please select a valid image file'));
            return;
        }

        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
        }

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;

            // Fill white background for JPG (no transparency)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to create JPG blob'));
                }
            }, 'image/jpeg', quality);
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
};

/**
 * Convert HEIC to JPG
 * HEIC files are handled by the browser's image decoder if supported
 * Falls back to standard conversion which works in most modern browsers
 */
export const convertHEICToJPG = async (file: File, quality: number = 0.92): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
        try {
            // Try direct conversion first (works in Safari and newer Chrome)
            const blob = await convertToJPG(file, quality);
            resolve(blob);
        } catch (error) {
            // If direct conversion fails, provide helpful error
            reject(new Error('HEIC format not supported by your browser. Please use Safari or convert the file using another method first.'));
        }
    });
};

/**
 * Download a blob as a file
 */
export const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
