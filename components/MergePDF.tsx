/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tool, ProcessState, MergePdfConfig, ConversionStep } from '../types';
import { mergePDFs, downloadPDF } from '../services/pdfService';
import { MergePdfConfig as MergePdfConfigComponent } from './config/MergePdfConfig';
import { useWakeLock, usePageVisibility } from '../hooks/usePageVisibility';
import { toast } from '../hooks/useToast';
import { formatFileSize } from '../utils/formatFileSize';
import BackButton from './BackButton';
import StepProgress from './StepProgress';

interface MergePDFProps {
    tool: Tool;
    onBack: () => void;
}

const STEPS = [
    { label: 'Upload' },
    { label: 'Configure' },
    { label: 'Merging' },
    { label: 'Complete' },
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
const MAX_FILE_COUNT = 50;

const MergePDF: React.FC<MergePDFProps> = ({ tool, onBack }) => {
    const [state, setState] = useState<ProcessState>(ProcessState.IDLE);
    const [conversionStep, setConversionStep] = useState<ConversionStep>('upload');
    const [files, setFiles] = useState<File[]>([]);
    const [config, setConfig] = useState<MergePdfConfig | undefined>(undefined);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [resultBlob, setResultBlob] = useState<Uint8Array | null>(null);
    const [resultSize, setResultSize] = useState<number>(0);
    const [progress, setProgress] = useState<number>(0);
    const [progressStatus, setProgressStatus] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<{ current: boolean }>({ current: false });
    const mountedRef = useRef(true);

    const isProcessing = state === ProcessState.CONVERTING;
    useWakeLock(isProcessing);
    usePageVisibility();

    useEffect(() => {
        return () => {
            mountedRef.current = false;
            abortRef.current.current = true;
        };
    }, []);

    const currentStep = conversionStep === 'upload'
        ? (files.length >= 2 ? 0 : -1)
        : conversionStep === 'configure' ? 1
        : state === ProcessState.CONVERTING ? 2
        : 3;

    const validateFile = useCallback((file: File): string | null => {
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            return `"${file.name}" is not a PDF file.`;
        }
        if (file.size > MAX_FILE_SIZE) {
            return `"${file.name}" is too large (${formatFileSize(file.size)}). Maximum is 50MB per file.`;
        }
        return null;
    }, []);

    const addFiles = useCallback((newFiles: File[]) => {
        const errors: string[] = [];
        const valid: File[] = [];

        for (const f of newFiles) {
            const err = validateFile(f);
            if (err) {
                errors.push(err);
            } else {
                valid.push(f);
            }
        }

        if (errors.length > 0) {
            setErrorMsg(errors.join(' '));
        } else {
            setErrorMsg('');
        }

        setFiles(prev => {
            const combined = [...prev, ...valid];
            if (combined.length > MAX_FILE_COUNT) {
                setErrorMsg(`Maximum ${MAX_FILE_COUNT} files allowed. Only the first ${MAX_FILE_COUNT} were kept.`);
                return combined.slice(0, MAX_FILE_COUNT);
            }
            return combined;
        });
    }, [validateFile]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addFiles(Array.from(e.target.files));
        }
        // Reset input value so same files can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = '';
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
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addFiles(Array.from(e.dataTransfer.files));
        }
    }, [addFiles]);

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const moveFileUp = (index: number) => {
        if (index === 0) return;
        setFiles(prev => {
            const next = [...prev];
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            return next;
        });
    };

    const moveFileDown = (index: number) => {
        setFiles(prev => {
            if (index >= prev.length - 1) return prev;
            const next = [...prev];
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            return next;
        });
    };

    const handleProceedToConfig = () => {
        if (files.length < 2) {
            setErrorMsg('Please select at least 2 PDF files to merge');
            return;
        }
        setErrorMsg('');
        setConversionStep('configure');
    };

    const handleConfigChange = (newConfig: MergePdfConfig) => {
        setConfig(newConfig);
    };

    const handleMerge = async (finalConfig: MergePdfConfig) => {
        abortRef.current = { current: false };
        setState(ProcessState.CONVERTING);
        setConversionStep('processing');
        setErrorMsg('');
        setProgress(0);
        setResultBlob(null);

        try {
            // Validate magic bytes on all files
            for (const file of files) {
                try {
                    const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
                    if (String.fromCharCode(...header).indexOf('%PDF') !== 0) {
                        throw new Error(`"${file.name}" does not appear to be a valid PDF (invalid file header).`);
                    }
                } catch (e) {
                    if (e instanceof Error && e.message.includes('does not appear')) throw e;
                    throw new Error(`Failed to read "${file.name}". Please try selecting it again.`);
                }
            }

            const mergedPdf = await mergePDFs(files, finalConfig, (prog, status) => {
                if (mountedRef.current) {
                    setProgress(prog);
                    setProgressStatus(status);
                }
            }, abortRef.current);

            if (!mountedRef.current) return;

            setResultBlob(mergedPdf);
            setResultSize(mergedPdf.length);
            setState(ProcessState.COMPLETED);
            setConversionStep('result');

            // Auto-download with sanitized filename
            const firstName = files[0]?.name.replace(/\.pdf$/i, '') || 'document';
            downloadPDF(mergedPdf, `${firstName}_merged.pdf`);
            toast.success('PDFs merged successfully!');
        } catch (err) {
            if (!mountedRef.current) return;
            if (err instanceof Error && err.message.includes('cancelled')) {
                setState(ProcessState.IDLE);
                setConversionStep('configure');
                setProgress(0);
                setProgressStatus('');
                toast.info('Merge cancelled');
                return;
            }

            let errorMessage = 'An unknown error occurred';
            if (err instanceof Error) {
                errorMessage = err.message;
                if (err.message.includes('password') || err.message.includes('encrypted')) {
                    errorMessage = 'One or more PDFs are password-protected. Please unlock them first using the Unlock PDF tool.';
                } else if (err.message.includes('Invalid PDF')) {
                    errorMessage = 'One or more files appear to be corrupted or are not valid PDFs.';
                }
            }
            setErrorMsg(errorMessage);
            toast.error('Merge failed');
            setState(ProcessState.IDLE);
            setConversionStep('configure'); // Keep files, go back to config (not upload)
            setProgress(0);
            setProgressStatus('');
        }
    };

    const handleCancel = () => {
        abortRef.current.current = true;
        toast.info('Cancelling...');
    };

    const handleCancelConfig = () => {
        setConversionStep('upload');
    };

    const handleDownloadAgain = () => {
        if (!resultBlob) return;
        const firstName = files[0]?.name.replace(/\.pdf$/i, '') || 'document';
        downloadPDF(resultBlob, `${firstName}_merged.pdf`);
        toast.success('Download started!');
    };

    const handleReset = () => {
        setState(ProcessState.IDLE);
        setConversionStep('upload');
        setFiles([]);
        setConfig(undefined);
        setErrorMsg('');
        setResultBlob(null);
        setResultSize(0);
        setProgress(0);
        setProgressStatus('');
    };

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    return (
        <div className="detail-view animate-fade-in">
            <div className="container">
                <BackButton onBack={onBack} />

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

                    {conversionStep !== 'configure' && (
                        <div style={{ padding: '1.5rem 1.5rem 0' }}>
                            <StepProgress steps={STEPS} currentStep={currentStep} />
                        </div>
                    )}

                    {/* Functional Area */}
                    <div className="workspace-body">
                        {errorMsg && (
                            <div className="error-msg">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-sm" style={{ flexShrink: 0 }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                                <div style={{ flex: 1, textAlign: 'left' }}>
                                    {errorMsg}
                                </div>
                            </div>
                        )}

                        {conversionStep === 'configure' ? (
                            <MergePdfConfigComponent
                                files={files}
                                onConfigChange={handleConfigChange}
                                onMerge={handleMerge}
                                onCancel={handleCancelConfig}
                            />
                        ) : state === ProcessState.IDLE || state === ProcessState.UPLOADING ? (
                            <>
                                {/* File List */}
                                {files.length > 0 && (
                                    <div style={{ marginBottom: '2rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                            <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: 0 }}>
                                                Selected Files ({files.length})
                                            </h3>
                                            <span className="file-size">{formatFileSize(totalSize)} total</span>
                                        </div>
                                        <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                            {files.map((file, index) => (
                                                <div
                                                    key={`${file.name}-${file.size}-${file.lastModified}`}
                                                    style={{
                                                        padding: '1rem',
                                                        borderBottom: index < files.length - 1 ? '1px solid var(--border-color)' : 'none',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        background: 'var(--surface-white)',
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                                                            {index + 1}
                                                        </span>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {file.name}
                                                            </div>
                                                            <span className="file-size">{formatFileSize(file.size)}</span>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                                        <button
                                                            onClick={() => moveFileUp(index)}
                                                            disabled={index === 0}
                                                            className="btn-secondary"
                                                            style={{ padding: '0.4rem', opacity: index === 0 ? 0.4 : 1 }}
                                                            title="Move up"
                                                            aria-label={`Move ${file.name} up`}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-sm">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => moveFileDown(index)}
                                                            disabled={index === files.length - 1}
                                                            className="btn-secondary"
                                                            style={{ padding: '0.4rem', opacity: index === files.length - 1 ? 0.4 : 1 }}
                                                            title="Move down"
                                                            aria-label={`Move ${file.name} down`}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-sm">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => removeFile(index)}
                                                            className="btn-secondary"
                                                            style={{ padding: '0.4rem', color: 'var(--error)' }}
                                                            title="Remove"
                                                            aria-label={`Remove ${file.name}`}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-sm">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Upload Zone */}
                                <div
                                    className={`upload-zone${isDragging ? ' drag-over' : ''}`}
                                    role="button"
                                    tabIndex={0}
                                    aria-label="Upload PDF files"
                                    onClick={() => fileInputRef.current?.click()}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
                                    onDragOver={handleDragOver}
                                    onDragEnter={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    style={{ minHeight: '200px' }}
                                >
                                    <input
                                        type="file"
                                        multiple
                                        accept=".pdf,application/pdf"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        style={{ display: 'none' }}
                                    />
                                    <div className="upload-icon-wrapper">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                    </div>
                                    <span style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                        {isDragging ? 'Drop your PDFs here' : files.length === 0 ? 'Select PDF files to merge' : 'Add more PDFs'}
                                    </span>
                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                                        Click to browse or drag and drop
                                    </span>
                                </div>

                                {files.length >= 2 && (
                                    <div className="flex-center">
                                        <button onClick={handleProceedToConfig} className="btn-action">
                                            Configure & Merge PDFs
                                        </button>
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
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Merging PDFs...</h3>
                                <p className="workspace-desc">{progressStatus || `Combining ${files.length} files into one.`}</p>
                                <button onClick={handleCancel} className="btn-secondary" style={{ marginTop: '1rem' }}>Cancel</button>
                            </div>
                        ) : (
                            <div className="result-area animate-fade-in">
                                <div className="success-check-animated">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="#fff" width="28" height="28">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                </div>
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Merge Complete!</h3>

                                {resultBlob && (
                                    <div style={{ padding: '1rem 1.5rem', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', margin: '1.5rem auto', maxWidth: '360px', fontSize: '0.875rem' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                            {files[0]?.name.replace(/\.pdf$/i, '') || 'document'}_merged.pdf
                                        </div>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                                            {formatFileSize(resultSize)} &bull; {files.length} PDFs merged
                                        </div>
                                    </div>
                                )}

                                <p className="workspace-desc" style={{ marginBottom: '2rem' }}>
                                    Your file has been downloaded. Check your downloads folder.
                                </p>
                                <div className="action-row">
                                    <button onClick={handleDownloadAgain} className="btn-secondary btn-primary-alt">Download Again</button>
                                    <button onClick={handleReset} className="btn-secondary">Merge More PDFs</button>
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

export default MergePDF;
