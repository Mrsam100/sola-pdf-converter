/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: 'PDF' | 'Image' | 'Text' | 'Security';
  icon: string; // SVG path
}

export type ViewState = 
  | { type: 'home' }
  | { type: 'dashboard' } // The grid view
  | { type: 'tool', tool: Tool };

export enum ProcessState {
  IDLE = 'idle',
  UPLOADING = 'uploading',
  CONVERTING = 'converting',
  COMPLETED = 'completed'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  imageUrl: string;
  features: string[];
}

export interface JournalArticle {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  image: string;
}

// ========================================
// Configuration Types for PDF Tools
// ========================================

export type PageSize = 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5' | 'Custom';
export type Orientation = 'portrait' | 'landscape';
export type MarginSize = 'none' | 'small' | 'medium' | 'large';
export type ImageQuality = 'original' | 'high' | 'medium' | 'low';
export type CompressionLevel = 'low' | 'medium' | 'high' | 'extreme';
export type ImageFormat = 'jpg' | 'png' | 'webp';
export type ColorSpace = 'rgb' | 'grayscale' | 'blackwhite';
export type DPI = 72 | 150 | 300 | 600;

export interface PageSizeDimensions {
  width: number;
  height: number;
}

export interface MarginDimensions {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Image to PDF Configuration
export interface ImageToPdfConfig {
  orientation: Orientation;
  pageSize: PageSize;
  customPageSize?: PageSizeDimensions;
  margin: MarginSize;
  customMargin?: MarginDimensions;
  quality: ImageQuality;
  imageOrder: string[]; // Array of file IDs for reordering
  fitToPage: boolean;
}

// PDF to Image Configuration
export interface PdfToImageConfig {
  format: ImageFormat;
  quality: number; // 0-1 for JPEG quality
  dpi: DPI;
  pageSelection: 'all' | 'current' | 'range';
  pageRange?: string; // e.g., "1-5,7,9-12"
  colorSpace: ColorSpace;
}

// Merge PDF Configuration
export interface MergePdfConfig {
  pageOrder: Array<{
    fileId: string;
    fileName: string;
    pageIndices: number[]; // Which pages to include from this file
  }>;
  removePages: string[]; // File IDs + page indices to exclude
}

// Split PDF Configuration
export interface SplitPdfConfig {
  mode: 'ranges' | 'extract' | 'every-n-pages';
  pageRanges?: string[]; // e.g., ["1-3", "5", "7-9"]
  extractPages?: number[]; // Specific pages to extract
  splitEvery?: number; // Split every N pages
  outputFormat: 'separate' | 'merged';
}

// Compress PDF Configuration
export interface CompressPdfConfig {
  compressionLevel: CompressionLevel;
  targetFileSize?: number; // In bytes (optional)
  qualityPercentage?: number; // 0-100 (optional)
  optimizeImages: boolean;
  removeMetadata: boolean;
}

// Rotate PDF Configuration
export interface RotatePdfConfig {
  rotation: 90 | 180 | 270;
  pageSelection: 'all' | 'specific';
  pageNumbers?: number[]; // 1-based page numbers
}

// Configuration state during conversion flow
export type ConversionStep = 'upload' | 'configure' | 'processing' | 'result';

export interface ConversionState {
  step: ConversionStep;
  tool: Tool;
  files: File[];
  config?: any; // Tool-specific config
  result?: Uint8Array | Array<{ data: Uint8Array; name: string }>;
  error?: string;
}

// Configuration defaults
export const DEFAULT_IMAGE_TO_PDF_CONFIG: ImageToPdfConfig = {
  orientation: 'portrait',
  pageSize: 'A4',
  margin: 'small',
  quality: 'high',
  imageOrder: [],
  fitToPage: true,
};

export const DEFAULT_PDF_TO_IMAGE_CONFIG: PdfToImageConfig = {
  format: 'jpg',
  quality: 0.92,
  dpi: 150,
  pageSelection: 'all',
  colorSpace: 'rgb',
};

export const DEFAULT_MERGE_PDF_CONFIG: MergePdfConfig = {
  pageOrder: [],
  removePages: [],
};

export const DEFAULT_SPLIT_PDF_CONFIG: SplitPdfConfig = {
  mode: 'ranges',
  outputFormat: 'separate',
};

export const DEFAULT_COMPRESS_PDF_CONFIG: CompressPdfConfig = {
  compressionLevel: 'medium',
  optimizeImages: true,
  removeMetadata: false,
};

export const DEFAULT_ROTATE_PDF_CONFIG: RotatePdfConfig = {
  rotation: 90,
  pageSelection: 'all',
};
