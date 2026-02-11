/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Remove Background Component
 * AI-powered background removal (briaai/RMBG-1.4) with silent canvas fallback
 * Upload → Processing → Done. No configuration needed.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tool, ProcessState } from '../types';
import { removeBackground, downloadBlob } from '../services/imageService';
import { formatFileSize } from '../utils/formatFileSize';
import { useWakeLock, usePageVisibility } from '../hooks/usePageVisibility';
import { toast } from '../hooks/useToast';
import BackButton from './BackButton';
import StepProgress from './StepProgress';

interface RemoveBackgroundProps {
    tool: Tool;
    onBack: () => void;
}

const STEPS = [
    { label: 'Upload' },
    { label: 'Processing' },
    { label: 'Complete' },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'image/heif', 'image/bmp', 'image/tiff'];

/** Sanitize filename: strip path traversal, control chars, limit length */
const sanitizeFilename = (name: string): string => {
    return name
        .replace(/[/\\:*?"<>|]/g, '_')
        .replace(/\.\./g, '_')
        .replace(/[\x00-\x1f\x7f]/g, '')
        .slice(0, 200);
};

const RemoveBackground: React.FC<RemoveBackgroundProps> = ({ tool, onBack }) => {
    const [state, setState] = useState<ProcessState>(ProcessState.IDLE);
    const [file, setFile] = useState<File | null>(null);
    const [originalPreview, setOriginalPreview] = useState<string>('');
    const [processedPreview, setProcessedPreview] = useState<string>('');
    const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);

    // ML progress state
    const [mlProgress, setMlProgress] = useState<number>(0);
    const [mlStatus, setMlStatus] = useState<string>('');
    const [fallbackUsed, setFallbackUsed] = useState(false);
    const [elapsedSec, setElapsedSec] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const mountedRef = useRef(true);
    const processingRef = useRef(false);

    const isProcessing = state === ProcessState.CONVERTING;
    useWakeLock(isProcessing);
    usePageVisibility();

    // Reset on mount (including HMR re-mount where refs persist but cleanup ran)
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Elapsed-time counter while processing (ticks every 1s)
    useEffect(() => {
        if (!isProcessing) {
            setElapsedSec(0);
            return;
        }
        const t = setInterval(() => setElapsedSec(s => s + 1), 1000);
        return () => clearInterval(t);
    }, [isProcessing]);

    // Cleanup blob URLs on unmount or change
    useEffect(() => {
        return () => {
            if (originalPreview) URL.revokeObjectURL(originalPreview);
            if (processedPreview) URL.revokeObjectURL(processedPreview);
        };
    }, [originalPreview, processedPreview]);

    const currentStep = !file ? -1 :
        state === ProcessState.CONVERTING ? 1 :
        state === ProcessState.COMPLETED ? 2 : 0;

    const validateAndSetFile = useCallback((selectedFile: File) => {
        if (!selectedFile.type || !ALLOWED_TYPES.includes(selectedFile.type)) {
            setErrorMsg('Please select a valid image file (PNG, JPG, WebP, HEIC, BMP, or TIFF).');
            return;
        }

        if (selectedFile.size === 0) {
            setErrorMsg('The selected file is empty.');
            return;
        }

        if (selectedFile.size > MAX_FILE_SIZE) {
            setErrorMsg(`Image is too large (${formatFileSize(selectedFile.size)}). Maximum size is 10MB.`);
            return;
        }

        // Revoke previous preview URLs
        if (originalPreview) URL.revokeObjectURL(originalPreview);
        if (processedPreview) URL.revokeObjectURL(processedPreview);

        const previewUrl = URL.createObjectURL(selectedFile);

        setFile(selectedFile);
        setOriginalPreview(previewUrl);
        setState(ProcessState.IDLE);
        setErrorMsg('');
        setProcessedPreview('');
        setProcessedBlob(null);
    }, [originalPreview, processedPreview]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0]);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [validateAndSetFile]);

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

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            validateAndSetFile(droppedFile);
        }
    }, [validateAndSetFile]);

    const handleRemoveBackground = useCallback(async () => {
        if (!file || processingRef.current) return;
        processingRef.current = true;

        setState(ProcessState.CONVERTING);
        setErrorMsg('');
        setMlProgress(0);
        setMlStatus('');
        setFallbackUsed(false);

        // Revoke previous processed preview to prevent leak on re-process
        if (processedPreview) URL.revokeObjectURL(processedPreview);
        setProcessedPreview('');
        setProcessedBlob(null);

        try {
            const result = await removeBackground(file, {
                onProgress: (progress, status) => {
                    if (mountedRef.current) {
                        setMlProgress(progress);
                        setMlStatus(status);
                    }
                },
            });

            if (!mountedRef.current) return;

            const url = URL.createObjectURL(result.blob);
            setProcessedBlob(result.blob);
            setProcessedPreview(url);
            setFallbackUsed(result.fallbackUsed);
            setState(ProcessState.COMPLETED);

            // Auto-download with sanitized filename
            const rawName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const safeName = sanitizeFilename(rawName);
            downloadBlob(result.blob, `${safeName}_no_bg.png`);

            toast.success('Background removed successfully!');
        } catch (err) {
            if (!mountedRef.current) return;

            const errorMessage = err instanceof Error ? err.message : 'Failed to remove background. Please try again.';
            setErrorMsg(errorMessage);
            setState(ProcessState.IDLE);
            setMlProgress(0);
            setMlStatus('');
            toast.error('Background removal failed.');
        } finally {
            processingRef.current = false;
        }
    }, [file, processedPreview]);

    const handleDownload = useCallback(() => {
        if (!processedBlob || !file) return;

        const rawName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const safeName = sanitizeFilename(rawName);
        downloadBlob(processedBlob, `${safeName}_no_bg.png`);
    }, [processedBlob, file]);

    const handleReset = useCallback(() => {
        if (originalPreview) URL.revokeObjectURL(originalPreview);
        if (processedPreview) URL.revokeObjectURL(processedPreview);

        setState(ProcessState.IDLE);
        setFile(null);
        setOriginalPreview('');
        setProcessedPreview('');
        setProcessedBlob(null);
        setErrorMsg('');
        setMlProgress(0);
        setMlStatus('');
        setFallbackUsed(false);
    }, [originalPreview, processedPreview]);

    return (
        <div className="detail-view animate-fade-in">
            <div className="container">

                <BackButton onBack={onBack} />

                <StepProgress steps={STEPS} currentStep={currentStep} />

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
                            <div className="error-msg" role="alert" aria-live="assertive">
                                {errorMsg}
                            </div>
                        )}

                        {state === ProcessState.IDLE ? (
                            <div>
                                <div
                                    className={`upload-zone${file ? ' active' : ''}${isDragging ? ' drag-over' : ''}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
                                    aria-label="Upload image for background removal"
                                >
                                    <input
                                        type="file"
                                        className="hidden"
                                        style={{ display: 'none' }}
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        accept="image/png,image/jpeg,image/webp,image/heic,image/heif,image/bmp,image/tiff"
                                    />

                                    {file ? (
                                        <div className="file-preview">
                                            <div className="upload-icon-wrapper" style={{ color: 'var(--text-primary)', background: 'transparent' }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-xl">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                                </svg>
                                            </div>
                                            <span className="file-name">{file.name}</span>
                                            <span className="file-size">{formatFileSize(file.size)}</span>
                                            <span className="label-text" style={{ fontSize: '0.875rem' }}>Click to change image</span>
                                        </div>
                                    ) : (
                                        <div className="file-preview" style={{ cursor: 'pointer' }}>
                                            <div className="upload-icon-wrapper">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                                </svg>
                                            </div>
                                            <span style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                                Drop your image here
                                            </span>
                                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>or click to browse</span>
                                        </div>
                                    )}
                                </div>

                                {originalPreview && (
                                    <div style={{ marginTop: '2rem' }}>
                                        <label className="label-text">Preview</label>
                                        <div style={{
                                            marginTop: '0.5rem',
                                            padding: '1rem',
                                            background: 'var(--surface-light)',
                                            borderRadius: '0.5rem',
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            minHeight: '200px'
                                        }}>
                                            <img
                                                src={originalPreview}
                                                alt={`Preview of ${file?.name || 'image'}`}
                                                style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : state === ProcessState.CONVERTING ? (
                            <div className="result-area" style={{ padding: '3rem 0' }} aria-live="polite" aria-busy="true">
                                <div style={{ maxWidth: '300px', margin: '0 auto 2rem' }}>
                                    <div className="loader">
                                        <div
                                            className="loader-bar"
                                            style={mlProgress > 0 ? {
                                                width: `${mlProgress}%`,
                                                animation: 'none',
                                                transition: 'width 0.3s ease',
                                            } : undefined}
                                        ></div>
                                    </div>
                                    {mlProgress > 0 && (
                                        <div style={{
                                            textAlign: 'center',
                                            marginTop: '1rem',
                                            fontSize: '0.875rem',
                                            color: 'var(--text-secondary)',
                                        }}>
                                            {Math.round(mlProgress)}%
                                        </div>
                                    )}
                                </div>
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>
                                    {mlProgress < 50
                                        ? 'Loading AI Model...'
                                        : 'Removing Background...'}
                                </h3>
                                <p className="workspace-desc">
                                    {mlStatus || 'Analyzing and processing your image'}
                                </p>
                                {elapsedSec > 0 && (
                                    <p style={{
                                        fontSize: '0.8125rem',
                                        color: 'var(--text-tertiary)',
                                        marginTop: '0.75rem',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}>
                                        {elapsedSec}s elapsed
                                        {mlProgress >= 50 && elapsedSec < 30 && ' — usually takes 15-30 seconds'}
                                    </p>
                                )}
                                {mlProgress > 0 && mlProgress < 50 && (
                                    <p style={{
                                        fontSize: '0.8125rem',
                                        color: 'var(--text-tertiary)',
                                        marginTop: '0.5rem',
                                    }}>
                                        First-time model download may take a moment. It will be cached for future use.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="result-area animate-fade-in">
                                <div className="success-check-animated">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-lg">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                </div>
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Background Removed!</h3>
                                <p className="workspace-desc" style={{ marginBottom: '2rem' }}>
                                    Your image has been processed and downloaded automatically
                                </p>

                                {/* Side-by-side comparison */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                                    <div>
                                        <label className="label-text">Original</label>
                                        <div style={{
                                            marginTop: '0.5rem',
                                            padding: '1rem',
                                            background: 'var(--surface-light)',
                                            borderRadius: '0.5rem',
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            minHeight: '150px'
                                        }}>
                                            <img
                                                src={originalPreview}
                                                alt="Original"
                                                style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }}
                                            />
                                        </div>
                                        {file && (
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                                                {formatFileSize(file.size)}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="label-text">No Background</label>
                                        <div style={{
                                            marginTop: '0.5rem',
                                            padding: '1rem',
                                            background: "repeating-conic-gradient(var(--surface-light) 0% 25%, var(--surface-alt, #e5e5e5) 0% 50%) 50% / 20px 20px",
                                            borderRadius: '0.5rem',
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            minHeight: '150px'
                                        }}>
                                            <img
                                                src={processedPreview}
                                                alt="Background removed"
                                                style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }}
                                            />
                                        </div>
                                        {processedBlob && (
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                                                {formatFileSize(processedBlob.size)}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Fallback notification — only if AI was unavailable */}
                                {fallbackUsed && (
                                    <div style={{
                                        padding: '0.75rem 1rem',
                                        background: 'color-mix(in srgb, var(--warning, #f59e0b) 12%, var(--surface-white, #fff))',
                                        border: '1px solid color-mix(in srgb, var(--warning, #f59e0b) 40%, transparent)',
                                        borderRadius: '0.5rem',
                                        marginBottom: '1.5rem',
                                        textAlign: 'center',
                                        fontSize: '0.8125rem',
                                        color: 'var(--text-secondary)',
                                    }}>
                                        AI model was unavailable. A basic algorithm was used instead, which works best with solid-color backgrounds.
                                        Try again later for better results.
                                    </div>
                                )}

                                <div className="action-row">
                                    <button
                                        onClick={handleDownload}
                                        className="btn-secondary btn-primary-alt"
                                    >
                                        Download Again
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (processedPreview) URL.revokeObjectURL(processedPreview);
                                            setProcessedPreview('');
                                            setProcessedBlob(null);
                                            setState(ProcessState.IDLE);
                                            setMlProgress(0);
                                            setMlStatus('');
                                            setFallbackUsed(false);
                                        }}
                                        className="btn-secondary"
                                    >
                                        Try Again
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        className="btn-secondary"
                                    >
                                        New Image
                                    </button>
                                </div>
                            </div>
                        )}

                        {state === ProcessState.IDLE && file && (
                            <div className="flex-center" style={{ marginTop: '1.5rem' }}>
                                <button
                                    onClick={handleRemoveBackground}
                                    disabled={isProcessing}
                                    className="btn-action"
                                >
                                    Remove Background
                                </button>
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

export default RemoveBackground;
