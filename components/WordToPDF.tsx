/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { Tool, ProcessState } from '../types';
import { wordToPDF, downloadPDF } from '../services/wordToPdfService';
import { useWakeLock, usePageVisibility } from '../hooks/usePageVisibility';
import { toast } from '../hooks/useToast';
import { formatFileSize } from '../utils/formatFileSize';
import BackButton from './BackButton';
import StepProgress from './StepProgress';

interface WordToPDFProps {
    tool: Tool;
    onBack: () => void;
}

const STEPS = [
    { label: 'Upload' },
    { label: 'Converting' },
    { label: 'Complete' },
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const WordToPDF: React.FC<WordToPDFProps> = ({ tool, onBack }) => {
    const [state, setState] = useState<ProcessState>(ProcessState.IDLE);
    const [file, setFile] = useState<File | null>(null);
    const [progress, setProgress] = useState<number>(0);
    const [progressStatus, setProgressStatus] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const [resultBlob, setResultBlob] = useState<Uint8Array | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Prevent tab suspension during processing
    const isProcessing = state === ProcessState.CONVERTING;
    useWakeLock(isProcessing);
    usePageVisibility();

    const currentStep = state === ProcessState.IDLE || state === ProcessState.UPLOADING
        ? (file ? 0 : -1)
        : state === ProcessState.CONVERTING ? 1 : 2;

    const validateAndSetFile = useCallback((selectedFile: File) => {
        // Validate file type
        if (!selectedFile.name.toLowerCase().endsWith('.docx') &&
            !selectedFile.type.includes('wordprocessingml')) {
            setErrorMsg('Please select a Word document (.docx file). .doc files are not supported.');
            return;
        }

        // 🔒 VALIDATION FIX: Check for 0-byte files to prevent wasted processing
        if (selectedFile.size === 0) {
            setErrorMsg('The selected file is empty (0 bytes). Please select a valid Word document.');
            return;
        }

        // Validate file size
        if (selectedFile.size > MAX_FILE_SIZE) {
            setErrorMsg(`File is too large (${formatFileSize(selectedFile.size)}). Maximum size is 25MB.`);
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

    const handleConvert = async () => {
        if (!file) {
            setErrorMsg('Please select a Word document');
            return;
        }

        /**
         * 🔒 SECURITY: Strengthened .docx validation
         *
         * Problem: Old code accepted ANY ZIP file as .docx
         * Solution: Verify it's actually Office Open XML by checking for specific files
         */
        try {
            // Step 1: Check ZIP magic bytes (PK\x03\x04)
            const headerBytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
            if (headerBytes[0] !== 0x50 || headerBytes[1] !== 0x4B ||
                headerBytes[2] !== 0x03 || headerBytes[3] !== 0x04) {
                setErrorMsg('This file does not appear to be a valid Word document (invalid file header). Please select a .docx file.');
                return;
            }

            // Step 2: 🔒 SECURITY: Verify it's actually a .docx (not just any ZIP)
            // Check for Office Open XML structure by looking for [Content_Types].xml
            const arrayBuffer = await file.arrayBuffer();
            const textDecoder = new TextDecoder();
            const content = textDecoder.decode(new Uint8Array(arrayBuffer).slice(0, 10000));

            // .docx files MUST contain these files in the ZIP:
            // - [Content_Types].xml (Office Open XML manifest)
            // - word/document.xml (main Word document)
            const hasContentTypes = content.includes('[Content_Types].xml');
            const hasWordDocument = content.includes('word/document.xml') || content.includes('word/document');

            if (!hasContentTypes || !hasWordDocument) {
                setErrorMsg('❌ This ZIP file is not a valid Word document (.docx). .docx files must contain Office Open XML structure. Please select a valid .docx file created by Microsoft Word or compatible software.');
                return;
            }
        } catch {
            setErrorMsg('Failed to read the file. Please try selecting it again.');
            return;
        }

        setState(ProcessState.CONVERTING);
        setErrorMsg('');
        setProgress(0);
        setResultBlob(null);

        try {
            const pdfBytes = await wordToPDF(file, (prog, status) => {
                setProgress(prog);
                setProgressStatus(status);
            });

            setResultBlob(pdfBytes);
            setState(ProcessState.COMPLETED);

            downloadPDF(pdfBytes, file.name);
            toast.success('Document converted successfully!');
        } catch (err) {
            let errorMessage = 'An unknown error occurred';
            if (err instanceof Error) {
                errorMessage = err.message;

                if (err.message.includes('WinAnsi') || err.message.includes('encode')) {
                    errorMessage = 'This document contains unsupported characters. The conversion will skip those characters.';
                } else if (err.message.includes('mammoth') || err.message.includes('parse')) {
                    errorMessage = 'Failed to parse the Word document. The file may be corrupted or in an unsupported format.';
                } else if (err.message.includes('arrayBuffer') || err.message.includes('read')) {
                    errorMessage = 'Failed to read the file. Please try selecting it again.';
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
        downloadPDF(resultBlob, file.name);
        toast.success('Download started!');
    };

    const handleReset = () => {
        setState(ProcessState.IDLE);
        setFile(null);
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg" style={{ color: 'var(--text-primary)' }}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                                </svg>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                                        {file.name}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                        <span className="file-size">{formatFileSize(file.size)}</span>
                                                        <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Ready to convert to PDF</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{
                                                padding: '1rem',
                                                background: 'var(--info-bg)',
                                                border: '1px solid color-mix(in srgb, var(--info) 40%, transparent)',
                                                borderRadius: 'var(--radius-sm)',
                                            }}>
                                                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                                                    <strong>What to expect:</strong>
                                                    <ul style={{ margin: '0.5rem 0 0 1.5rem', paddingLeft: 0 }}>
                                                        <li>Text content will be preserved</li>
                                                        <li>Bold and italic formatting maintained</li>
                                                        <li>Headings and lists preserved</li>
                                                        <li>A4 page size with proper margins</li>
                                                    </ul>
                                                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                        Note: Only .docx files are supported (Word 2007+)
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            <button onClick={handleConvert} className="btn-action" style={{ flex: 1, maxWidth: 'none', marginTop: 0 }}>
                                                Convert to PDF
                                            </button>
                                            <button onClick={handleReset} className="btn-secondary" style={{ flex: 1, maxWidth: 'none' }}>
                                                Select Different Document
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className={`upload-zone${isDragging ? ' drag-over' : ''}`}
                                        role="button"
                                        tabIndex={0}
                                        aria-label="Upload Word document"
                                        onClick={() => fileInputRef.current?.click()}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
                                        onDragOver={handleDragOver}
                                        onDragEnter={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        <input
                                            type="file"
                                            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
                                            {isDragging ? 'Drop your Word document here' : 'Select a Word document to convert to PDF'}
                                        </span>
                                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                                            Click to browse or drag and drop (.docx files only)
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
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Converting to PDF...</h3>
                                <p className="workspace-desc">{progressStatus || 'Processing your document.'}</p>
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
                                            {file.name.replace(/\.docx?$/i, '.pdf')}
                                        </div>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                                            {formatFileSize(resultBlob.length)} &bull; PDF Document
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
                                        Convert Another Document
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

export default WordToPDF;
