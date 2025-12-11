/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Tool, ProcessState } from '../types';
import { splitPDF, getPDFInfo, downloadPDF } from '../services/pdfService';

interface SplitPDFProps {
    tool: Tool;
    onBack: () => void;
}

const SplitPDF: React.FC<SplitPDFProps> = ({ tool, onBack }) => {
    const [state, setState] = useState<ProcessState>(ProcessState.IDLE);
    const [file, setFile] = useState<File | null>(null);
    const [pageCount, setPageCount] = useState<number>(0);
    const [pageRanges, setPageRanges] = useState<string>('');
    const [splitMode, setSplitMode] = useState<'custom' | 'all'>('custom');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [resultCount, setResultCount] = useState<number>(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setState(ProcessState.IDLE);
            setErrorMsg('');

            try {
                const info = await getPDFInfo(selectedFile);
                setPageCount(info.pageCount);
                setPageRanges(''); // Reset ranges
            } catch (error) {
                setErrorMsg('Failed to read PDF. Please select a valid PDF file.');
                setFile(null);
                setPageCount(0);
            }
        }
    };

    const handleSplit = async () => {
        if (!file) {
            setErrorMsg('Please select a PDF file');
            return;
        }

        if (pageCount === 0) {
            setErrorMsg('PDF has no pages');
            return;
        }

        setState(ProcessState.CONVERTING);
        setErrorMsg('');

        try {
            let ranges: string[];

            if (splitMode === 'all') {
                // Split into individual pages
                ranges = Array.from({ length: pageCount }, (_, i) => `${i + 1}`);
            } else {
                // Use custom ranges
                if (!pageRanges.trim()) {
                    setErrorMsg('Please enter page ranges (e.g., 1-3, 5, 7-9)');
                    setState(ProcessState.IDLE);
                    return;
                }
                ranges = pageRanges.split(',').map(r => r.trim()).filter(r => r.length > 0);
            }

            const results = await splitPDF(file, ranges);
            setResultCount(results.length);

            // Download all split PDFs
            results.forEach(result => {
                downloadPDF(result.pdf, result.name);
            });

            setState(ProcessState.COMPLETED);
        } catch (err) {
            console.error(err);
            setErrorMsg(err instanceof Error ? err.message : 'An unknown error occurred');
            setState(ProcessState.IDLE);
        }
    };

    const handleReset = () => {
        setState(ProcessState.IDLE);
        setFile(null);
        setPageCount(0);
        setPageRanges('');
        setSplitMode('custom');
        setErrorMsg('');
        setResultCount(0);
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

                        {state === ProcessState.IDLE || state === ProcessState.UPLOADING ? (
                            <>
                                {file && pageCount > 0 ? (
                                    <div style={{ marginBottom: '2rem' }}>
                                        {/* File Info */}
                                        <div style={{ padding: '1rem', background: 'var(--surface-light)', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                                <strong>{file.name}</strong>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                {pageCount} page{pageCount !== 1 ? 's' : ''}
                                            </div>
                                        </div>

                                        {/* Split Mode Selection */}
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                                                Split Mode
                                            </label>
                                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                                <button
                                                    onClick={() => setSplitMode('custom')}
                                                    className={`filter-btn ${splitMode === 'custom' ? 'active' : ''}`}
                                                    style={{ flex: '1 1 auto' }}
                                                >
                                                    Custom Ranges
                                                </button>
                                                <button
                                                    onClick={() => setSplitMode('all')}
                                                    className={`filter-btn ${splitMode === 'all' ? 'active' : ''}`}
                                                    style={{ flex: '1 1 auto' }}
                                                >
                                                    Split All Pages
                                                </button>
                                            </div>
                                        </div>

                                        {/* Page Ranges Input */}
                                        {splitMode === 'custom' && (
                                            <div style={{ marginBottom: '1.5rem' }}>
                                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                                                    Page Ranges
                                                </label>
                                                <input
                                                    type="text"
                                                    value={pageRanges}
                                                    onChange={(e) => setPageRanges(e.target.value)}
                                                    placeholder="e.g., 1-3, 5, 7-9"
                                                    className="search-input"
                                                    style={{ width: '100%' }}
                                                />
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                                                    Enter page numbers or ranges separated by commas. Example: 1-3, 5, 7-9
                                                </div>
                                            </div>
                                        )}

                                        {splitMode === 'all' && (
                                            <div style={{ padding: '1rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                                                <div style={{ fontSize: '0.875rem', color: '#1E40AF' }}>
                                                    This will create {pageCount} separate PDF file{pageCount !== 1 ? 's' : ''}, one for each page.
                                                </div>
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            <button onClick={handleSplit} className="btn-action" style={{ flex: 1, maxWidth: 'none' }}>
                                                Split PDF
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
                                            Select a PDF to split
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
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Splitting PDF...</h3>
                                <p className="workspace-desc">Processing your document.</p>
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
                                    Your PDF has been split into {resultCount} file{resultCount !== 1 ? 's' : ''}.
                                    <br />
                                    Check your downloads folder.
                                </p>
                                <div className="action-row">
                                    <button onClick={handleReset} className="btn-secondary">
                                        Split Another PDF
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

export default SplitPDF;
