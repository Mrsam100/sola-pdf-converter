/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { Tool, ProcessState } from '../types';
import { extractTextWithOCR } from '../services/pdfToWordService';
import { createConfiguredWorker } from '../services/tesseractConfig';
import { useWakeLock } from '../hooks/usePageVisibility';
import { toast } from '../hooks/useToast';
import { formatFileSize } from '../utils/formatFileSize';
import BackButton from './BackButton';
import StepProgress from './StepProgress';

interface OCRToTextProps {
    tool: Tool;
    onBack: () => void;
}

const STEPS = [
    { label: 'Upload' },
    { label: 'OCR' },
    { label: 'Complete' },
];

const OCRToText: React.FC<OCRToTextProps> = ({ tool, onBack }) => {
    const [state, setState] = useState<ProcessState>(ProcessState.IDLE);
    const [file, setFile] = useState<File | null>(null);
    const [progress, setProgress] = useState<number>(0);
    const [progressStatus, setProgressStatus] = useState<string>('');
    const [resultText, setResultText] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const [copied, setCopied] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isProcessing = state === ProcessState.CONVERTING;
    useWakeLock(isProcessing);

    const currentStep = state === ProcessState.IDLE || state === ProcessState.UPLOADING
        ? (file ? 0 : -1)
        : state === ProcessState.CONVERTING ? 1 : 2;

    const validateAndSetFile = useCallback((selectedFile: File) => {
        const isPDF = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');
        const isImage = selectedFile.type.startsWith('image/');

        if (!isPDF && !isImage) {
            setErrorMsg('Please select a PDF or image file (JPG, PNG, etc.)');
            return;
        }

        const maxSize = 50 * 1024 * 1024;
        if (selectedFile.size > maxSize) {
            setErrorMsg('File is too large. Maximum size is 50MB');
            return;
        }

        setFile(selectedFile);
        setState(ProcessState.IDLE);
        setResultText('');
        setErrorMsg('');
        setProgress(0);
        setProgressStatus('');
        setCopied(false);
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

    const ocrImage = async (imageFile: File, onProgress?: (p: number, s: string) => void): Promise<string> => {
        let worker: any = null;
        try {
            onProgress?.(5, 'Initializing OCR engine...');
            worker = await createConfiguredWorker('eng');

            onProgress?.(20, 'Recognizing text...');
            const { data: { text } } = await worker.recognize(imageFile);

            onProgress?.(100, 'OCR complete!');
            return text.trim();
        } finally {
            if (worker) {
                try { await worker.terminate(); } catch { /* ignore */ }
            }
        }
    };

    const handleConvert = async () => {
        if (!file) {
            setErrorMsg('Please select a file');
            return;
        }

        setState(ProcessState.CONVERTING);
        setErrorMsg('');
        setProgress(0);
        setResultText('');

        try {
            let text: string;
            const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

            if (isPDF) {
                const result = await extractTextWithOCR(file, (prog, status) => {
                    setProgress(prog);
                    setProgressStatus(status);
                });
                text = result.text;
            } else {
                text = await ocrImage(file, (prog, status) => {
                    setProgress(prog);
                    setProgressStatus(status);
                });
            }

            if (!text.trim()) {
                setResultText('(No text could be recognized in this file)');
            } else {
                setResultText(text);
            }
            setState(ProcessState.COMPLETED);
            toast.success('Text extracted successfully!');
        } catch (err) {
            console.error('OCR error:', err);
            let errorMessage = 'An unknown error occurred';
            if (err instanceof Error) {
                errorMessage = err.message;
                if (err.message.includes('OCR engine')) {
                    errorMessage = 'Failed to initialize OCR. Please check your internet connection.';
                } else if (err.message.includes('OCR failed')) {
                    errorMessage = err.message + ' The document may be corrupted or have unusual formatting.';
                }
            }
            setErrorMsg(errorMessage);
            toast.error('OCR extraction failed');
            setState(ProcessState.IDLE);
            setProgress(0);
            setProgressStatus('');
        }
    };

    const handleDownload = () => {
        if (!resultText) return;
        const blob = new Blob([resultText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const baseName = file?.name.replace(/\.[^.]+$/, '') || 'ocr-result';
        link.download = `${baseName}_ocr.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        toast.success('Download started!');
    };

    const handleCopy = async () => {
        if (!resultText) return;
        try {
            await navigator.clipboard.writeText(resultText);
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = resultText;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        setCopied(true);
        toast.success('Copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleReset = () => {
        setState(ProcessState.IDLE);
        setFile(null);
        setProgress(0);
        setProgressStatus('');
        setResultText('');
        setErrorMsg('');
        setCopied(false);
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg" style={{ color: 'var(--text-primary)' }}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                                </svg>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                                        {file.name}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                        <span className="file-size">{formatFileSize(file.size)}</span>
                                                        <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Ready for OCR</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{
                                                padding: '1rem',
                                                background: 'var(--warning-bg)',
                                                border: '1px solid color-mix(in srgb, var(--warning) 40%, transparent)',
                                                borderRadius: 'var(--radius-sm)',
                                            }}>
                                                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                                                    <strong>OCR Mode:</strong> Uses optical character recognition to extract text from:
                                                    <ul style={{ margin: '0.5rem 0 0 1.5rem', paddingLeft: 0 }}>
                                                        <li>Scanned PDFs and photos of documents</li>
                                                        <li>Images with text (JPG, PNG, etc.)</li>
                                                        <li>PDFs with non-selectable text</li>
                                                    </ul>
                                                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                        Processing time depends on page count and image quality
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            <button onClick={handleConvert} className="btn-action" style={{ flex: 1, maxWidth: 'none', marginTop: 0 }}>
                                                Extract Text (OCR)
                                            </button>
                                            <button onClick={handleReset} className="btn-secondary" style={{ flex: 1, maxWidth: 'none' }}>
                                                Select Different File
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className={`upload-zone${isDragging ? ' drag-over' : ''}`}
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={handleDragOver}
                                        onDragEnter={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        <input
                                            type="file"
                                            accept=".pdf,application/pdf,image/*"
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
                                            {isDragging ? 'Drop your file here' : 'Select a PDF or image for OCR'}
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
                                    Performing OCR...
                                </h3>
                                <p className="workspace-desc">{progressStatus || 'Processing your document.'}</p>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginTop: '1rem' }}>
                                    OCR processing may take a few minutes depending on page count
                                </p>
                            </div>
                        ) : (
                            <div className="result-area animate-fade-in">
                                <div className="success-check-animated">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="#fff" width="28" height="28">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                </div>
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Text Extracted!</h3>

                                {resultText && (
                                    <div style={{ textAlign: 'left', marginBottom: '2rem', width: '100%' }}>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                            Extracted Text
                                        </label>
                                        <textarea
                                            readOnly
                                            value={resultText}
                                            style={{
                                                width: '100%',
                                                minHeight: '200px',
                                                maxHeight: '400px',
                                                padding: '1rem',
                                                fontFamily: 'monospace',
                                                fontSize: '0.875rem',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 'var(--radius-sm)',
                                                resize: 'vertical',
                                                background: 'var(--surface-light)',
                                                color: 'var(--text-primary)',
                                            }}
                                        />
                                    </div>
                                )}

                                <div className="action-row">
                                    <button onClick={handleDownload} className="btn-secondary btn-primary-alt">
                                        Download as TXT
                                    </button>
                                    <button onClick={handleCopy} className="btn-secondary">
                                        {copied ? 'Copied!' : 'Copy to Clipboard'}
                                    </button>
                                    <button onClick={handleReset} className="btn-secondary">
                                        OCR Another File
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

export default OCRToText;
