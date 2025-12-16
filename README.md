# Sola - Precision Conversion Suite

A production-ready, client-side file conversion application with 55+ professional tools. Built with React, TypeScript, and powered by Google Gemini AI for intelligent conversions.

## Features

### PDF Tools
- **PDF to Word** - Convert PDFs to editable Word files (OCR + Non-OCR modes)
- **Word to PDF** - Transform Word documents into stable PDFs
- **PDF Manipulation** - Merge, split, compress, rotate, encrypt, unlock PDFs
- **PDF to JPG** - Convert PDF pages to high-quality images
- **Image to PDF** - Combine multiple images into a single PDF

### Image Tools
- **Remove Background** - Extract subjects with adjustable sensitivity (edge-feathering algorithm)
- **JPG ↔ PNG** - Convert between JPG and PNG formats with quality control
- **HEIC to JPG** - Convert iPhone photos to standard JPG format
- **Image Compression** - Reduce file sizes while maintaining quality

### Text Tools
- **Audio to Text** - AI-powered transcription using Google Gemini
- **OCR** - Extract text from scanned documents and images
- **Text Analysis** - Summarization and caption generation

### Security
- **Encrypt PDF** - Password-protect your documents
- **Unlock PDF** - Remove passwords from PDFs
- All processing happens **client-side** (no server uploads for most tools)

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- Google Gemini API Key (for AI-powered features)

### Installation

1. **Clone and install dependencies:**
```bash
cd sola-pdf-converter
npm install
```

2. **Configure API Key:**
Create a `.env` file in the project root:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```
Get your API key from: https://aistudio.google.com/apikey

3. **Run development server:**
```bash
npm run dev
```
The app will be available at `http://localhost:3000`

4. **Build for production:**
```bash
npm run build
npm run preview
```

## Production-Level Features

### Error Handling
- ✅ Comprehensive error messages for all operations
- ✅ File validation (type, size, format)
- ✅ Network error recovery
- ✅ API quota limit handling
- ✅ Encrypted PDF detection

### Memory Management
- ✅ Automatic blob URL cleanup
- ✅ Canvas memory optimization
- ✅ useEffect cleanup hooks
- ✅ No memory leaks

### File Size Limits
- Images: 10MB max
- PDFs: 50MB max
- Audio/API files: 20MB max

### User Experience
- Real-time progress tracking
- Loading states with progress bars
- Before/after previews
- Drag-and-drop support
- Mobile-responsive design
- Smooth animations

## Technology Stack

**Frontend:**
- React 19.2.0
- TypeScript 5.8.2
- Vite 6.2.0

**PDF Processing:**
- pdf-lib 1.17.1 (PDF creation/manipulation)
- pdfjs-dist 5.4.449 (PDF rendering/text extraction)

**Document Conversion:**
- docx 9.5.1 (Word document creation)
- mammoth 1.11.0 (Word document parsing)

**OCR & AI:**
- tesseract.js 6.0.1 (Optical character recognition)
- @google/genai 1.29.0 (Google Gemini API)

## Architecture

```
sola-pdf-converter/
├── components/          # React UI components
│   ├── PDFToWord.tsx   # PDF to Word converter (OCR + Non-OCR)
│   ├── RemoveBackground.tsx
│   ├── ImageConverter.tsx
│   └── ProductDetail.tsx
├── services/           # Business logic
│   ├── pdfToWordService.ts
│   ├── imageService.ts
│   ├── geminiService.ts
│   └── pdfService.ts
├── constants.ts        # Tool definitions (55+ tools)
├── types.ts           # TypeScript interfaces
└── App.tsx            # Main router (SPA)
```

## Key Implementations

### PDF to Word (Both Modes)
- **Non-OCR Mode**: Fast extraction using PDF.js for digital PDFs
- **OCR Mode**: Tesseract.js for scanned documents
- Memory-efficient canvas cleanup
- Progress tracking with status updates

### Remove Background
- Enhanced edge-sampling algorithm
- Feathered transparency for smooth edges
- Adjustable sensitivity slider (10-100)
- No external APIs required

### Image Format Conversion
- Client-side canvas-based conversion
- Quality control for JPG compression
- Proper white background for JPG (no transparency)
- File size display

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (including HEIC)
- Mobile browsers: ✅ Responsive design

## Security

- No file uploads to external servers (except AI-powered features)
- All PDF/image processing happens in browser
- API keys stored in environment variables
- Password-protected PDF support

## Performance

- Build size: ~1.8MB (gzipped: ~548KB)
- First load: < 3s on 4G
- PDF processing: 2-5 seconds per page (OCR mode)
- Image conversion: < 1 second

## Troubleshooting

### "API Key missing" error
- Ensure `.env` file exists in project root
- Check that `GEMINI_API_KEY` is set correctly
- Restart the dev server after changing `.env`

### PDF conversion fails
- Check if PDF is password-protected (use Unlock PDF tool)
- Verify file size is under 50MB
- Try OCR mode if Non-OCR fails

### Image upload issues
- Ensure file is under 10MB
- Check file format is supported (JPG, PNG, HEIC)
- Clear browser cache if preview doesn't show

## License

Apache-2.0

## Credits

Built with ♥ by Gregorious Creative Studios
