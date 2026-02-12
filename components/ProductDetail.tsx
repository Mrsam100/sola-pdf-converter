/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Tool } from '../types';
import MergePDF from './MergePDF';
import SplitPDF from './SplitPDF';
import CompressPDF from './CompressPDF';
import RotatePDF from './RotatePDF';
import PDFToJPG from './PDFToJPG';
import ImageToPDF from './ImageToPDF';
import PDFToWord from './PDFToWord';
import WordToPDF from './WordToPDF';
import EncryptPDF from './EncryptPDF';
import UnlockPDF from './UnlockPDF';
import EditPDF from './EditPDF';
import RemoveBackground from './RemoveBackground';
import ImageConverter from './ImageConverter';
import OCRToText from './OCRToText';
import AudioToText from './AudioToText';
import SignPDF from './SignPDF';
import PDFToExcel from './PDFToExcel';
import ExcelToPDF from './ExcelToPDF';
import PDFToPowerPoint from './PDFToPowerPoint';

interface ToolDetailProps {
  tool: Tool;
  onBack: () => void;
}

const ProductDetail: React.FC<ToolDetailProps> = ({ tool, onBack }) => {
  // Route to specialized PDF components
  if (tool.id === 'pdf-merge') {
    return <MergePDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'pdf-split') {
    return <SplitPDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'compress-pdf') {
    return <CompressPDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'rotate-pdf') {
    return <RotatePDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'pdf-jpg') {
    return <PDFToJPG tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'jpg-pdf') {
    return <ImageToPDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'pdf-word') {
    return <PDFToWord tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'word-pdf') {
    return <WordToPDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'encrypt-pdf') {
    return <EncryptPDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'unlock-pdf') {
    return <UnlockPDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'edit-pdf') {
    return <EditPDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'sign-pdf') {
    return <SignPDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'pdf-excel') {
    return <PDFToExcel tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'excel-pdf') {
    return <ExcelToPDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'pdf-ppt') {
    return <PDFToPowerPoint tool={tool} onBack={onBack} />;
  }

  // Route to OCR tool (client-side, no API key needed)
  if (tool.id === 'ocr-text') {
    return <OCRToText tool={tool} onBack={onBack} />;
  }

  // Route to Audio to Text (client-side, no API key needed)
  if (tool.id === 'audio-text') {
    return <AudioToText tool={tool} onBack={onBack} />;
  }

  // Route to image processing components
  if (tool.id === 'remove-bg') {
    return <RemoveBackground tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'jpg-png' || tool.id === 'png-jpg' || tool.id === 'heic-jpg') {
    return <ImageConverter tool={tool} onBack={onBack} />;
  }

  // Fallback for unknown tools
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Tool Not Found</h2>
      <p>The requested tool "{tool.name}" is not available.</p>
      <button onClick={onBack} style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>
        Go Back
      </button>
    </div>
  );
};

export default ProductDetail;
