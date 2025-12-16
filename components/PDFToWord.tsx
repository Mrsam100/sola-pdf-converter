/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Tool, ProcessState } from '../types';
import { pdfToWord, pdfToWordWithOCR, downloadWord } from '../services/pdfToWordService';
import { useWakeLock, usePageVisibility } from '../hooks/usePageVisibility';
import BackButton from './BackButton';

interface PDFToWordProps {
    tool: Tool;
    onBack: () => void;
}

type ConversionMode = 'non-ocr' | 'ocr';

const PDFToWord: React.FC<PDFToWordProps> = ({ tool, onBack }) => {
    const [state, setState] = useState<ProcessState>(ProcessState.IDLE);
    const [file, setFile] = useState<File | null>(null);
    const [mode, setMode] = useState<ConversionMode>('non-ocr');
    const [progress, setProgress] = useState<number>(0);
    const [progressStatus, setProgressStatus] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Prevent tab suspension during processing
    const isProcessing = state === ProcessState.CONVERTING;
    useWakeLock(isProcessing);
    const isPageVisible = usePageVisibility();

    // Notify user if they switched tabs during processing
    useEffect(() => {
        if (isProcessing && !isPageVisible) {
            console.log('Processing continues in background...');
        }
    }, [isProcessing, isPageVisible]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];

            // Validate file type
            if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
                setErrorMsg('Please select a valid PDF file');
                return;
            }

            // Validate file size (max 50MB)
            const maxSize = 50 * 1024 * 1024; // 50MB
            if (selectedFile.size > maxSize) {
                setErrorMsg('File is too large. Maximum size is 50MB');
                return;
            }

            setFile(selectedFile);
            setState(ProcessState.IDLE);
            setErrorMsg('');
            setProgress(0);
            setProgressStatus('');
        }
    };

    const handleConvert = async () => {
        if (!file) {
            setErrorMsg('Please select a PDF file');
            return;
        }

        setState(ProcessState.CONVERTING);
        setErrorMsg('');
        setProgress(0);

        try {
            let wordBlob: Blob;

            if (mode === 'ocr') {
                // OCR mode
                wordBlob = await pdfToWordWithOCR(file, (prog, status) => {
                    setProgress(prog);
                    setProgressStatus(status);
                });
            } else {
                // Non-OCR mode
                wordBlob = await pdfToWord(file, (prog, status) => {
                    setProgress(prog);
                    setProgressStatus(status);
                });
            }

            setState(ProcessState.COMPLETED);

            // Auto-download
            const filename = file.name.replace('.pdf', '.docx');
            downloadWord(wordBlob, filename);
        } catch (err) {
            console.error('PDF to Word conversion error:', err);

            let errorMessage = 'An unknown error occurred';
            if (err instanceof Error) {
                errorMessage = err.message;

                // Provide helpful error messages for common issues
                if (err.message.includes('password') || err.message.includes('encrypted')) {
                    errorMessage = 'This PDF is password-protected. Please unlock it first using the Unlock PDF tool.';
                } else if (err.message.includes('Invalid PDF')) {
                    errorMessage = 'The file appears to be corrupted or is not a valid PDF.';
                } else if (err.message.includes('network') || err.message.includes('fetch') || err.message.includes('connection')) {
                    errorMessage = 'Network error. Please check your internet connection and try again. OCR requires downloading language files.';
                } else if (err.message.includes('OCR engine')) {
                    errorMessage = 'Failed to initialize OCR. Please check your internet connection - OCR needs to download language files on first use.';
                } else if (err.message.includes('OCR failed')) {
                    errorMessage = err.message + ' This may happen if the PDF is corrupted or has unusual formatting.';
                } else if (err.message.includes('render')) {
                    errorMessage = 'Failed to render PDF pages. The PDF may be corrupted or in an unsupported format.';
                } else if (err.message.includes('canvas')) {
                    errorMessage = 'Failed to process PDF. Your browser may not support this feature or is running low on memory.';
                }
            }

            setErrorMsg(errorMessage);
            setState(ProcessState.IDLE);
            setProgress(0);
            setProgressStatus('');
        }
    };

    const handleReset = () => {
        setState(ProcessState.IDLE);
        setFile(null);
        setMode('non-ocr');
        setProgress(0);
        setProgressStatus('');
        setErrorMsg('');
    };

    return (
        <div className="detail-view animate-fade-in">
            <div className="container">
                {/* Navigation */}
                <BackButton onBack={onBack} />

                {/* Main Interface Card */}
                <div className="workspace-card">
                    {/* Header */}
                    <div className="workspace-header">
                        <div className="workspace-icon-large">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg">
                                <path strokeLinecap="round" strokeLinejoin="round" d={tool.icon} />
                            </svg>
                        </div>
                        <h1 className="workspace-title">{tool.name}</h1>
                        <p className="workspace-desc">{tool.description}</p>
                    </div>

                    {/* Functional Area */}
                    <div className="workspace-body">
                        {errorMsg && (
                            <div className="error-msg">{errorMsg}</div>
                        )}

                        {state === ProcessState.IDLE || state === ProcessState.UPLOADING ? (
                            <>
                                {file ? (
                                    <div>
                                        {/* File Info */}
                                        <div style={{ padding: '1.5rem', background: 'var(--surface-light)', borderRadius: '0.5rem', marginBottom: '2rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg" style={{ color: 'var(--text-primary)' }}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                                </svg>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                                        {file.name}
                                                    </div>
                                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                                                        Ready to convert to Word
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Conversion Mode Selection */}
                                            <div style={{ marginTop: '1.5rem' }}>
                                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                                                    Conversion Mode
                                                </label>
                                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                                    <button
                                                        onClick={() => setMode('non-ocr')}
                                                        className={`filter-btn ${mode === 'non-ocr' ? 'active' : ''}`}
                                                        style={{ flex: 1, minWidth: '200px' }}
                                                    >
                                                        <div style={{ textAlign: 'left' }}>
                                                            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Non-OCR</div>
                                                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Fast • For digital PDFs with selectable text</div>
                                                        </div>
                                                    </button>
                                                    <button
                                                        onClick={() => setMode('ocr')}
                                                        className={`filter-btn ${mode === 'ocr' ? 'active' : ''}`}
                                                        style={{ flex: 1, minWidth: '200px' }}
                                                    >
                                                        <div style={{ textAlign: 'left' }}>
                                                            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>OCR</div>
                                                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Slower • For scanned PDFs or images</div>
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Mode Description */}
                                            <div style={{ padding: '1rem', background: mode === 'ocr' ? '#FEF3C7' : '#EFF6FF', border: `1px solid ${mode === 'ocr' ? '#FCD34D' : '#BFDBFE'}`, borderRadius: '0.5rem', marginTop: '1rem' }}>
                                                <div style={{ fontSize: '0.875rem', color: mode === 'ocr' ? '#92400E' : '#1E40AF', lineHeight: 1.6 }}>
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
                                                            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
                                                                ⚠️ Note: OCR is slower but works with any PDF type
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            <button onClick={handleConvert} className="btn-action" style={{ flex: 1, maxWidth: 'none' }}>
                                                Convert to Word ({mode === 'ocr' ? 'OCR' : 'Non-OCR'})
                                            </button>
                                            <button onClick={handleReset} className="btn-secondary" style={{ flex: 1, maxWidth: 'none' }}>
                                                Select Different PDF
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className="upload-zone"
                                        onClick={() => fileInputRef.current?.click()}
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
                                        <span style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem', color: '#2C2A26' }}>
                                            Select a PDF to convert to Word
                                        </span>
                                        <span style={{ color: '#A8A29E', fontSize: '0.875rem' }}>
                                            Click to browse or drag and drop
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : state === ProcessState.CONVERTING ? (
                            <div className="result-area" style={{ padding: '3rem 0' }}>
                                <div style={{ maxWidth: '300px', margin: '0 auto 2rem' }}>
                                    <div className="loader">
                                        <div className="loader-bar" style={{ width: `${progress}%` }}></div>
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
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginTop: '1rem' }}>
                                        OCR processing may take a few minutes depending on page count
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="result-area animate-fade-in">
                                <div className="success-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-lg">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                </div>
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Success!</h3>
                                <p className="workspace-desc" style={{ marginBottom: '2rem' }}>
                                    Your PDF has been converted to Word (.docx) successfully.
                                    <br />
                                    Check your downloads folder.
                                </p>
                                <div className="action-row">
                                    <button onClick={handleReset} className="btn-secondary">
                                        Convert Another PDF
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
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
