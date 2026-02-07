/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tool, ProcessState } from '../types';
import { excelToPDF, downloadPDF } from '../services/excelToPdfService';
import { useWakeLock, usePageVisibility } from '../hooks/usePageVisibility';
import { toast } from '../hooks/useToast';
import { formatFileSize } from '../utils/formatFileSize';
import BackButton from './BackButton';
import StepProgress from './StepProgress';

interface ExcelToPDFProps {
    tool: Tool;
    onBack: () => void;
}

const STEPS = [
    { label: 'Upload' },
    { label: 'Converting' },
    { label: 'Complete' },
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const ACCEPTED_MIMETYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
];

function isValidSpreadsheet(file: File): boolean {
    const name = file.name.toLowerCase();
    const hasValidExt = ACCEPTED_EXTENSIONS.some(ext => name.endsWith(ext));
    const hasValidMime = ACCEPTED_MIMETYPES.includes(file.type) || file.type === '';
    return hasValidExt || hasValidMime;
}

const ExcelToPDF: React.FC<ExcelToPDFProps> = ({ tool, onBack }) => {
    const [state, setState] = useState<ProcessState>(ProcessState.IDLE);
    const [file, setFile] = useState<File | null>(null);
    const [progress, setProgress] = useState<number>(0);
    const [progressStatus, setProgressStatus] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const [resultBlob, setResultBlob] = useState<Uint8Array | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mountedRef = useRef(true);

    const isProcessing = state === ProcessState.CONVERTING;
    useWakeLock(isProcessing);
    usePageVisibility();

    useEffect(() => {
        return () => { mountedRef.current = false; };
    }, []);

    const currentStep = state === ProcessState.IDLE || state === ProcessState.UPLOADING
        ? (file ? 0 : -1)
        : state === ProcessState.CONVERTING ? 1 : 2;

    const validateAndSetFile = useCallback((selectedFile: File) => {
        if (!isValidSpreadsheet(selectedFile)) {
            setErrorMsg('Please select a valid spreadsheet file (.xlsx, .xls, or .csv).');
            return;
        }
        if (selectedFile.size > MAX_FILE_SIZE) {
            setErrorMsg(`File is too large (${formatFileSize(selectedFile.size)}). Maximum size is 25MB.`);
            return;
        }

        // Magic byte validation: xlsx/xls are ZIP archives (PK header)
        // CSV files are plain text, so we skip magic bytes for .csv
        const name = selectedFile.name.toLowerCase();
        if (!name.endsWith('.csv')) {
            const reader = new FileReader();
            reader.onload = () => {
                const arr = new Uint8Array(reader.result as ArrayBuffer);
                // ZIP magic bytes: PK\x03\x04
                if (arr.length >= 4 && arr[0] === 0x50 && arr[1] === 0x4B && arr[2] === 0x03 && arr[3] === 0x04) {
                    setFile(selectedFile);
                    setState(ProcessState.IDLE);
                    setErrorMsg('');
                    setProgress(0);
                    setProgressStatus('');
                    setResultBlob(null);
                } else {
                    setErrorMsg('This file does not appear to be a valid Excel file (invalid file header).');
                }
            };
            reader.onerror = () => {
                setErrorMsg('Failed to read the file. Please try selecting it again.');
            };
            reader.readAsArrayBuffer(selectedFile.slice(0, 4));
        } else {
            setFile(selectedFile);
            setState(ProcessState.IDLE);
            setErrorMsg('');
            setProgress(0);
            setProgressStatus('');
            setResultBlob(null);
        }
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
    };

    const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
    const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        if (e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]);
    }, [validateAndSetFile]);

    const handleConvert = async () => {
        if (!file) { setErrorMsg('Please select a spreadsheet file'); return; }

        setState(ProcessState.CONVERTING);
        setErrorMsg('');
        setProgress(0);
        setResultBlob(null);

        try {
            const pdfData = await excelToPDF(file, (prog, status) => {
                if (mountedRef.current) { setProgress(prog); setProgressStatus(status); }
            });

            if (!mountedRef.current) return;

            setResultBlob(pdfData);
            setState(ProcessState.COMPLETED);
            downloadPDF(pdfData, file.name);
            toast.success('Spreadsheet converted to PDF successfully!');
        } catch (err) {
            if (!mountedRef.current) return;

            let errorMessage = 'An unknown error occurred';
            if (err instanceof Error) {
                errorMessage = err.message;
                if (err.message.includes('empty') || err.message.includes('No data')) {
                    errorMessage = 'The spreadsheet appears to be empty or contains no readable data.';
                } else if (err.message.includes('password') || err.message.includes('encrypted')) {
                    errorMessage = 'This file is password-protected. Please remove the password and try again.';
                } else if (err.message.includes('unsupported') || err.message.includes('format')) {
                    errorMessage = 'This file format is not supported. Please use .xlsx, .xls, or .csv files.';
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

    const getFileTypeLabel = (name: string): string => {
        const lower = name.toLowerCase();
        if (lower.endsWith('.xlsx')) return 'Excel Workbook (.xlsx)';
        if (lower.endsWith('.xls')) return 'Excel 97-2003 (.xls)';
        if (lower.endsWith('.csv')) return 'CSV Spreadsheet (.csv)';
        return 'Spreadsheet';
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
                                    {file && (
                                        <button onClick={handleConvert} style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                            Try Again
                                        </button>
                                    )}
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
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M12 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M21.375 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M12 13.125v1.5m0 0c0 .621.504 1.125 1.125 1.125M12 14.625c0 .621-.504 1.125-1.125 1.125M12 14.625h7.5m-7.5 0h-7.5" />
                                                </svg>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{file.name}</div>
                                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                        <span className="file-size">{formatFileSize(file.size)}</span>
                                                        <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>{getFileTypeLabel(file.name)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ padding: '1rem', background: 'var(--info-bg)', border: '1px solid color-mix(in srgb, var(--info) 40%, transparent)', borderRadius: 'var(--radius-sm)' }}>
                                                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                                                    <strong>How it works:</strong>
                                                    <ul style={{ margin: '0.5rem 0 0 1.5rem', paddingLeft: 0 }}>
                                                        <li>Each sheet is rendered as a formatted table in the PDF</li>
                                                        <li>Column widths adapt to content automatically</li>
                                                        <li>Headers are bold with a subtle background</li>
                                                        <li>All processing happens in your browser</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            <button onClick={handleConvert} className="btn-action" style={{ flex: 1, maxWidth: 'none', marginTop: 0 }}>Convert to PDF</button>
                                            <button onClick={handleReset} className="btn-secondary" style={{ flex: 1, maxWidth: 'none' }}>Select Different File</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className={`upload-zone${isDragging ? ' drag-over' : ''}`}
                                        role="button" tabIndex={0} aria-label="Upload spreadsheet file"
                                        onClick={() => fileInputRef.current?.click()}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
                                        onDragOver={handleDragOver} onDragEnter={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                                    >
                                        <input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />
                                        <div className="upload-icon-wrapper">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                            </svg>
                                        </div>
                                        <span style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                            {isDragging ? 'Drop your spreadsheet here' : 'Select a spreadsheet to convert'}
                                        </span>
                                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Supports .xlsx, .xls, and .csv files</span>
                                    </div>
                                )}
                            </>
                        ) : state === ProcessState.CONVERTING ? (
                            <div className="result-area" style={{ padding: '3rem 0' }} aria-live="polite">
                                <div style={{ maxWidth: '300px', margin: '0 auto 2rem' }}>
                                    <div className="loader">
                                        <div className="loader-bar" style={{ width: `${progress}%`, animation: progress > 0 ? 'none' : undefined }}></div>
                                    </div>
                                    <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{Math.round(progress)}%</div>
                                </div>
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Converting to PDF...</h3>
                                <p className="workspace-desc">{progressStatus || 'Processing your spreadsheet.'}</p>
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
                                    <div style={{ padding: '1rem 1.5rem', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', margin: '1.5rem auto', maxWidth: '360px', fontSize: '0.875rem' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                            {file.name.replace(/\.(xlsx?|csv)$/i, '.pdf')}
                                        </div>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                                            {formatFileSize(resultBlob.length)} &bull; PDF Document (.pdf)
                                        </div>
                                    </div>
                                )}

                                <p className="workspace-desc" style={{ marginBottom: '2rem' }}>Your file has been downloaded. Check your downloads folder.</p>
                                <div className="action-row">
                                    <button onClick={handleDownloadAgain} className="btn-secondary btn-primary-alt">Download Again</button>
                                    <button onClick={handleReset} className="btn-secondary">Convert Another File</button>
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

export default ExcelToPDF;
