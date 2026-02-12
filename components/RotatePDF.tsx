/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tool, ProcessState, RotatePdfConfig } from '../types';
import { rotatePDF, downloadPDF } from '../services/pdfService';
import { useWakeLock, usePageVisibility } from '../hooks/usePageVisibility';
import { toast } from '../hooks/useToast';
import { formatFileSize } from '../utils/formatFileSize';
import BackButton from './BackButton';
import StepProgress from './StepProgress';

interface RotatePDFProps {
    tool: Tool;
    onBack: () => void;
}

interface PagePreviewData {
    pageNumber: number;
    imageUrl: string;
    rotation: number; // 0, 90, 180, 270
}

const STEPS = [
    { label: 'Upload' },
    { label: 'Rotate' },
    { label: 'Applying' },
    { label: 'Complete' },
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_PREVIEW_PAGES = 50;

const RotatePDF: React.FC<RotatePDFProps> = ({ tool, onBack }) => {
    const [state, setState] = useState<ProcessState>(ProcessState.IDLE);
    const [file, setFile] = useState<File | null>(null);
    const [pages, setPages] = useState<PagePreviewData[]>([]);
    const [totalPageCount, setTotalPageCount] = useState<number>(0);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [isLoadingPreviews, setIsLoadingPreviews] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [progress, setProgress] = useState<number>(0);
    const [progressStatus, setProgressStatus] = useState<string>('');
    const [resultBlob, setResultBlob] = useState<Uint8Array | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const mountedRef = useRef(true);

    const isProcessing = state === ProcessState.CONVERTING;
    useWakeLock(isProcessing);
    usePageVisibility();

    // 🔒 MEMORY FIX: Cleanup on unmount
    useEffect(() => {
        return () => {
            mountedRef.current = false;
            // Revoke all blob URLs to prevent memory leaks
            pages.forEach(page => {
                if (page.imageUrl.startsWith('blob:')) {
                    try {
                        URL.revokeObjectURL(page.imageUrl);
                    } catch { /* ignore */ }
                }
            });
        };
    }, [pages]);

    const hasRotations = pages.some(p => p.rotation !== 0);

    const currentStep = !file ? -1 :
        isLoadingPreviews ? 0 :
        pages.length > 0 && state === ProcessState.IDLE ? 1 :
        state === ProcessState.CONVERTING ? 2 :
        state === ProcessState.COMPLETED ? 3 : 0;

    const validateAndSetFile = useCallback((selectedFile: File) => {
        if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
            setErrorMsg('Please select a valid PDF file.');
            return;
        }
        if (selectedFile.size === 0) {
            setErrorMsg('The selected file is empty (0 bytes). Please select a valid PDF file.');
            return;
        }
        if (selectedFile.size > MAX_FILE_SIZE) {
            setErrorMsg(`File is too large (${formatFileSize(selectedFile.size)}). Maximum size is 150MB.`);
            return;
        }
        setFile(selectedFile);
        setState(ProcessState.IDLE);
        setErrorMsg('');
        setProgress(0);
        setProgressStatus('');
        setResultBlob(null);
        setPages([]);
        loadPDFPreviews(selectedFile);
    }, []);

    const loadPDFPreviews = async (pdfFile: File) => {
        setIsLoadingPreviews(true);
        setErrorMsg('');

        // 🔒 MEMORY FIX: Revoke old preview URLs before loading new ones
        pages.forEach(page => {
            if (page.imageUrl.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(page.imageUrl);
                } catch { /* ignore */ }
            }
        });

        try {
            const arrayBuffer = await pdfFile.arrayBuffer();

            // Magic byte validation (reuse the same arrayBuffer)
            const header = new Uint8Array(arrayBuffer, 0, Math.min(5, arrayBuffer.byteLength));
            if (String.fromCharCode(...header).indexOf('%PDF') !== 0) {
                setErrorMsg('This file does not appear to be a valid PDF (invalid file header).');
                setFile(null);
                setIsLoadingPreviews(false);
                return;
            }

            const { pdfjsLib } = await import('../services/pdfConfig');
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;

            try {
                const numPages = pdf.numPages;
                if (!mountedRef.current) return;

                setTotalPageCount(numPages);
                const pagesToRender = Math.min(numPages, MAX_PREVIEW_PAGES);
                const allPreviews: PagePreviewData[] = [];

                // 🔒 PERFORMANCE FIX: Load previews in batches to prevent memory spikes
                // Process 10 pages at a time instead of loading all 100 at once
                const BATCH_SIZE = 10;
                for (let batchStart = 1; batchStart <= pagesToRender; batchStart += BATCH_SIZE) {
                    if (!mountedRef.current) return;

                    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, pagesToRender);

                    for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
                    if (!mountedRef.current) return;

                    const page = await pdf.getPage(pageNum);
                    const scale = 0.3;
                    const viewport = page.getViewport({ scale });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');

                    if (!context) continue;

                    canvas.width = viewport.width;
                    canvas.height = viewport.height;

                    // 🔒 SECURITY FIX: Timeout protection for page rendering (30s per page)
                    // Prevents indefinite hanging on corrupted PDFs
                    await Promise.race([
                        page.render({ canvasContext: context, viewport }).promise,
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error(`Page ${pageNum} rendering timed out. The PDF may be corrupted.`)), 30000)
                        )
                    ]);

                    // 🔒 MEMORY FIX: Use blob URLs instead of data URLs for better memory management
                    // Data URLs (base64) can be several MB per page and stay in memory
                    // Blob URLs are more memory-efficient and can be explicitly revoked
                    // 🔒 SECURITY FIX: Handle null blob case
                    const blob = await new Promise<Blob>((resolve, reject) => {
                        canvas.toBlob((b) => {
                            if (b) {
                                resolve(b);
                            } else {
                                reject(new Error('Failed to create blob from canvas'));
                            }
                        }, 'image/jpeg', 0.7);
                    });
                    const imageUrl = URL.createObjectURL(blob);

                    // 🔒 MEMORY FIX: Aggressively cleanup canvas
                    // Reset dimensions first, then null the context reference
                    canvas.width = 0;
                    canvas.height = 0;
                    context.clearRect(0, 0, 0, 0);

                        allPreviews.push({
                            pageNumber: pageNum,
                            imageUrl,
                            rotation: 0,
                        });
                    }

                    // Update state after each batch for better UX (progressive loading)
                    if (mountedRef.current) {
                        setPages([...allPreviews]);
                    }
                }

                if (!mountedRef.current) return;
            } finally {
                pdf.destroy();
            }
        } catch (err) {
            if (!mountedRef.current) return;
            const errorMessage = err instanceof Error ? err.message : 'Failed to read PDF';
            if (errorMessage.includes('password') || errorMessage.includes('encrypted')) {
                setErrorMsg('This PDF is password-protected. Please unlock it first using the Unlock PDF tool.');
            } else {
                setErrorMsg('Failed to read PDF. Please select a valid PDF file.');
            }
            setFile(null);
            setPages([]);
        } finally {
            if (mountedRef.current) setIsLoadingPreviews(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
    const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        if (e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]);
    }, [validateAndSetFile]);

    const rotatePage = (pageNumber: number, direction: 'left' | 'right') => {
        setPages(prev => prev.map(page => {
            if (page.pageNumber === pageNumber) {
                const change = direction === 'right' ? 90 : -90;
                return { ...page, rotation: (page.rotation + change + 360) % 360 };
            }
            return page;
        }));
    };

    const rotateAllPages = (direction: 'left' | 'right') => {
        setPages(prev => prev.map(page => {
            const change = direction === 'right' ? 90 : -90;
            return { ...page, rotation: (page.rotation + change + 360) % 360 };
        }));
    };

    const resetRotations = () => {
        setPages(prev => prev.map(page => ({ ...page, rotation: 0 })));
    };

    const handleApplyRotations = async () => {
        if (!file || !hasRotations) {
            setErrorMsg('Please rotate at least one page before applying.');
            return;
        }

        setState(ProcessState.CONVERTING);
        setErrorMsg('');
        setProgress(0);
        setResultBlob(null);

        try {
            // Group pages by rotation angle (skip pages with 0 rotation)
            const rotationGroups = new Map<number, number[]>();

            pages.forEach(page => {
                if (page.rotation !== 0) {
                    const rot = page.rotation;
                    if (!rotationGroups.has(rot)) rotationGroups.set(rot, []);
                    rotationGroups.get(rot)!.push(page.pageNumber);
                }
            });

            // If there are non-previewed pages and all visible pages have the same rotation,
            // apply that rotation to remaining pages too (user used "Rotate All")
            if (totalPageCount > MAX_PREVIEW_PAGES) {
                const uniqueRotations = new Set(pages.map(p => p.rotation));
                if (uniqueRotations.size === 1 && pages[0].rotation !== 0) {
                    const rot = pages[0].rotation;
                    const existing = rotationGroups.get(rot) || [];
                    for (let i = MAX_PREVIEW_PAGES + 1; i <= totalPageCount; i++) {
                        existing.push(i);
                    }
                    rotationGroups.set(rot, existing);
                }
            }

            const totalGroups = rotationGroups.size;
            let groupIndex = 0;
            let currentBytes: ArrayBuffer | Uint8Array = await file.arrayBuffer();

            for (const [rotation, pageNumbers] of rotationGroups.entries()) {
                if (!mountedRef.current) return;

                groupIndex++;
                const pct = Math.round((groupIndex / totalGroups) * 80) + 10;
                setProgress(pct);
                setProgressStatus(`Applying ${rotation}\u00B0 rotation to ${pageNumbers.length} page${pageNumbers.length > 1 ? 's' : ''}...`);

                const currentFile = new File([currentBytes], file.name, { type: 'application/pdf' });
                const config: RotatePdfConfig = {
                    rotation: rotation as 90 | 180 | 270,
                    pageSelection: 'specific',
                    pageNumbers,
                };
                currentBytes = await rotatePDF(currentFile, config);
            }

            if (!mountedRef.current) return;

            setProgress(100);
            setProgressStatus('Rotation complete!');

            const resultData = currentBytes instanceof Uint8Array ? currentBytes : new Uint8Array(currentBytes);
            setResultBlob(resultData);
            setState(ProcessState.COMPLETED);

            const baseName = file.name.replace(/\.pdf$/i, '');
            downloadPDF(resultData, `${baseName}_rotated.pdf`);
            toast.success('PDF rotated successfully!');
        } catch (err) {
            if (!mountedRef.current) return;

            let errorMessage = 'An unknown error occurred';
            if (err instanceof Error) {
                errorMessage = err.message;
                if (err.message.includes('password') || err.message.includes('encrypted')) {
                    errorMessage = 'This PDF is password-protected. Please unlock it first.';
                }
            }
            setErrorMsg(errorMessage);
            toast.error('Rotation failed');
            setState(ProcessState.IDLE);
            setProgress(0);
            setProgressStatus('');
        }
    };

    const handleDownloadAgain = () => {
        if (!resultBlob || !file) return;
        const baseName = file.name.replace(/\.pdf$/i, '');
        downloadPDF(resultBlob, `${baseName}_rotated.pdf`);
        toast.success('Download started!');
    };

    const handleReset = () => {
        // 🔒 MEMORY FIX: Revoke blob URLs before clearing state
        pages.forEach(page => {
            if (page.imageUrl.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(page.imageUrl);
                } catch { /* ignore */ }
            }
        });

        setState(ProcessState.IDLE);
        setFile(null);
        setPages([]);
        setTotalPageCount(0);
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
                                    {file && pages.length > 0 && (
                                        <button onClick={handleApplyRotations} style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                            Try Again
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {state === ProcessState.IDLE || state === ProcessState.UPLOADING ? (
                            <>
                                {file && pages.length > 0 ? (
                                    <div>
                                        {/* File Info and Controls */}
                                        <div style={{ padding: '1.5rem', background: 'var(--surface-light)', borderRadius: 'var(--radius-md)', marginBottom: '2rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                                                <div>
                                                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</div>
                                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                        <span className="file-size">{formatFileSize(file.size)}</span>
                                                        <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                                                            {totalPageCount} page{totalPageCount !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    <button onClick={() => rotateAllPages('left')} className="btn-secondary" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                                        </svg>
                                                        All Left
                                                    </button>
                                                    <button onClick={() => rotateAllPages('right')} className="btn-secondary" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        All Right
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                                                        </svg>
                                                    </button>
                                                    <button onClick={resetRotations} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                                                        Reset
                                                    </button>
                                                </div>
                                            </div>

                                            <div style={{ padding: '1rem', background: 'var(--info-bg)', border: '1px solid color-mix(in srgb, var(--info) 40%, transparent)', borderRadius: 'var(--radius-sm)' }}>
                                                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                                                    <strong>How to use:</strong> Click the rotation arrows below each page to rotate it. Use the buttons above to rotate all pages at once.
                                                </div>
                                            </div>
                                        </div>

                                        {/* Page Previews Grid */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                                            {pages.map((page) => (
                                                <div
                                                    key={page.pageNumber}
                                                    style={{
                                                        border: `2px solid ${page.rotation !== 0 ? 'var(--accent)' : 'var(--border-color)'}`,
                                                        borderRadius: 'var(--radius-md)',
                                                        padding: '1rem',
                                                        background: 'var(--surface-white)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: '0.75rem',
                                                        transition: 'border-color 0.2s',
                                                    }}
                                                >
                                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        Page {page.pageNumber}
                                                        {page.rotation !== 0 && (
                                                            <span style={{ marginLeft: '0.5rem', color: 'var(--success)', fontSize: '0.75rem' }}>
                                                                ({page.rotation}&deg;)
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div style={{
                                                        width: '100%',
                                                        aspectRatio: '1',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        overflow: 'hidden',
                                                        background: 'var(--surface-light)',
                                                        borderRadius: 'var(--radius-sm)',
                                                    }}>
                                                        <img
                                                            src={page.imageUrl}
                                                            alt={`Page ${page.pageNumber}`}
                                                            style={{
                                                                maxWidth: '100%',
                                                                maxHeight: '100%',
                                                                transform: `rotate(${page.rotation}deg)`,
                                                                transition: 'transform 0.3s ease',
                                                            }}
                                                        />
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                                                        <button
                                                            onClick={() => rotatePage(page.pageNumber, 'left')}
                                                            className="btn-secondary"
                                                            style={{ flex: 1, padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                            title="Rotate left 90\u00B0"
                                                            aria-label={`Rotate page ${page.pageNumber} left 90 degrees`}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => rotatePage(page.pageNumber, 'right')}
                                                            className="btn-secondary"
                                                            style={{ flex: 1, padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                            title="Rotate right 90\u00B0"
                                                            aria-label={`Rotate page ${page.pageNumber} right 90 degrees`}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {totalPageCount > MAX_PREVIEW_PAGES && (
                                            <div style={{ textAlign: 'center', padding: '1rem', marginBottom: '1.5rem', background: 'var(--info-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid color-mix(in srgb, var(--info) 40%, transparent)' }}>
                                                <span style={{ fontSize: '0.875rem', color: 'var(--info)' }}>
                                                    Showing first {MAX_PREVIEW_PAGES} of {totalPageCount} pages. Use &quot;All Left&quot; / &quot;All Right&quot; to rotate all pages uniformly.
                                                </span>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            <button
                                                onClick={handleApplyRotations}
                                                className="btn-action"
                                                style={{ flex: 1, maxWidth: 'none', marginTop: 0, opacity: hasRotations ? 1 : 0.5 }}
                                                disabled={!hasRotations}
                                            >
                                                Apply Rotations
                                            </button>
                                            <button onClick={handleReset} className="btn-secondary" style={{ flex: 1, maxWidth: 'none' }}>
                                                Select Different PDF
                                            </button>
                                        </div>
                                    </div>
                                ) : isLoadingPreviews ? (
                                    <div className="result-area" style={{ padding: '3rem 0' }} aria-live="polite">
                                        <div style={{ maxWidth: '200px', margin: '0 auto 2rem' }}>
                                            <div className="loader"><div className="loader-bar"></div></div>
                                        </div>
                                        <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Loading PDF...</h3>
                                        <p className="workspace-desc">Generating page previews.</p>
                                    </div>
                                ) : (
                                    <div
                                        className={`upload-zone${isDragging ? ' drag-over' : ''}`}
                                        role="button" tabIndex={0} aria-label="Upload PDF file"
                                        onClick={() => fileInputRef.current?.click()}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
                                        onDragOver={handleDragOver} onDragEnter={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                                    >
                                        <input type="file" accept=".pdf,application/pdf" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />
                                        <div className="upload-icon-wrapper">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                            </svg>
                                        </div>
                                        <span style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                            {isDragging ? 'Drop your PDF here' : 'Select a PDF to rotate'}
                                        </span>
                                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Click to browse or drag and drop</span>
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
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Rotating PDF...</h3>
                                <p className="workspace-desc">{progressStatus || 'Applying rotations to your document.'}</p>
                            </div>
                        ) : (
                            <div className="result-area animate-fade-in">
                                <div className="success-check-animated">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="#fff" width="28" height="28">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                </div>
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Rotation Complete!</h3>

                                {file && resultBlob && (
                                    <div style={{ padding: '1rem 1.5rem', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', margin: '1.5rem auto', maxWidth: '360px', fontSize: '0.875rem' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                            {file.name.replace(/\.pdf$/i, '_rotated.pdf')}
                                        </div>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                                            {formatFileSize(resultBlob.length)}
                                        </div>
                                    </div>
                                )}

                                <p className="workspace-desc" style={{ marginBottom: '2rem' }}>Your file has been downloaded. Check your downloads folder.</p>
                                <div className="action-row">
                                    <button onClick={handleDownloadAgain} className="btn-secondary btn-primary-alt">Download Again</button>
                                    <button onClick={handleReset} className="btn-secondary">Rotate Another PDF</button>
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

export default RotatePDF;
