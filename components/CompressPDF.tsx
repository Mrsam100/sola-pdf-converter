/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Tool, ProcessState, CompressPdfConfig, ConversionStep } from '../types';
import { compressPDF, downloadPDF } from '../services/pdfService';
import { CompressPdfConfig as CompressPdfConfigComponent } from './config/CompressPdfConfig';

interface CompressPDFProps {
    tool: Tool;
    onBack: () => void;
}

const CompressPDF: React.FC<CompressPDFProps> = ({ tool, onBack }) => {
    const [state, setState] = useState<ProcessState>(ProcessState.IDLE);
    const [conversionStep, setConversionStep] = useState<ConversionStep>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [config, setConfig] = useState<CompressPdfConfig | undefined>(undefined);
    const [originalSize, setOriginalSize] = useState<number>(0);
    const [compressedSize, setCompressedSize] = useState<number>(0);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setOriginalSize(selectedFile.size);
            setState(ProcessState.IDLE);
            setErrorMsg('');
        }
    };

    const handleProceedToConfig = () => {
        if (!file) {
            setErrorMsg('Please select a PDF file');
            return;
        }
        setConversionStep('configure');
    };

    const handleConfigChange = (newConfig: CompressPdfConfig) => {
        setConfig(newConfig);
    };

    const handleCompress = async (finalConfig: CompressPdfConfig) => {
        setState(ProcessState.CONVERTING);
        setConversionStep('processing');
        setErrorMsg('');

        try {
            const compressedPdf = await compressPDF(file!, finalConfig);
            setCompressedSize(compressedPdf.length);
            setState(ProcessState.COMPLETED);
            setConversionStep('result');

            // Auto-download the compressed PDF
            const fileName = file!.name.replace('.pdf', '_compressed.pdf');
            downloadPDF(compressedPdf, fileName);
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
        setConfig(undefined);
        setOriginalSize(0);
        setCompressedSize(0);
        setErrorMsg('');
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    const calculateReduction = (): string => {
        if (originalSize === 0 || compressedSize === 0) return '0';
        const reduction = ((originalSize - compressedSize) / originalSize) * 100;
        return reduction.toFixed(1);
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
                            <CompressPdfConfigComponent
                                file={file!}
                                onConfigChange={handleConfigChange}
                                onCompress={handleCompress}
                                onCancel={handleCancelConfig}
                            />
                        ) : state === ProcessState.IDLE || state === ProcessState.UPLOADING ? (
                            <>
                                {file ? (
                                    <div>
                                        {/* File Info */}
                                        <div style={{ padding: '1.5rem', background: 'var(--surface-light)', borderRadius: '0.5rem', marginBottom: '2rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg" style={{ color: 'var(--text-primary)' }}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                                </svg>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                                        {file.name}
                                                    </div>
                                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                                                        Original size: {formatFileSize(originalSize)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ padding: '1rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '0.5rem' }}>
                                                <div style={{ fontSize: '0.875rem', color: '#1E40AF', lineHeight: 1.6 }}>
                                                    <strong>Note:</strong> Compression removes duplicate objects and optimizes the PDF structure.
                                                    The amount of compression depends on the PDF content. Some PDFs may not compress significantly.
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            <button onClick={handleProceedToConfig} className="btn-action" style={{ flex: 1, maxWidth: 'none' }}>
                                                Configure & Compress →
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
                                            Select a PDF to compress
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
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Compressing PDF...</h3>
                                <p className="workspace-desc">Optimizing your document.</p>
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
                                    Your PDF has been compressed successfully.
                                </p>

                                {/* Compression Stats */}
                                <div style={{ maxWidth: '400px', margin: '0 auto 2rem', padding: '1.5rem', background: 'var(--surface-light)', borderRadius: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Original Size:</span>
                                        <strong style={{ color: 'var(--text-primary)' }}>{formatFileSize(originalSize)}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Compressed Size:</span>
                                        <strong style={{ color: '#059669' }}>{formatFileSize(compressedSize)}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Size Reduction:</span>
                                        <strong style={{ color: '#059669' }}>{calculateReduction()}%</strong>
                                    </div>
                                </div>

                                <div className="action-row">
                                    <button onClick={handleReset} className="btn-secondary">
                                        Compress Another PDF
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

export default CompressPDF;
