/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Image Converter Component
 * Handles JPG-to-PNG, PNG-to-JPG, and HEIC-to-JPG conversions
 * Production-grade with proper memory management, accessibility, and dark mode support
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tool, ProcessState } from '../types';
import { convertToPNG, convertToJPG, convertHEICToJPG, downloadBlob } from '../services/imageService';
import { formatFileSize } from '../utils/formatFileSize';
import { useWakeLock, usePageVisibility } from '../hooks/usePageVisibility';
import { toast } from '../hooks/useToast';
import BackButton from './BackButton';
import StepProgress from './StepProgress';

interface ImageConverterProps {
    tool: Tool;
    onBack: () => void;
}

const STEPS = [
    { label: 'Upload' },
    { label: 'Configure' },
    { label: 'Converting' },
    { label: 'Complete' },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for images

const ImageConverter: React.FC<ImageConverterProps> = ({ tool, onBack }) => {
    const [state, setState] = useState<ProcessState>(ProcessState.IDLE);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string>('');
    const [convertedPreview, setConvertedPreview] = useState<string>('');
    const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
    const [quality, setQuality] = useState<number>(92);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const mountedRef = useRef(true);

    const isJPGConversion = tool.id === 'png-jpg' || tool.id === 'heic-jpg';
    const targetFormat = isJPGConversion ? 'JPG' : 'PNG';
    const sourceFormat = tool.id === 'jpg-png' ? 'JPG' : tool.id === 'png-jpg' ? 'PNG' : 'HEIC';

    const isProcessing = state === ProcessState.CONVERTING;
    useWakeLock(isProcessing);
    usePageVisibility();

    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Cleanup blob URLs on unmount or change
    useEffect(() => {
        return () => {
            if (preview) URL.revokeObjectURL(preview);
            if (convertedPreview) URL.revokeObjectURL(convertedPreview);
        };
    }, [preview, convertedPreview]);

    const currentStep = !file ? -1 :
        state === ProcessState.CONVERTING ? 2 :
        state === ProcessState.COMPLETED ? 3 : 1;

    const getAcceptType = useCallback(() => {
        if (tool.id === 'jpg-png') return 'image/jpeg,image/jpg';
        if (tool.id === 'png-jpg') return 'image/png';
        if (tool.id === 'heic-jpg') return 'image/heic,image/heif';
        return 'image/*';
    }, [tool.id]);

    const validateAndSetFile = useCallback((selectedFile: File) => {
        if (!selectedFile.type.startsWith('image/')) {
            setErrorMsg('Please select a valid image file.');
            return;
        }

        if (selectedFile.size > MAX_FILE_SIZE) {
            setErrorMsg(`Image is too large (${formatFileSize(selectedFile.size)}). Maximum size is 10MB.`);
            return;
        }

        // Revoke previous preview URL
        if (preview) URL.revokeObjectURL(preview);
        if (convertedPreview) URL.revokeObjectURL(convertedPreview);

        const previewUrl = URL.createObjectURL(selectedFile);

        setFile(selectedFile);
        setPreview(previewUrl);
        setState(ProcessState.IDLE);
        setErrorMsg('');
        setConvertedBlob(null);
        setConvertedPreview('');
    }, [preview, convertedPreview]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0]);
            // Reset file input so same file can be re-selected
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

    const handleConvert = useCallback(async () => {
        if (!file) return;

        setState(ProcessState.CONVERTING);
        setErrorMsg('');

        try {
            let blob: Blob;

            if (tool.id === 'jpg-png') {
                blob = await convertToPNG(file);
            } else if (tool.id === 'png-jpg') {
                blob = await convertToJPG(file, quality / 100);
            } else if (tool.id === 'heic-jpg') {
                blob = await convertHEICToJPG(file, quality / 100);
            } else {
                throw new Error('Unknown conversion type');
            }

            if (!mountedRef.current) return;

            // Create preview URL for converted image
            const convertedUrl = URL.createObjectURL(blob);

            setConvertedBlob(blob);
            setConvertedPreview(convertedUrl);
            setState(ProcessState.COMPLETED);

            // Auto-download
            const namePart = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const extension = isJPGConversion ? 'jpg' : 'png';
            downloadBlob(blob, `${namePart}.${extension}`);

            toast.success(`Image converted to ${targetFormat} successfully!`);
        } catch (err) {
            if (!mountedRef.current) return;

            const errorMessage = err instanceof Error ? err.message : 'Failed to convert image. Please try again.';
            setErrorMsg(errorMessage);
            setState(ProcessState.IDLE);
            toast.error('Conversion failed. Please try again.');
        }
    }, [file, tool.id, quality, isJPGConversion, targetFormat]);

    const handleDownload = useCallback(() => {
        if (!convertedBlob || !file) return;

        const namePart = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const extension = isJPGConversion ? 'jpg' : 'png';
        downloadBlob(convertedBlob, `${namePart}.${extension}`);
    }, [convertedBlob, file, isJPGConversion]);

    const handleReset = useCallback(() => {
        if (preview) URL.revokeObjectURL(preview);
        if (convertedPreview) URL.revokeObjectURL(convertedPreview);

        setState(ProcessState.IDLE);
        setFile(null);
        setPreview('');
        setConvertedPreview('');
        setConvertedBlob(null);
        setErrorMsg('');
    }, [preview, convertedPreview]);

    return (
        <div className="detail-view animate-fade-in">
            <div className="container">

                {/* Navigation */}
                <BackButton onBack={onBack} />

                {/* Step Progress */}
                <StepProgress steps={STEPS} currentStep={currentStep} />

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
                                    aria-label={`Upload ${sourceFormat} image for conversion`}
                                >
                                    <input
                                        type="file"
                                        className="hidden"
                                        style={{ display: 'none' }}
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        accept={getAcceptType()}
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
                                            <span className="label-text" style={{ fontSize: '0.875rem' }}>Ready to convert to {targetFormat}</span>
                                        </div>
                                    ) : (
                                        <div className="file-preview" style={{ cursor: 'pointer' }}>
                                            <div className="upload-icon-wrapper">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                                </svg>
                                            </div>
                                            <span style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                                Drop your {sourceFormat} image here
                                            </span>
                                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>or click to browse</span>
                                        </div>
                                    )}
                                </div>

                                {preview && (
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
                                                src={preview}
                                                alt={`Preview of ${file?.name || 'image'}`}
                                                style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }}
                                            />
                                        </div>

                                        {isJPGConversion && (
                                            <div style={{ marginTop: '1.5rem' }}>
                                                <label className="label-text">
                                                    Quality: {quality}%
                                                </label>
                                                <input
                                                    type="range"
                                                    min="50"
                                                    max="100"
                                                    value={quality}
                                                    onChange={(e) => setQuality(Number(e.target.value))}
                                                    style={{
                                                        width: '100%',
                                                        marginTop: '0.5rem',
                                                        accentColor: 'var(--accent)'
                                                    }}
                                                />
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                                                    <span>Smaller file</span>
                                                    <span>Best quality</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : state === ProcessState.CONVERTING ? (
                            <div className="result-area" style={{ padding: '3rem 0' }}>
                                <div style={{ maxWidth: '200px', margin: '0 auto 2rem' }}>
                                    <div className="loader">
                                        <div className="loader-bar"></div>
                                    </div>
                                </div>
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Converting...</h3>
                                <p className="workspace-desc">Converting to {targetFormat} format</p>
                            </div>
                        ) : (
                            <div className="result-area animate-fade-in">
                                <div className="success-check-animated">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-lg">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                </div>
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Conversion Complete!</h3>
                                <p className="workspace-desc" style={{ marginBottom: '2rem' }}>
                                    Your image has been converted to {targetFormat} successfully
                                </p>

                                {/* Side-by-side comparison */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                                    <div>
                                        <label className="label-text">Original ({sourceFormat})</label>
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
                                                src={preview}
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
                                        <label className="label-text">Converted ({targetFormat})</label>
                                        <div style={{
                                            marginTop: '0.5rem',
                                            padding: '1rem',
                                            background: targetFormat === 'PNG'
                                                ? "repeating-conic-gradient(var(--surface-light) 0% 25%, var(--surface-alt, #e5e5e5) 0% 50%) 50% / 20px 20px"
                                                : 'var(--surface-light)',
                                            borderRadius: '0.5rem',
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            minHeight: '150px'
                                        }}>
                                            <img
                                                src={convertedPreview}
                                                alt="Converted"
                                                style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }}
                                            />
                                        </div>
                                        {convertedBlob && (
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                                                {formatFileSize(convertedBlob.size)}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Size comparison */}
                                {file && convertedBlob && (
                                    <div style={{
                                        padding: '0.75rem 1rem',
                                        background: 'var(--surface-light)',
                                        borderRadius: '0.5rem',
                                        marginBottom: '1.5rem',
                                        textAlign: 'center',
                                        fontSize: '0.875rem',
                                        color: 'var(--text-secondary)',
                                    }}>
                                        <strong style={{ color: 'var(--text-primary)' }}>{formatFileSize(file.size)}</strong>
                                        {' '}→{' '}
                                        <strong style={{ color: 'var(--success)' }}>{formatFileSize(convertedBlob.size)}</strong>
                                        {convertedBlob.size < file.size && (
                                            <span style={{ color: 'var(--success)', marginLeft: '0.5rem' }}>
                                                ({Math.round((1 - convertedBlob.size / file.size) * 100)}% smaller)
                                            </span>
                                        )}
                                        {convertedBlob.size > file.size && (
                                            <span style={{ color: 'var(--text-tertiary)', marginLeft: '0.5rem' }}>
                                                ({Math.round((convertedBlob.size / file.size - 1) * 100)}% larger)
                                            </span>
                                        )}
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
                                        onClick={handleReset}
                                        className="btn-secondary"
                                    >
                                        Convert Another
                                    </button>
                                </div>
                            </div>
                        )}

                        {state === ProcessState.IDLE && file && (
                            <div className="flex-center" style={{ marginTop: '1.5rem' }}>
                                <button
                                    onClick={handleConvert}
                                    className="btn-action"
                                >
                                    Convert to {targetFormat}
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

export default ImageConverter;
