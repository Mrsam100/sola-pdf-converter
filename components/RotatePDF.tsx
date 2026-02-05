/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Tool, ProcessState, RotatePdfConfig, ConversionStep } from '../types';
import { rotatePDF, downloadPDF } from '../services/pdfService';
import { RotatePdfConfig as RotatePdfConfigComponent } from './config/RotatePdfConfig';

interface RotatePDFProps {
    tool: Tool;
    onBack: () => void;
}

interface PagePreview {
    pageNumber: number;
    imageUrl: string;
    rotation: number; // 0, 90, 180, 270
}

const RotatePDF: React.FC<RotatePDFProps> = ({ tool, onBack }) => {
    const [state, setState] = useState<ProcessState>(ProcessState.IDLE);
    const [conversionStep, setConversionStep] = useState<ConversionStep>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [pages, setPages] = useState<PagePreview[]>([]);
    const [config, setConfig] = useState<RotatePdfConfig | undefined>(undefined);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [isLoadingPreviews, setIsLoadingPreviews] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setState(ProcessState.IDLE);
            setErrorMsg('');

            await loadPDFPreviews(selectedFile);
        }
    };

    const loadPDFPreviews = async (file: File) => {
        setIsLoadingPreviews(true);
        setErrorMsg('');

        try {
            const { pdfjsLib } = await import('../services/pdfConfig');

            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;

            const previews: PagePreview[] = [];

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);

                // Render at smaller scale for thumbnails
                const scale = 0.5;
                const viewport = page.getViewport({ scale });

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');

                if (!context) continue;

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({
                    canvasContext: context,
                    viewport: viewport,
                    canvas: canvas
                }).promise;

                const imageUrl = canvas.toDataURL('image/jpeg', 0.8);

                previews.push({
                    pageNumber: pageNum,
                    imageUrl,
                    rotation: 0
                });
            }

            setPages(previews);
        } catch (error) {
            console.error('Failed to load PDF previews:', error);
            setErrorMsg('Failed to read PDF. Please select a valid PDF file.');
            setFile(null);
            setPages([]);
        } finally {
            setIsLoadingPreviews(false);
        }
    };

    const rotatePage = (pageNumber: number, direction: 'left' | 'right') => {
        setPages(prevPages =>
            prevPages.map(page => {
                if (page.pageNumber === pageNumber) {
                    const change = direction === 'right' ? 90 : -90;
                    const newRotation = (page.rotation + change + 360) % 360;
                    return { ...page, rotation: newRotation };
                }
                return page;
            })
        );
    };

    const rotateAllPages = (direction: 'left' | 'right') => {
        setPages(prevPages =>
            prevPages.map(page => {
                const change = direction === 'right' ? 90 : -90;
                const newRotation = (page.rotation + change + 360) % 360;
                return { ...page, rotation: newRotation };
            })
        );
    };

    const resetRotations = () => {
        setPages(prevPages =>
            prevPages.map(page => ({ ...page, rotation: 0 }))
        );
    };

    const handleProceedToConfig = () => {
        if (!file || pages.length === 0) {
            setErrorMsg('Please select a PDF file');
            return;
        }
        setConversionStep('configure');
    };

    const handleConfigChange = (newConfig: RotatePdfConfig) => {
        setConfig(newConfig);
    };

    const handleRotate = async (finalConfig: RotatePdfConfig) => {
        setState(ProcessState.CONVERTING);
        setConversionStep('processing');
        setErrorMsg('');

        try {
            // Group pages by rotation
            const rotationGroups = new Map<number, number[]>();

            pages.forEach(page => {
                if (page.rotation !== 0) {
                    if (!rotationGroups.has(page.rotation)) {
                        rotationGroups.set(page.rotation, []);
                    }
                    rotationGroups.get(page.rotation)!.push(page.pageNumber);
                }
            });

            if (rotationGroups.size === 0) {
                setErrorMsg('No rotations applied. Please rotate at least one page.');
                setState(ProcessState.IDLE);
                setConversionStep('upload');
                return;
            }

            // Apply rotations sequentially
            let pdfBytes = await file!.arrayBuffer();

            for (const [rotation, pageNumbers] of rotationGroups.entries()) {
                const pdfFile = new File([pdfBytes], file!.name, { type: 'application/pdf' });
                pdfBytes = await rotatePDF(pdfFile, finalConfig);
            }

            setState(ProcessState.COMPLETED);
            setConversionStep('result');

            // Auto-download
            const fileName = file!.name.replace('.pdf', '_rotated.pdf');
            downloadPDF(new Uint8Array(pdfBytes), fileName);
        } catch (err) {
            console.error(err);
            setErrorMsg(err instanceof Error ? err.message : 'An unknown error occurred');
            setState(ProcessState.IDLE);
            setConversionStep('upload');
        }
    };

    const handleCancelConfig = () => {
        setConversionStep('upload');
    };

    const handleReset = () => {
        setState(ProcessState.IDLE);
        setConversionStep('upload');
        setFile(null);
        setPages([]);
        setConfig(undefined);
        setErrorMsg('');
    };

    return (
        <div className="detail-view animate-fade-in">
            <div className="container">
                {/* Navigation */}
                <button onClick={onBack} className="back-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-sm">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    Back to Dashboard
                </button>

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

                        {conversionStep === 'configure' ? (
                            <RotatePdfConfigComponent
                                file={file!}
                                onConfigChange={handleConfigChange}
                                onRotate={handleRotate}
                                onCancel={handleCancelConfig}
                            />
                        ) : state === ProcessState.IDLE || state === ProcessState.UPLOADING ? (
                            <>
                                {file && pages.length > 0 ? (
                                    <div>
                                        {/* File Info and Controls */}
                                        <div style={{ padding: '1.5rem', background: 'var(--surface-light)', borderRadius: '0.5rem', marginBottom: '2rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                                                <div>
                                                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        {file.name}
                                                    </div>
                                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                                                        {pages.length} page{pages.length !== 1 ? 's' : ''}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    <button
                                                        onClick={() => rotateAllPages('left')}
                                                        className="btn-secondary"
                                                        style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                                        </svg>
                                                        Rotate All Left
                                                    </button>
                                                    <button
                                                        onClick={() => rotateAllPages('right')}
                                                        className="btn-secondary"
                                                        style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                    >
                                                        Rotate All Right
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={resetRotations}
                                                        className="btn-secondary"
                                                        style={{ padding: '0.5rem 1rem' }}
                                                    >
                                                        Reset All
                                                    </button>
                                                </div>
                                            </div>

                                            <div style={{ padding: '1rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '0.5rem' }}>
                                                <div style={{ fontSize: '0.875rem', color: '#1E40AF', lineHeight: 1.6 }}>
                                                    <strong>How to use:</strong> Click the rotation arrows below each page to rotate it. Use the buttons above to rotate all pages at once.
                                                </div>
                                            </div>
                                        </div>

                                        {/* Page Previews Grid */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                            gap: '1.5rem',
                                            marginBottom: '2rem'
                                        }}>
                                            {pages.map((page) => (
                                                <div
                                                    key={page.pageNumber}
                                                    style={{
                                                        border: '2px solid var(--border-color)',
                                                        borderRadius: '0.5rem',
                                                        padding: '1rem',
                                                        background: 'var(--surface-white)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: '0.75rem'
                                                    }}
                                                >
                                                    {/* Page Number */}
                                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        Page {page.pageNumber}
                                                        {page.rotation !== 0 && (
                                                            <span style={{ marginLeft: '0.5rem', color: '#059669', fontSize: '0.75rem' }}>
                                                                ({page.rotation}°)
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Page Preview */}
                                                    <div style={{
                                                        width: '100%',
                                                        aspectRatio: '1',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        overflow: 'hidden',
                                                        background: '#f3f4f6',
                                                        borderRadius: '0.25rem'
                                                    }}>
                                                        <img
                                                            src={page.imageUrl}
                                                            alt={`Page ${page.pageNumber}`}
                                                            style={{
                                                                maxWidth: '100%',
                                                                maxHeight: '100%',
                                                                transform: `rotate(${page.rotation}deg)`,
                                                                transition: 'transform 0.3s ease'
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Rotation Controls */}
                                                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                                                        <button
                                                            onClick={() => rotatePage(page.pageNumber, 'left')}
                                                            style={{
                                                                flex: 1,
                                                                padding: '0.5rem',
                                                                border: '1px solid var(--border-color)',
                                                                borderRadius: '0.25rem',
                                                                background: 'var(--surface-white)',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '0.875rem',
                                                                color: 'var(--text-primary)'
                                                            }}
                                                            title="Rotate left 90°"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => rotatePage(page.pageNumber, 'right')}
                                                            style={{
                                                                flex: 1,
                                                                padding: '0.5rem',
                                                                border: '1px solid var(--border-color)',
                                                                borderRadius: '0.25rem',
                                                                background: 'var(--surface-white)',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '0.875rem',
                                                                color: 'var(--text-primary)'
                                                            }}
                                                            title="Rotate right 90°"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Action Buttons */}
                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            <button onClick={handleProceedToConfig} className="btn-action" style={{ flex: 1, maxWidth: 'none' }}>
                                                Configure & Rotate →
                                            </button>
                                            <button onClick={handleReset} className="btn-secondary" style={{ flex: 1, maxWidth: 'none' }}>
                                                Select Different PDF
                                            </button>
                                        </div>
                                    </div>
                                ) : isLoadingPreviews ? (
                                    <div className="result-area" style={{ padding: '3rem 0' }}>
                                        <div style={{ maxWidth: '200px', margin: '0 auto 2rem' }}>
                                            <div className="loader">
                                                <div className="loader-bar"></div>
                                            </div>
                                        </div>
                                        <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Loading PDF...</h3>
                                        <p className="workspace-desc">Generating page previews.</p>
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
                                            Select a PDF to rotate
                                        </span>
                                        <span style={{ color: '#A8A29E', fontSize: '0.875rem' }}>
                                            Click to browse or drag and drop
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : state === ProcessState.CONVERTING ? (
                            <div className="result-area" style={{ padding: '3rem 0' }}>
                                <div style={{ maxWidth: '200px', margin: '0 auto 2rem' }}>
                                    <div className="loader">
                                        <div className="loader-bar"></div>
                                    </div>
                                </div>
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Rotating PDF...</h3>
                                <p className="workspace-desc">Applying rotations to your document.</p>
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
                                    Your PDF has been rotated successfully.
                                    <br />
                                    Check your downloads folder.
                                </p>
                                <div className="action-row">
                                    <button onClick={handleReset} className="btn-secondary">
                                        Rotate Another PDF
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

export default RotatePDF;
