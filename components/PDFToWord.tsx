/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tool, ProcessState } from '../types';
import { pdfToWord, pdfToWordWithOCR, downloadWord, AbortSignal as AbortRef } from '../services/pdfToWordService';
import { useWakeLock, usePageVisibility } from '../hooks/usePageVisibility';
import { toast } from '../hooks/useToast';
import { formatFileSize } from '../utils/formatFileSize';
import BackButton from './BackButton';
import StepProgress from './StepProgress';

interface PDFToWordProps {
    tool: Tool;
    onBack: () => void;
}

type ConversionMode = 'non-ocr' | 'ocr';

const STEPS = [
    { label: 'Upload' },
    { label: 'Processing' },
    { label: 'Complete' },
];

const PDFToWord: React.FC<PDFToWordProps> = ({ tool, onBack }) => {
    const [state, setState] = useState<ProcessState>(ProcessState.IDLE);
    const [file, setFile] = useState<File | null>(null);
    const [mode, setMode] = useState<ConversionMode>('non-ocr');
    const [progress, setProgress] = useState<number>(0);
    const [progressStatus, setProgressStatus] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const [resultBlob, setResultBlob] = useState<Blob | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortRef>({ current: false });
    const mountedRef = useRef(true);

    // Prevent tab suspension during processing
    const isProcessing = state === ProcessState.CONVERTING;
    useWakeLock(isProcessing);
    usePageVisibility();

    // Cleanup on unmount — abort any in-progress conversion
    useEffect(() => {
        return () => {
            mountedRef.current = false;
            abortRef.current.current = true;
        };
    }, []);

    const currentStep = state === ProcessState.IDLE || state === ProcessState.UPLOADING
        ? (file ? 0 : -1)
        : state === ProcessState.CONVERTING ? 1 : 2;

    const validateAndSetFile = useCallback((selectedFile: File) => {
        if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
            setErrorMsg('Please select a valid PDF file');
            return;
        }

        // 🔒 VALIDATION FIX: Check for 0-byte files to prevent wasted processing
        if (selectedFile.size === 0) {
            setErrorMsg('The selected file is empty (0 bytes). Please select a valid PDF file.');
            return;
        }

        const maxSize = 150 * 1024 * 1024; // Increased from 50MB
        if (selectedFile.size > maxSize) {
            setErrorMsg('File is too large. Maximum size is 150MB');
            return;
        }

        setFile(selectedFile);
        setState(ProcessState.IDLE);
        setErrorMsg('');
        setProgress(0);
        setProgressStatus('');
        setResultBlob(null);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0]);
        }
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndSetFile(e.dataTransfer.files[0]);
        }
    }, [validateAndSetFile]);

    const handleCancel = () => {
        abortRef.current.current = true;
        toast.info('Cancelling conversion...');
    };

    const handleConvert = async () => {
        if (!file) {
            setErrorMsg('Please select a PDF file');
            return;
        }

        // Magic byte validation: PDF files start with %PDF
        try {
            const headerBytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
            const header = String.fromCharCode(...headerBytes);
            if (!header.startsWith('%PDF')) {
                setErrorMsg('This file does not appear to be a valid PDF (invalid file header). Please select a real PDF file.');
                return;
            }
        } catch {
            setErrorMsg('Failed to read the file. Please try selecting it again.');
            return;
        }

        // Reset abort signal for new conversion
        abortRef.current = { current: false };

        setState(ProcessState.CONVERTING);
        setErrorMsg('');
        setProgress(0);
        setResultBlob(null);

        try {
            let wordBlob: Blob;

            if (mode === 'ocr') {
                wordBlob = await pdfToWordWithOCR(file, (prog, status) => {
                    if (mountedRef.current) {
                        setProgress(prog);
                        setProgressStatus(status);
                    }
                }, abortRef.current);
            } else {
                wordBlob = await pdfToWord(file, (prog, status) => {
                    if (mountedRef.current) {
                        setProgress(prog);
                        setProgressStatus(status);
                    }
                }, abortRef.current);
            }

            if (!mountedRef.current) return;

            setResultBlob(wordBlob);
            setState(ProcessState.COMPLETED);

            const filename = file.name.replace(/\.pdf$/i, '.docx');
            downloadWord(wordBlob, filename);
            toast.success('Document converted successfully!');
        } catch (err) {
            if (!mountedRef.current) return;

            // User cancelled — silently reset
            if (err instanceof Error && err.message.includes('cancelled')) {
                setState(ProcessState.IDLE);
                setProgress(0);
                setProgressStatus('');
                toast.info('Conversion cancelled');
                return;
            }

            let errorMessage = 'An unknown error occurred';
            if (err instanceof Error) {
                errorMessage = err.message;

                if (err.message.includes('password') || err.message.includes('encrypted')) {
                    errorMessage = 'This PDF is password-protected. Please unlock it first using the Unlock PDF tool.';
                } else if (err.message.includes('Invalid PDF')) {
                    errorMessage = 'The file appears to be corrupted or is not a valid PDF.';
                } else if (err.message.includes('network') || err.message.includes('fetch') || err.message.includes('connection')) {
                    errorMessage = 'Network error. Please check your internet connection and try again.';
                } else if (err.message.includes('OCR engine')) {
                    errorMessage = 'Failed to initialize OCR. Please check your internet connection.';
                } else if (err.message.includes('OCR failed')) {
                    errorMessage = err.message + ' The document may be corrupted or have unusual formatting.';
                } else if (err.message.includes('render')) {
                    errorMessage = 'Failed to render PDF pages. The PDF may be corrupted or in an unsupported format.';
                } else if (err.message.includes('canvas')) {
                    errorMessage = 'Failed to process PDF. Your browser may not support this feature or is running low on memory.';
                } else if (err.message.includes('limited to')) {
                    errorMessage = err.message;
                }
            }

            setErrorMsg(errorMessage);
            toast.error('Conversion failed');
            setState(ProcessState.IDLE);
            setProgress(0);
            setProgressStatus('');
        }
    };

    const handleDownloadAgain = () => {
        if (!resultBlob || !file) return;
        const filename = file.name.replace(/\.pdf$/i, '.docx');
        downloadWord(resultBlob, filename);
        toast.success('Download started!');
    };

    const handleReset = () => {
        setState(ProcessState.IDLE);
        setFile(null);
        setMode('non-ocr');
        setProgress(0);
        setProgressStatus('');
        setErrorMsg('');
        setResultBlob(null);
    };

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

                    {/* Step Progress */}
                    <div style={{ padding: '1.5rem 1.5rem 0' }}>
                        <StepProgress steps={STEPS} currentStep={currentStep} />
                    </div>

                    <div className="workspace-body">
                        {errorMsg && (
                            <div className="error-msg">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-sm" style={{ flexShrink: 0 }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                                <div style={{ flex: 1, textAlign: 'left' }}>
                                    {errorMsg}
                                    <button
                                        onClick={handleConvert}
                                        style={{
                                            display: 'block',
                                            marginTop: '0.5rem',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            color: 'var(--accent)',
                                            textDecoration: 'underline',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: 0,
                                        }}
                                    >
                                        Try Again
                                    </button>
                                </div>
                            </div>
                        )}

                        {state === ProcessState.IDLE || state === ProcessState.UPLOADING ? (
                            <>
                                {file ? (
                                    <div>
                                        <div style={{ padding: '1.5rem', background: 'var(--surface-light)', borderRadius: 'var(--radius-md)', marginBottom: '2rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg" style={{ color: 'var(--text-primary)' }}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                                </svg>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                                        {file.name}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                        <span className="file-size">{formatFileSize(file.size)}</span>
                                                        <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Ready to convert</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Conversion Mode Selection */}
                                            <div style={{ marginTop: '1.5rem' }}>
                                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                                                    Conversion Mode
                                                </label>
                                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                                    <button
                                                        onClick={() => setMode('non-ocr')}
                                                        className={`filter-btn ${mode === 'non-ocr' ? 'active' : ''}`}
                                                        style={{ flex: 1, minWidth: '140px' }}
                                                    >
                                                        <div style={{ textAlign: 'left' }}>
                                                            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Non-OCR</div>
                                                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Fast &bull; Digital PDFs</div>
                                                        </div>
                                                    </button>
                                                    <button
                                                        onClick={() => setMode('ocr')}
                                                        className={`filter-btn ${mode === 'ocr' ? 'active' : ''}`}
                                                        style={{ flex: 1, minWidth: '140px' }}
                                                    >
                                                        <div style={{ textAlign: 'left' }}>
                                                            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>OCR</div>
                                                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Slower &bull; Scanned PDFs</div>
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Mode Description — theme-aware */}
                                            <div style={{
                                                padding: '1rem',
                                                background: mode === 'ocr' ? 'var(--warning-bg)' : 'var(--info-bg)',
                                                border: `1px solid color-mix(in srgb, ${mode === 'ocr' ? 'var(--warning)' : 'var(--info)'} 40%, transparent)`,
                                                borderRadius: 'var(--radius-sm)',
                                                marginTop: '1rem',
                                            }}>
                                                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                                                    {mode === 'non-ocr' ? (
                                                        <>
                                                            <strong>Non-OCR Mode:</strong> Extracts existing text from your PDF. Best for:
                                                            <ul style={{ margin: '0.5rem 0 0 1.5rem', paddingLeft: 0 }}>
                                                                <li>Digital PDFs created from Word/text editors</li>
                                                                <li>PDFs with selectable text</li>
                                                                <li>When you need fast conversion</li>
                                                            </ul>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <strong>OCR Mode:</strong> Uses AI to recognize text in images. Best for:
                                                            <ul style={{ margin: '0.5rem 0 0 1.5rem', paddingLeft: 0 }}>
                                                                <li>Scanned PDFs (photos/scans of documents)</li>
                                                                <li>PDFs with non-selectable text</li>
                                                                <li>Image-based PDFs</li>
                                                            </ul>
                                                            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                                Note: OCR is slower but works with any PDF type
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            <button onClick={handleConvert} className="btn-action" style={{ flex: 1, maxWidth: 'none', marginTop: 0 }}>
                                                Convert to Word ({mode === 'ocr' ? 'OCR' : 'Non-OCR'})
                                            </button>
                                            <button onClick={handleReset} className="btn-secondary" style={{ flex: 1, maxWidth: 'none' }}>
                                                Select Different PDF
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className={`upload-zone${isDragging ? ' drag-over' : ''}`}
                                        role="button"
                                        tabIndex={0}
                                        aria-label="Upload PDF file"
                                        onClick={() => fileInputRef.current?.click()}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
                                        onDragOver={handleDragOver}
                                        onDragEnter={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
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
                                            {isDragging ? 'Drop your PDF here' : 'Select a PDF to convert to Word'}
                                        </span>
                                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                                            Click to browse or drag and drop
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : state === ProcessState.CONVERTING ? (
                            <div className="result-area" style={{ padding: '3rem 0' }} aria-live="polite">
                                <div style={{ maxWidth: '300px', margin: '0 auto 2rem' }}>
                                    <div className="loader">
                                        <div className="loader-bar" style={{ width: `${progress}%`, animation: progress > 0 ? 'none' : undefined }}></div>
                                    </div>
                                    <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        {Math.round(progress)}%
                                    </div>
                                </div>
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>
                                    {mode === 'ocr' ? 'Performing OCR...' : 'Converting to Word...'}
                                </h3>
                                <p className="workspace-desc">{progressStatus || 'Processing your document.'}</p>
                                {mode === 'ocr' && (
                                    <>
                                        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginTop: '1rem' }}>
                                            OCR processing may take a few minutes depending on page count
                                        </p>
                                        <button
                                            onClick={handleCancel}
                                            className="btn-secondary"
                                            style={{ marginTop: '1rem' }}
                                        >
                                            Cancel
                                        </button>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="result-area animate-fade-in">
                                <div className="success-check-animated">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="#fff" width="28" height="28">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                </div>
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Conversion Complete!</h3>

                                {file && resultBlob && (
                                    <div style={{
                                        padding: '1rem 1.5rem',
                                        background: 'var(--success-bg)',
                                        borderRadius: 'var(--radius-md)',
                                        margin: '1.5rem auto',
                                        maxWidth: '360px',
                                        fontSize: '0.875rem',
                                    }}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                            {file.name.replace(/\.pdf$/i, '.docx')}
                                        </div>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                                            {formatFileSize(resultBlob.size)} &bull; Word Document (.docx)
                                        </div>
                                    </div>
                                )}

                                <p className="workspace-desc" style={{ marginBottom: '2rem' }}>
                                    Your file has been downloaded. Check your downloads folder.
                                </p>
                                <div className="action-row">
                                    <button onClick={handleDownloadAgain} className="btn-secondary btn-primary-alt">
                                        Download Again
                                    </button>
                                    <button onClick={handleReset} className="btn-secondary">
                                        Convert Another PDF
                                    </button>
                                </div>
                            </div>
                        )}
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
};

export default PDFToWord;
