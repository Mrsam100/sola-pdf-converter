/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tool, SignatureData, PlacedField } from '../types';
import { downloadPDF } from '../services/pdfService';
import { embedSignatures } from '../services/signPdfService';
import { toast } from '../hooks/useToast';
import BackButton from './BackButton';

interface SignPDFProps {
  tool: Tool;
  onBack: () => void;
}

type SignStep = 'upload' | 'mode' | 'details' | 'dashboard' | 'result';
type SignTab = 'signature' | 'initials' | 'stamp';
type CreationMethod = 'text' | 'draw' | 'upload';

const HANDWRITING_FONTS = [
  { name: 'Great Vibes', family: "'Great Vibes', cursive" },
  { name: 'Dancing Script', family: "'Dancing Script', cursive" },
  { name: 'Pacifico', family: "'Pacifico', cursive" },
  { name: 'Sacramento', family: "'Sacramento', cursive" },
];

const SIGNATURE_COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Red', value: '#d5232b' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Green', value: '#16a34a' },
];

const SignPDF: React.FC<SignPDFProps> = ({ tool, onBack }) => {
  // Flow state
  const [step, setStep] = useState<SignStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Signature creation
  const [signerName, setSignerName] = useState('');
  const [signerInitials, setSignerInitials] = useState('');
  const [activeTab, setActiveTab] = useState<SignTab>('signature');
  const [creationMethod, setCreationMethod] = useState<CreationMethod>('text');
  const [selectedFont, setSelectedFont] = useState(HANDWRITING_FONTS[0].family);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [signatures, setSignatures] = useState<Map<string, SignatureData>>(new Map());

  // Drawing state
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Dashboard state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const pdfDocRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const [placedFields, setPlacedFields] = useState<PlacedField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [signatureType, setSignatureType] = useState<'simple' | 'digital'>('simple');
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [pageScales, setPageScales] = useState<Map<number, { scaleX: number; scaleY: number; pageWidth: number; pageHeight: number }>>(new Map());

  // Drag state
  const [dragType, setDragType] = useState<PlacedField['type'] | null>(null);
  const [movingFieldId, setMovingFieldId] = useState<string | null>(null);
  const [moveOffset, setMoveOffset] = useState({ x: 0, y: 0 });
  const [resizingFieldId, setResizingFieldId] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0, fx: 0, fy: 0 });

  // Undo/redo
  const [history, setHistory] = useState<PlacedField[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Export
  const [saving, setSaving] = useState(false);
  const [resultBlob, setResultBlob] = useState<Uint8Array | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const renderCanvasRef = useRef<HTMLCanvasElement>(null);

  // Thumbnail refs
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());

  // ============ UPLOAD SCREEN ============

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (!f.type.includes('pdf') && !f.name.toLowerCase().endsWith('.pdf')) {
        setErrorMsg('Please select a PDF file.');
        return;
      }
      if (f.size > 50 * 1024 * 1024) {
        setErrorMsg('File is too large. Maximum size is 50MB.');
        return;
      }
      setFile(f);
      setFileName(f.name);
      setErrorMsg('');
      setStep('mode');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files[0];
    if (f) {
      if (!f.type.includes('pdf') && !f.name.toLowerCase().endsWith('.pdf')) {
        setErrorMsg('Please select a PDF file.');
        return;
      }
      setFile(f);
      setFileName(f.name);
      setErrorMsg('');
      setStep('mode');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // ============ MODE SELECTION ============

  const handleModeSelect = () => {
    setStep('details');
  };

  // ============ SIGNATURE DETAILS ============

  const initDrawCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = selectedColor;
  }, [selectedColor]);

  useEffect(() => {
    if (step === 'details' && creationMethod === 'draw') {
      setTimeout(initDrawCanvas, 100);
    }
  }, [step, creationMethod, initDrawCanvas]);

  const handleDrawStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);

    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.strokeStyle = selectedColor;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;
    if ('touches' in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleDrawEnd = () => {
    setIsDrawing(false);
  };

  const clearDrawCanvas = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (!f.type.startsWith('image/')) {
        toast.error('Please select an image file (PNG, JPG)');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setUploadedImage(ev.target?.result as string);
      };
      reader.readAsDataURL(f);
    }
  };

  const renderSignatureToDataUrl = useCallback((text: string, font: string, color: string): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const fontSize = 48;
    ctx.font = `${fontSize}px ${font}`;
    const metrics = ctx.measureText(text);
    const width = Math.ceil(metrics.width) + 20;
    const height = fontSize + 30;
    canvas.width = width * 2;
    canvas.height = height * 2;
    ctx.scale(2, 2);
    ctx.font = `${fontSize}px ${font}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 10, height / 2);
    return canvas.toDataURL('image/png');
  }, []);

  const handleApplySignature = () => {
    if (!signerName.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    const newSignatures = new Map(signatures);

    if (creationMethod === 'text') {
      // Render signature from text
      const sigText = activeTab === 'initials' ? signerInitials || signerName.split(' ').map(n => n[0]).join('') : signerName;
      const dataUrl = renderSignatureToDataUrl(sigText, selectedFont, selectedColor);
      const sigId = `sig-${activeTab}-text-${Date.now()}`;
      newSignatures.set(sigId, {
        id: sigId,
        type: activeTab === 'stamp' ? 'stamp' : activeTab,
        dataUrl,
        method: 'text',
        fontFamily: selectedFont,
        color: selectedColor,
      });

      // Also generate initials if on signature tab
      if (activeTab === 'signature') {
        const initText = signerInitials || signerName.split(' ').map(n => n[0]).join('');
        const initDataUrl = renderSignatureToDataUrl(initText, selectedFont, selectedColor);
        const initId = `sig-initials-text-${Date.now()}`;
        newSignatures.set(initId, {
          id: initId,
          type: 'initials',
          dataUrl: initDataUrl,
          method: 'text',
          fontFamily: selectedFont,
          color: selectedColor,
        });
      }
    } else if (creationMethod === 'draw') {
      const canvas = drawCanvasRef.current;
      if (!canvas || !hasDrawn) {
        toast.error('Please draw your signature');
        return;
      }
      const dataUrl = canvas.toDataURL('image/png');
      const sigId = `sig-${activeTab}-draw-${Date.now()}`;
      newSignatures.set(sigId, {
        id: sigId,
        type: activeTab === 'stamp' ? 'stamp' : activeTab,
        dataUrl,
        method: 'draw',
      });
    } else if (creationMethod === 'upload') {
      if (!uploadedImage) {
        toast.error('Please upload a signature image');
        return;
      }
      const sigId = `sig-${activeTab}-upload-${Date.now()}`;
      newSignatures.set(sigId, {
        id: sigId,
        type: activeTab === 'stamp' ? 'stamp' : activeTab,
        dataUrl: uploadedImage,
        method: 'upload',
      });
    }

    setSignatures(newSignatures);
    setStep('dashboard');
  };

  // ============ PDF RENDERING ============

  const loadPdf = useCallback(async () => {
    if (!file) return;
    try {
      const { pdfjsLib } = await import('../services/pdfConfig');
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      pdfDocRef.current = pdf;
      setTotalPages(pdf.numPages);
      setCurrentPage(1);

      // Generate thumbnails
      const thumbs = new Map<number, string>();
      for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        thumbs.set(i, canvas.toDataURL());
      }
      setThumbnails(thumbs);
    } catch {
      toast.error('Failed to load PDF. The file may be corrupted.');
    }
  }, [file]);

  useEffect(() => {
    if (step === 'dashboard' && file) {
      loadPdf();
    }
  }, [step, file, loadPdf]);

  const renderPage = useCallback(async (pageNum: number) => {
    const pdf = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas) return;

    try {
      const page = await pdf.getPage(pageNum);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setCanvasSize({ width: viewport.width, height: viewport.height });

      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Store scale for coordinate conversion
      const { width: pdfWidth, height: pdfHeight } = page.getViewport({ scale: 1 });
      setPageScales(prev => {
        const next = new Map(prev);
        next.set(pageNum, {
          scaleX: viewport.width / pdfWidth,
          scaleY: viewport.height / pdfHeight,
          pageWidth: pdfWidth,
          pageHeight: pdfHeight,
        });
        return next;
      });
    } catch {
      toast.error('Failed to render page.');
    }
  }, []);

  useEffect(() => {
    if (step === 'dashboard' && pdfDocRef.current && currentPage > 0) {
      renderPage(currentPage);
    }
  }, [step, currentPage, renderPage]);

  // ============ FIELD PLACEMENT ============

  const pushHistory = useCallback((newFields: PlacedField[]) => {
    setHistory(prev => {
      const truncated = prev.slice(0, historyIndex + 1);
      const next = [...truncated, [...newFields]];
      if (next.length > 30) next.shift();
      return next;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 29));
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setPlacedFields([...history[newIndex]]);
      setSelectedFieldId(null);
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setPlacedFields([...history[newIndex]]);
      setSelectedFieldId(null);
    }
  }, [historyIndex, history]);

  // Keyboard shortcuts
  useEffect(() => {
    if (step !== 'dashboard') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFieldId) {
        e.preventDefault();
        const newFields = placedFields.filter(f => f.id !== selectedFieldId);
        setPlacedFields(newFields);
        pushHistory(newFields);
        setSelectedFieldId(null);
      } else if (e.key === 'Escape') {
        setSelectedFieldId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, handleUndo, handleRedo, selectedFieldId, placedFields, pushHistory]);

  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!dragType) return;

    const wrapper = e.currentTarget;
    const rect = wrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const defaultWidth = dragType === 'date' || dragType === 'name' ? 200 : 180;
    const defaultHeight = 50;

    // Find signature ID for this field type
    let signatureId: string | undefined;
    if (dragType === 'signature' || dragType === 'initials') {
      const sigType = dragType;
      for (const [id, sig] of signatures) {
        if (sig.type === sigType) {
          signatureId = id;
          break;
        }
      }
    }

    const newField: PlacedField = {
      id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: dragType,
      pageNumber: currentPage,
      x: Math.max(0, x - defaultWidth / 2),
      y: Math.max(0, y - defaultHeight / 2),
      width: defaultWidth,
      height: defaultHeight,
      signatureId,
    };

    const newFields = [...placedFields, newField];
    setPlacedFields(newFields);
    pushHistory(newFields);
    setSelectedFieldId(newField.id);
    setDragType(null);
  };

  const handleCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleFieldMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    setSelectedFieldId(fieldId);

    const field = placedFields.find(f => f.id === fieldId);
    if (!field) return;

    const wrapper = canvasRef.current?.parentElement;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();

    setMovingFieldId(fieldId);
    setMoveOffset({
      x: e.clientX - rect.left - field.x,
      y: e.clientY - rect.top - field.y,
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, fieldId: string, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    const field = placedFields.find(f => f.id === fieldId);
    if (!field) return;

    setResizingFieldId(fieldId);
    setResizeHandle(handle);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      w: field.width,
      h: field.height,
      fx: field.x,
      fy: field.y,
    });
  };

  useEffect(() => {
    if (!movingFieldId && !resizingFieldId) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (movingFieldId) {
        const wrapper = canvasRef.current?.parentElement;
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        const x = e.clientX - rect.left - moveOffset.x;
        const y = e.clientY - rect.top - moveOffset.y;

        setPlacedFields(prev => prev.map(f =>
          f.id === movingFieldId
            ? { ...f, x: Math.max(0, Math.min(x, canvasSize.width - f.width)), y: Math.max(0, Math.min(y, canvasSize.height - f.height)) }
            : f
        ));
      }

      if (resizingFieldId && resizeHandle) {
        const dx = e.clientX - resizeStart.x;
        const dy = e.clientY - resizeStart.y;

        setPlacedFields(prev => prev.map(f => {
          if (f.id !== resizingFieldId) return f;
          let newX = resizeStart.fx;
          let newY = resizeStart.fy;
          let newW = resizeStart.w;
          let newH = resizeStart.h;

          if (resizeHandle.includes('e')) newW = Math.max(60, resizeStart.w + dx);
          if (resizeHandle.includes('w')) { newW = Math.max(60, resizeStart.w - dx); newX = resizeStart.fx + dx; }
          if (resizeHandle.includes('s')) newH = Math.max(30, resizeStart.h + dy);
          if (resizeHandle.includes('n')) { newH = Math.max(30, resizeStart.h - dy); newY = resizeStart.fy + dy; }

          return { ...f, x: newX, y: newY, width: newW, height: newH };
        }));
      }
    };

    const handleMouseUp = () => {
      if (movingFieldId || resizingFieldId) {
        pushHistory([...placedFields]);
      }
      setMovingFieldId(null);
      setResizingFieldId(null);
      setResizeHandle(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [movingFieldId, resizingFieldId, resizeHandle, moveOffset, resizeStart, canvasSize, placedFields, pushHistory]);

  const handleDeleteField = (fieldId: string) => {
    const newFields = placedFields.filter(f => f.id !== fieldId);
    setPlacedFields(newFields);
    pushHistory(newFields);
    setSelectedFieldId(null);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || e.target === canvasRef.current?.parentElement) {
      setSelectedFieldId(null);
    }
  };

  // ============ EXPORT ============

  const handleSign = async () => {
    if (!file || placedFields.length === 0) {
      toast.error('Please place at least one signature field on the document.');
      return;
    }

    setSaving(true);
    try {
      const result = await embedSignatures({
        file,
        placedFields,
        signatures,
        signerName,
        pageScales,
      });
      setResultBlob(result);
      const outputName = fileName.replace('.pdf', '_signed.pdf');
      downloadPDF(result, outputName);
      toast.success('PDF signed successfully!');
      setStep('result');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sign PDF');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setFileName('');
    setSignerName('');
    setSignerInitials('');
    setSignatures(new Map());
    setPlacedFields([]);
    setHistory([[]]);
    setHistoryIndex(0);
    setResultBlob(null);
    setSelectedFieldId(null);
    setThumbnails(new Map());
    setErrorMsg('');
  };

  const handleDownloadAgain = () => {
    if (resultBlob) {
      const outputName = fileName.replace('.pdf', '_signed.pdf');
      downloadPDF(resultBlob, outputName);
    }
  };

  // ============ FIELD TYPE LABELS & ICONS ============

  const getFieldLabel = (type: PlacedField['type']): string => {
    switch (type) {
      case 'signature': return 'Signature';
      case 'initials': return 'Initials';
      case 'name': return 'Name';
      case 'date': return 'Date';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // ============ RENDER: UPLOAD SCREEN ============

  if (step === 'upload') {
    return (
      <div className="detail-view animate-fade-in">
        <div className="container">
          <BackButton onBack={onBack} />
          <div className="workspace-card">
            <div className="workspace-header">
              <div className="workspace-icon-large">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg">
                  <path strokeLinecap="round" strokeLinejoin="round" d={tool.icon} />
                </svg>
              </div>
              <h1 className="workspace-title">{tool.name}</h1>
              <p className="workspace-desc">{tool.description}</p>
            </div>
            <div className="workspace-body">
              {errorMsg && <div className="error-msg">{errorMsg}</div>}
              <div
                className="upload-zone"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <div className="upload-icon-wrapper">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <span style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Select PDF file to sign
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                  or drag and drop
                </span>
              </div>
            </div>
            <div className="workspace-footer">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-sm">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              All processing happens in your browser. Your files never leave your device.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ RENDER: MODE SELECTION ============

  if (step === 'mode') {
    return (
      <div className="detail-view animate-fade-in">
        <div className="container">
          <BackButton onBack={() => setStep('upload')} />
          <div className="workspace-card">
            <div className="workspace-header">
              <h1 className="workspace-title" style={{ fontSize: '1.75rem' }}>Who will sign this document?</h1>
              <p className="workspace-desc" style={{ marginTop: '0.5rem' }}>
                {fileName} ({file ? formatFileSize(file.size) : ''})
              </p>
            </div>
            <div className="workspace-body">
              <div className="sign-mode-cards">
                {/* Only Me Card */}
                <div className="sign-mode-card" onClick={handleModeSelect}>
                  <div className="sign-mode-illustration">
                    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="25" y="10" width="70" height="80" rx="4" fill="var(--surface-alt)" stroke="var(--border-color)" strokeWidth="1.5"/>
                      <line x1="40" y1="30" x2="80" y2="30" stroke="var(--text-tertiary)" strokeWidth="1.5"/>
                      <line x1="40" y1="40" x2="75" y2="40" stroke="var(--text-tertiary)" strokeWidth="1.5"/>
                      <line x1="40" y1="50" x2="70" y2="50" stroke="var(--text-tertiary)" strokeWidth="1.5"/>
                      <path d="M45 68 C50 60, 55 75, 65 62 C68 58, 72 65, 78 60" stroke="var(--accent)" strokeWidth="2" fill="none" strokeLinecap="round"/>
                      <circle cx="95" cy="80" r="12" fill="var(--accent)" opacity="0.1"/>
                      <path d="M91 80 L93.5 82.5 L99 77" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <h3 className="sign-mode-title">Only Me</h3>
                  <p className="sign-mode-desc">Sign the document yourself with your personal signature.</p>
                  <button className="sign-mode-card-btn" onClick={handleModeSelect}>
                    Continue
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 16, height: 16 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                </div>

                {/* Several People Card */}
                <div className="sign-mode-card" onClick={handleModeSelect}>
                  <div className="sign-mode-illustration">
                    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="25" y="10" width="70" height="80" rx="4" fill="var(--surface-alt)" stroke="var(--border-color)" strokeWidth="1.5"/>
                      <line x1="40" y1="30" x2="80" y2="30" stroke="var(--text-tertiary)" strokeWidth="1.5"/>
                      <line x1="40" y1="40" x2="75" y2="40" stroke="var(--text-tertiary)" strokeWidth="1.5"/>
                      <path d="M40 55 C44 48, 48 60, 55 50" stroke="#2563eb" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                      <path d="M40 72 C44 65, 48 77, 55 67" stroke="var(--accent)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                      <circle cx="16" cy="50" r="8" fill="#2563eb" opacity="0.15"/>
                      <circle cx="16" cy="47" r="3" fill="#2563eb" opacity="0.4"/>
                      <path d="M11 55 C11 52, 14 50, 16 50 C18 50, 21 52, 21 55" fill="#2563eb" opacity="0.4"/>
                      <circle cx="104" cy="50" r="8" fill="var(--accent)" opacity="0.15"/>
                      <circle cx="104" cy="47" r="3" fill="var(--accent)" opacity="0.4"/>
                      <path d="M99 55 C99 52, 102 50, 104 50 C106 50, 109 52, 109 55" fill="var(--accent)" opacity="0.4"/>
                    </svg>
                  </div>
                  <h3 className="sign-mode-title">Several people</h3>
                  <p className="sign-mode-desc">Send the document to multiple signers for their signatures.</p>
                  <button className="sign-mode-card-btn" onClick={handleModeSelect}>
                    Continue
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 16, height: 16 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ RENDER: SIGNATURE DETAILS ============

  if (step === 'details') {
    const previewText = activeTab === 'initials'
      ? (signerInitials || signerName.split(' ').map(n => n[0]).join(''))
      : signerName || 'Your Name';

    return (
      <div className="detail-view animate-fade-in">
        <div className="container">
          <BackButton onBack={() => setStep('mode')} />
          <div className="workspace-card">
            <div className="workspace-header" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 className="workspace-title" style={{ fontSize: '1.5rem' }}>Set your signature details</h1>
              <button
                onClick={() => setStep('mode')}
                style={{ background: 'none', border: 'none', padding: '0.5rem', cursor: 'pointer', color: 'var(--text-tertiary)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 20, height: 20 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="workspace-body" style={{ padding: '1.5rem' }}>
              {/* Name inputs */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 250px' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>Full name</label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={e => {
                      setSignerName(e.target.value);
                      if (!signerInitials) {
                        // Auto-generate initials
                      }
                    }}
                    placeholder="John Smith"
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.75rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.9375rem',
                      background: 'var(--surface-white)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <div style={{ flex: '0 0 120px' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>Initials</label>
                  <input
                    type="text"
                    value={signerInitials}
                    onChange={e => setSignerInitials(e.target.value)}
                    placeholder={signerName ? signerName.split(' ').map(n => n[0]).join('') : 'JS'}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.75rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.9375rem',
                      background: 'var(--surface-white)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>

              {/* Tabs: Signature | Initials | Company Stamp */}
              <div className="sign-tabs">
                {(['signature', 'initials', 'stamp'] as SignTab[]).map(tab => (
                  <button
                    key={tab}
                    className={`sign-tab ${activeTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'signature' ? 'Signature' : tab === 'initials' ? 'Initials' : 'Company Stamp'}
                  </button>
                ))}
              </div>

              {/* Main creation area */}
              <div className="sign-creation-area">
                {/* Left: Method sidebar */}
                <div className="sign-method-sidebar">
                  <button
                    className={`sign-method-btn ${creationMethod === 'text' ? 'active' : ''}`}
                    onClick={() => setCreationMethod('text')}
                    title="Type signature"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 20, height: 20 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                    <span>Text</span>
                  </button>
                  <button
                    className={`sign-method-btn ${creationMethod === 'draw' ? 'active' : ''}`}
                    onClick={() => setCreationMethod('draw')}
                    title="Draw signature"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 20, height: 20 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                    </svg>
                    <span>Draw</span>
                  </button>
                  <button
                    className={`sign-method-btn ${creationMethod === 'upload' ? 'active' : ''}`}
                    onClick={() => setCreationMethod('upload')}
                    title="Upload signature"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 20, height: 20 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span>Upload</span>
                  </button>
                </div>

                {/* Right: Content area */}
                <div className="sign-creation-content">
                  {creationMethod === 'text' && (
                    <>
                      {/* Preview */}
                      <div className="sign-preview">
                        <span style={{ fontFamily: selectedFont, fontSize: '2rem', color: selectedColor, lineHeight: 1.4 }}>
                          {previewText}
                        </span>
                      </div>

                      {/* Font selection */}
                      <div className="sign-font-list">
                        {HANDWRITING_FONTS.map(font => (
                          <label key={font.name} className="sign-font-option">
                            <input
                              type="radio"
                              name="signFont"
                              checked={selectedFont === font.family}
                              onChange={() => setSelectedFont(font.family)}
                            />
                            <span style={{ fontFamily: font.family, fontSize: '1.25rem', color: selectedColor }}>
                              {previewText}
                            </span>
                            <span className="sign-font-name">{font.name}</span>
                          </label>
                        ))}
                      </div>

                      {/* Color picker */}
                      <div style={{ marginTop: '1rem' }}>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                          Signature color
                        </label>
                        <div className="sign-color-picker">
                          {SIGNATURE_COLORS.map(color => (
                            <button
                              key={color.value}
                              className={`sign-color-dot ${selectedColor === color.value ? 'active' : ''}`}
                              style={{ backgroundColor: color.value }}
                              onClick={() => setSelectedColor(color.value)}
                              title={color.name}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {creationMethod === 'draw' && (
                    <>
                      <div className="sign-preview" style={{ padding: 0, overflow: 'hidden' }}>
                        <canvas
                          ref={drawCanvasRef}
                          className="sign-canvas-draw"
                          onMouseDown={handleDrawStart}
                          onMouseMove={handleDrawMove}
                          onMouseUp={handleDrawEnd}
                          onMouseLeave={handleDrawEnd}
                          onTouchStart={handleDrawStart}
                          onTouchMove={handleDrawMove}
                          onTouchEnd={handleDrawEnd}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                        <div className="sign-color-picker">
                          {SIGNATURE_COLORS.map(color => (
                            <button
                              key={color.value}
                              className={`sign-color-dot ${selectedColor === color.value ? 'active' : ''}`}
                              style={{ backgroundColor: color.value }}
                              onClick={() => setSelectedColor(color.value)}
                              title={color.name}
                            />
                          ))}
                        </div>
                        <button
                          onClick={clearDrawCanvas}
                          style={{
                            padding: '0.375rem 0.75rem',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--surface-white)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.8125rem',
                            cursor: 'pointer',
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    </>
                  )}

                  {creationMethod === 'upload' && (
                    <>
                      {uploadedImage ? (
                        <div className="sign-preview">
                          <img src={uploadedImage} alt="Signature" style={{ maxWidth: '100%', maxHeight: '100px', objectFit: 'contain' }} />
                        </div>
                      ) : (
                        <div
                          className="sign-preview"
                          style={{ cursor: 'pointer', flexDirection: 'column', gap: '0.5rem' }}
                          onClick={() => imageInputRef.current?.click()}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="var(--text-tertiary)" style={{ width: 32, height: 32 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Click to upload signature image</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        ref={imageInputRef}
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                      />
                      {uploadedImage && (
                        <button
                          onClick={() => { setUploadedImage(null); imageInputRef.current?.click(); }}
                          style={{
                            marginTop: '0.75rem',
                            padding: '0.375rem 0.75rem',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--surface-white)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.8125rem',
                            cursor: 'pointer',
                          }}
                        >
                          Change image
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Apply button */}
              <button className="sign-apply-btn" onClick={handleApplySignature}>
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ RENDER: DASHBOARD ============

  if (step === 'dashboard') {
    const currentPageFields = placedFields.filter(f => f.pageNumber === currentPage);

    return (
      <div className="pdf-editor">
        {/* Header */}
        <div className="editor-header">
          <div className="editor-header-left">
            <button
              className="editor-btn"
              onClick={() => setStep('details')}
              title="Back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 16, height: 16 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="editor-filename">{fileName}</span>
            <span className="editor-page-badge">
              Page {currentPage} of {totalPages}
            </span>
          </div>
          <div className="editor-header-right">
            <button
              className="editor-btn"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title="Undo (Ctrl+Z)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 16, height: 16 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
            </button>
            <button
              className="editor-btn"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Redo (Ctrl+Y)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 16, height: 16 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
              </svg>
            </button>
            <button
              className="editor-btn editor-btn-save"
              onClick={handleSign}
              disabled={saving || placedFields.length === 0}
            >
              {saving && <span className="editor-spinner" />}
              Sign this PDF
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 14, height: 14 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body: sidebar | canvas | panel */}
        <div className="editor-body">
          {/* Page sidebar */}
          <div className="page-sidebar">
            <div className="page-sidebar-header">Pages</div>
            <div className="page-sidebar-list">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <div
                  key={pageNum}
                  className={`page-thumb ${currentPage === pageNum ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  <div className="page-thumb-inner">
                    {thumbnails.has(pageNum) ? (
                      <img
                        src={thumbnails.get(pageNum)}
                        alt={`Page ${pageNum}`}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      pageNum
                    )}
                  </div>
                  <span className="page-thumb-label">{pageNum}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Canvas area */}
          <div className="canvas-area" ref={canvasAreaRef} onClick={handleCanvasClick}>
            <div
              className="canvas-wrapper"
              onDrop={handleCanvasDrop}
              onDragOver={handleCanvasDragOver}
              style={{ position: 'relative' }}
            >
              <canvas ref={canvasRef} className="editor-canvas" />

              {/* Placed fields overlay */}
              {currentPageFields.map(field => {
                const isSelected = selectedFieldId === field.id;
                const sigData = field.signatureId ? signatures.get(field.signatureId) : null;

                return (
                  <div
                    key={field.id}
                    className={`placed-field ${isSelected ? 'selected' : ''}`}
                    style={{
                      left: field.x,
                      top: field.y,
                      width: field.width,
                      height: field.height,
                    }}
                    onMouseDown={e => handleFieldMouseDown(e, field.id)}
                    onClick={e => { e.stopPropagation(); setSelectedFieldId(field.id); }}
                  >
                    {/* Field content */}
                    {(field.type === 'signature' || field.type === 'initials') && sigData ? (
                      <img
                        src={sigData.dataUrl}
                        alt={field.type}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                        draggable={false}
                      />
                    ) : (
                      <span className="placed-field-text">
                        {field.type === 'name' ? signerName : field.type === 'date' ? new Date().toLocaleDateString() : getFieldLabel(field.type)}
                      </span>
                    )}

                    {/* Label */}
                    <span className="placed-field-label">{getFieldLabel(field.type)}</span>

                    {/* Delete button */}
                    {isSelected && (
                      <button
                        className="placed-field-delete"
                        onClick={e => { e.stopPropagation(); handleDeleteField(field.id); }}
                        title="Delete"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 12, height: 12 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}

                    {/* Resize handles */}
                    {isSelected && (
                      <>
                        <div className="placed-field-handle nw" onMouseDown={e => handleResizeMouseDown(e, field.id, 'nw')} />
                        <div className="placed-field-handle ne" onMouseDown={e => handleResizeMouseDown(e, field.id, 'ne')} />
                        <div className="placed-field-handle sw" onMouseDown={e => handleResizeMouseDown(e, field.id, 'sw')} />
                        <div className="placed-field-handle se" onMouseDown={e => handleResizeMouseDown(e, field.id, 'se')} />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Signing panel (right sidebar) */}
          <div className="tool-panel sign-panel">
            {/* Signature type */}
            <div className="tool-panel-section">
              <div className="tool-panel-label">Type</div>
              <label className="sign-type-radio">
                <input
                  type="radio"
                  name="sigType"
                  checked={signatureType === 'simple'}
                  onChange={() => setSignatureType('simple')}
                />
                <span>Simple Signature</span>
              </label>
              <label className="sign-type-radio">
                <input
                  type="radio"
                  name="sigType"
                  checked={signatureType === 'digital'}
                  onChange={() => setSignatureType('digital')}
                />
                <span>Digital Signature</span>
              </label>
            </div>

            {/* Required fields */}
            <div className="tool-panel-section">
              <div className="tool-panel-label">Required fields</div>
              <div
                className="sign-field-item"
                draggable
                onDragStart={() => setDragType('signature')}
                onDragEnd={() => setDragType(null)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 18, height: 18, flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                <span>Signature</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="var(--text-tertiary)" style={{ width: 14, height: 14, marginLeft: 'auto' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                </svg>
              </div>
            </div>

            {/* Optional fields */}
            <div className="tool-panel-section">
              <div className="tool-panel-label">Optional fields</div>
              <div
                className="sign-field-item"
                draggable
                onDragStart={() => setDragType('initials')}
                onDragEnd={() => setDragType(null)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 18, height: 18, flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
                <span>Initials</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="var(--text-tertiary)" style={{ width: 14, height: 14, marginLeft: 'auto' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                </svg>
              </div>
              <div
                className="sign-field-item"
                draggable
                onDragStart={() => setDragType('name')}
                onDragEnd={() => setDragType(null)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 18, height: 18, flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                <span>Name</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="var(--text-tertiary)" style={{ width: 14, height: 14, marginLeft: 'auto' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                </svg>
              </div>
              <div
                className="sign-field-item"
                draggable
                onDragStart={() => setDragType('date')}
                onDragEnd={() => setDragType(null)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 18, height: 18, flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span>Date</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="var(--text-tertiary)" style={{ width: 14, height: 14, marginLeft: 'auto' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                </svg>
              </div>
            </div>

            {/* Placed fields count */}
            {placedFields.length > 0 && (
              <div className="tool-panel-section">
                <div className="tool-panel-label">Placed ({placedFields.length})</div>
                {placedFields.map(f => (
                  <div
                    key={f.id}
                    className={`sign-field-item ${selectedFieldId === f.id ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentPage(f.pageNumber);
                      setSelectedFieldId(f.id);
                    }}
                    style={{ cursor: 'pointer', fontSize: '0.8125rem' }}
                  >
                    <span>{getFieldLabel(f.type)}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>p.{f.pageNumber}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============ RENDER: RESULT SCREEN ============

  if (step === 'result') {
    return (
      <div className="detail-view animate-fade-in">
        <div className="container">
          <BackButton onBack={onBack} />
          <div className="workspace-card">
            <div className="workspace-header">
              <div className="success-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-lg">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h1 className="workspace-title" style={{ fontSize: '1.5rem' }}>Your PDF has been signed!</h1>
              <p className="workspace-desc" style={{ marginTop: '0.5rem' }}>
                {fileName.replace('.pdf', '_signed.pdf')} has been downloaded.
              </p>
            </div>
            <div className="workspace-body" style={{ textAlign: 'center' }}>
              <div className="action-row" style={{ justifyContent: 'center' }}>
                <button className="btn-action" onClick={handleDownloadAgain}>
                  Download Again
                </button>
                <button className="btn-secondary" onClick={handleReset}>
                  Sign Another PDF
                </button>
              </div>
            </div>
            <div className="workspace-footer">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-sm">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              All processing happens in your browser. Your files never leave your device.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default SignPDF;
