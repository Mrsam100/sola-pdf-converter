/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { Tool, Product, JournalArticle } from './types';

export const BRAND_NAME = 'Sola';
export const STUDIO_NAME = 'Gregorious Creative Studios';

export const TOOLS: Tool[] = [
  // PDF TOOLS
  {
    id: 'pdf-word',
    name: 'PDF to Word',
    description: 'Convert PDF documents to editable Word files.',
    category: 'PDF',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z'
  },
  {
    id: 'word-pdf',
    name: 'Word to PDF',
    description: 'Transform Word documents into stable PDFs.',
    category: 'PDF',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z'
  },
  {
    id: 'pdf-ppt',
    name: 'PDF to PowerPoint',
    description: 'Turn your PDFs into editable slides.',
    category: 'PDF',
    icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605'
  },
  {
    id: 'pdf-excel',
    name: 'PDF to Excel',
    description: 'Extract tables from PDF to Spreadsheets.',
    category: 'PDF',
    icon: 'M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m13.5 2.625v-1.5c0-.621.504-1.125 1.125-1.125m-12.75 0h7.5m-7.5 0v-9c0-.621.504-1.125 1.125-1.125h3.375c.621 0 1.125.504 1.125 1.125m-4.5 0h2.25m-2.25 0V3.75a1.125 1.125 0 011.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25'
  },
  {
    id: 'excel-pdf',
    name: 'Excel to PDF',
    description: 'Convert spreadsheets to PDF documents.',
    category: 'PDF',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z'
  },
  {
    id: 'pdf-merge',
    name: 'Merge PDF',
    description: 'Combine multiple PDFs into one.',
    category: 'PDF',
    icon: 'M12 4.5v15m7.5-7.5h-15'
  },
  {
    id: 'pdf-split',
    name: 'Split PDF',
    description: 'Extract pages from your PDF files.',
    category: 'PDF',
    icon: 'M8.25 4.5l7.5 7.5-7.5 7.5'
  },
  {
    id: 'compress-pdf',
    name: 'Compress PDF',
    description: 'Reduce file size while maintaining quality.',
    category: 'PDF',
    icon: 'M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25'
  },
  {
    id: 'rotate-pdf',
    name: 'Rotate PDF',
    description: 'Rotate PDF pages permanently.',
    category: 'PDF',
    icon: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99'
  },
  {
    id: 'ppt-pdf',
    name: 'PowerPoint to PDF',
    description: 'Convert presentations to document format.',
    category: 'PDF',
    icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605'
  },

  // SECURITY & OCR
  {
    id: 'unlock-pdf',
    name: 'Unlock PDF',
    description: 'Remove passwords from PDF files.',
    category: 'Security',
    icon: 'M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z'
  },
  {
    id: 'protect-pdf',
    name: 'Protect PDF',
    description: 'Encrypt your PDF with a password.',
    category: 'Security',
    icon: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z'
  },
  {
    id: 'ocr-text',
    name: 'OCR to Text',
    description: 'Extract text from scanned documents.',
    category: 'Text',
    icon: 'M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5M7.5 20.25H6A2.25 2.25 0 013.75 18v-1.5M15 12a3 3 0 11-6 0 3 3 0 016 0z'
  },
  {
    id: 'sign-pdf',
    name: 'Sign PDF',
    description: 'Add digital signatures to documents.',
    category: 'Security',
    icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10'
  },

  // IMAGE & AUDIO
  {
    id: 'jpg-pdf',
    name: 'Image to PDF',
    description: 'Convert images to a single PDF.',
    category: 'Image',
    icon: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z'
  },
  {
    id: 'remove-bg',
    name: 'Remove Background',
    description: 'Extract subjects from images automatically.',
    category: 'Image',
    icon: 'M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42'
  },
  {
    id: 'jpg-png',
    name: 'JPG to PNG',
    description: 'Convert to transparent supported format.',
    category: 'Image',
    icon: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z'
  },
  {
    id: 'png-jpg',
    name: 'PNG to JPG',
    description: 'Convert to standard compressed image.',
    category: 'Image',
    icon: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z'
  },
  {
    id: 'heic-jpg',
    name: 'HEIC to JPG',
    description: 'Convert iPhone photos to standard JPG.',
    category: 'Image',
    icon: 'M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3'
  },
  {
    id: 'audio-text',
    name: 'Audio to Text',
    description: 'Transcribe recordings instantly.',
    category: 'Text',
    icon: 'M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z'
  },
];

export const PRODUCTS: Product[] = [
    {
        id: 'aura-stone',
        name: 'Aura Stone',
        price: 120,
        description: 'A hand-carved sandstone sphere designed for tactile grounding and focus.',
        category: 'Objects',
        imageUrl: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&q=80&w=800',
        features: ['Natural Sandstone', 'Hand Polished', 'Unique Patina']
    },
    {
        id: 'aura-light',
        name: 'Aura Light',
        price: 250,
        description: 'A ambient light source that mimics the circadian rhythm of the sun.',
        category: 'Electronics',
        imageUrl: 'https://images.unsplash.com/photo-1513506003011-3b032f7f5e5c?auto=format&fit=crop&q=80&w=800',
        features: ['Warm LED', 'Automatic Dimming', 'No Blue Light']
    }
];

export const JOURNAL_ARTICLES: JournalArticle[] = [
    {
        id: 'silence',
        title: 'The Art of Silence',
        excerpt: 'In a world of constant noise, finding silence is an act of rebellion. We explore how minimal design can quiet the mind.',
        date: 'Oct 12, 2025',
        image: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=800',
        content: 'Content placeholder...'
    },
    {
        id: 'materials',
        title: 'Materials that Matter',
        excerpt: 'Why we choose sandstone, aluminum, and organic cotton. A deep dive into our sourcing philosophy.',
        date: 'Sep 28, 2025',
        image: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&q=80&w=800',
        content: 'Content placeholder...'
    }
];
