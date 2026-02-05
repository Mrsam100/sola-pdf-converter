/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Tool, ProcessState, MergePdfConfig, ConversionStep } from '../types';
import { mergePDFs, downloadPDF } from '../services/pdfService';
import { MergePdfConfig as MergePdfConfigComponent } from './config/MergePdfConfig';

interface MergePDFProps {
    tool: Tool;
    onBack: () => void;
}

const MergePDF: React.FC<MergePDFProps> = ({ tool, onBack }) => {
    const [state, setState] = useState<ProcessState>(ProcessState.IDLE);
    const [conversionStep, setConversionStep] = useState<ConversionStep>('upload');
    const [files, setFiles] = useState<File[]>([]);
    const [config, setConfig] = useState<MergePdfConfig | undefined>(undefined);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [resultSize, setResultSize] = useState<number>(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files);
            setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
            setState(ProcessState.IDLE);
            setErrorMsg('');
        }
    };

    const removeFile = (index: number) => {
        setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
    };

    const moveFileUp = (index: number) => {
        if (index === 0) return;
        setFiles(prevFiles => {
            const newFiles = [...prevFiles];
            [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]];
            return newFiles;
        });
    };

    const moveFileDown = (index: number) => {
        if (index === files.length - 1) return;
        setFiles(prevFiles => {
            const newFiles = [...prevFiles];
            [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
            return newFiles;
        });
    };

    const handleProceedToConfig = () => {
        if (files.length < 2) {
            setErrorMsg('Please select at least 2 PDF files to merge');
            return;
        }
        setConversionStep('configure');
    };

    const handleConfigChange = (newConfig: MergePdfConfig) => {
        setConfig(newConfig);
    };

    const handleMerge = async (finalConfig: MergePdfConfig) => {
        setState(ProcessState.CONVERTING);
        setConversionStep('processing');
        setErrorMsg('');

        try {
            const mergedPdf = await mergePDFs(files, finalConfig);
            setResultSize(mergedPdf.length);
            setState(ProcessState.COMPLETED);
            setConversionStep('result');

            // Auto-download the merged PDF
            downloadPDF(mergedPdf, 'merged.pdf');
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
        setFiles([]);
        setConfig(undefined);
        setErrorMsg('');
        setResultSize(0);
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
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
                                        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
                                            Selected Files ({files.length})
                                        </h3>
                                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                                            {files.map((file, index) => (
                                                <div
                                                    key={index}
                                                    style={{
                                                        padding: '1rem',
                                                        borderBottom: index < files.length - 1 ? '1px solid var(--border-color)' : 'none',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        background: 'var(--surface-white)',
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>
                                                            {index + 1}
                                                        </span>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                                                                {file.name}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                                {formatFileSize(file.size)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            onClick={() => moveFileUp(index)}
                                                            disabled={index === 0}
                                                            style={{
                                                                padding: '0.5rem',
                                                                border: '1px solid var(--border-color)',
                                                                borderRadius: '0.25rem',
                                                                background: 'var(--surface-white)',
                                                                cursor: index === 0 ? 'not-allowed' : 'pointer',
                                                                opacity: index === 0 ? 0.5 : 1,
                                                            }}
                                                            title="Move up"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-sm">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => moveFileDown(index)}
                                                            disabled={index === files.length - 1}
                                                            style={{
                                                                padding: '0.5rem',
                                                                border: '1px solid var(--border-color)',
                                                                borderRadius: '0.25rem',
                                                                background: 'var(--surface-white)',
                                                                cursor: index === files.length - 1 ? 'not-allowed' : 'pointer',
                                                                opacity: index === files.length - 1 ? 0.5 : 1,
                                                            }}
                                                            title="Move down"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-sm">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => removeFile(index)}
                                                            style={{
                                                                padding: '0.5rem',
                                                                border: '1px solid #FCA5A5',
                                                                borderRadius: '0.25rem',
                                                                background: '#FEE2E2',
                                                                cursor: 'pointer',
                                                                color: '#991B1B',
                                                            }}
                                                            title="Remove"
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
                                    className="upload-zone"
                                    onClick={() => fileInputRef.current?.click()}
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
                                    <span style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem', color: '#2C2A26' }}>
                                        {files.length === 0 ? 'Select PDF files to merge' : 'Add more PDFs'}
                                    </span>
                                    <span style={{ color: '#A8A29E', fontSize: '0.875rem' }}>
                                        Click to browse or drag and drop
                                    </span>
                                </div>

                                {files.length >= 2 && (
                                    <div className="flex-center">
                                        <button onClick={handleProceedToConfig} className="btn-action">
                                            Configure & Merge PDFs →
                                        </button>
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
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Merging PDFs...</h3>
                                <p className="workspace-desc">Combining {files.length} files into one.</p>
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
                                    Your PDFs have been merged successfully.
                                    <br />
                                    Final size: {formatFileSize(resultSize)}
                                </p>
                                <div className="action-row">
                                    <button onClick={handleReset} className="btn-secondary">
                                        Merge More PDFs
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

export default MergePDF;
