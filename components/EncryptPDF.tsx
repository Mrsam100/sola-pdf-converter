/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tool, ProcessState } from '../types';
import { encryptPDF, downloadPDF, EncryptPermissions } from '../services/pdfService';
import { useWakeLock, usePageVisibility } from '../hooks/usePageVisibility';
import { toast } from '../hooks/useToast';
import { formatFileSize } from '../utils/formatFileSize';
import BackButton from './BackButton';
import StepProgress from './StepProgress';

interface EncryptPDFProps {
    tool: Tool;
    onBack: () => void;
}

const STEPS = [
    { label: 'Upload' },
    { label: 'Set Password' },
    { label: 'Complete' },
];

type PasswordStrength = 'none' | 'weak' | 'medium' | 'strong';

function getPasswordStrength(password: string): PasswordStrength {
    if (!password) return 'none';
    if (password.length < 6) return 'weak';

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    const variety = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;

    if (password.length >= 10 && variety >= 3) return 'strong';
    if (password.length >= 6 && variety >= 2) return 'medium';
    return 'weak';
}

const STRENGTH_CONFIG: Record<PasswordStrength, { label: string; color: string; width: string }> = {
    none: { label: '', color: 'var(--border-color)', width: '0%' },
    weak: { label: 'Weak', color: 'var(--error)', width: '33%' },
    medium: { label: 'Medium', color: 'var(--warning)', width: '66%' },
    strong: { label: 'Strong', color: 'var(--success)', width: '100%' },
};

const EncryptPDF: React.FC<EncryptPDFProps> = ({ tool, onBack }) => {
    const [state, setState] = useState<ProcessState>(ProcessState.IDLE);
    const [file, setFile] = useState<File | null>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [resultBlob, setResultBlob] = useState<Uint8Array | null>(null);
    const [permissions, setPermissions] = useState<EncryptPermissions>({
        printing: true,
        copying: false,
        modifying: false,
    });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mountedRef = useRef(true);

    const isProcessing = state === ProcessState.CONVERTING;
    useWakeLock(isProcessing);
    usePageVisibility();

    useEffect(() => {
        return () => { mountedRef.current = false; };
    }, []);

    const currentStep = state === ProcessState.IDLE
        ? (file ? 1 : -1)
        : state === ProcessState.CONVERTING ? 1 : 2;

    const strength = getPasswordStrength(password);
    const strengthInfo = STRENGTH_CONFIG[strength];
    const passwordsMatch = password === confirmPassword;
    const canEncrypt = file && password.length >= 4 && passwordsMatch;

    // ========================================
    // File Handling
    // ========================================

    const validateAndSetFile = useCallback((selectedFile: File) => {
        const isPDF = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');
        if (!isPDF) {
            setErrorMsg('Please select a PDF file');
            return;
        }

        const maxSize = 50 * 1024 * 1024;
        if (selectedFile.size > maxSize) {
            setErrorMsg('File is too large. Maximum size is 50MB.');
            return;
        }

        setFile(selectedFile);
        setState(ProcessState.IDLE);
        setErrorMsg('');
        setPassword('');
        setConfirmPassword('');
        setResultBlob(null);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
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
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndSetFile(e.dataTransfer.files[0]);
        }
    }, [validateAndSetFile]);

    // ========================================
    // Encrypt Logic
    // ========================================

    const handleEncrypt = async () => {
        if (!file) {
            setErrorMsg('Please select a PDF file');
            return;
        }
        if (!password || password.trim() === '') {
            setErrorMsg('Please enter a password');
            return;
        }
        if (password.length < 4) {
            setErrorMsg('Password must be at least 4 characters');
            return;
        }
        if (password !== confirmPassword) {
            setErrorMsg('Passwords do not match');
            return;
        }

        // Magic byte validation
        try {
            const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
            if (String.fromCharCode(...header).indexOf('%PDF') !== 0) {
                setErrorMsg('This file does not appear to be a valid PDF (invalid file header).');
                return;
            }
        } catch {
            setErrorMsg('Failed to read the file. Please try selecting it again.');
            return;
        }

        setState(ProcessState.CONVERTING);
        setErrorMsg('');

        try {
            const encryptedBytes = await encryptPDF(file, password, password, permissions);
            if (!mountedRef.current) return;

            setResultBlob(encryptedBytes);

            const filename = file.name.replace(/\.pdf$/i, '_encrypted.pdf');
            downloadPDF(encryptedBytes, filename);

            setState(ProcessState.COMPLETED);
            toast.success('PDF encrypted and downloaded!');
        } catch (err) {
            if (!mountedRef.current) return;

            let message = 'Failed to encrypt PDF';
            if (err instanceof Error) {
                if (err.message.includes('encrypted') || err.message.includes('password')) {
                    message = 'This PDF is already encrypted. Please unlock it first, then re-encrypt with a new password.';
                } else {
                    message = err.message;
                }
            }
            setErrorMsg(message);
            toast.error('Encryption failed');
            setState(ProcessState.IDLE);
        }
    };

    const handleDownloadAgain = () => {
        if (!resultBlob || !file) return;
        const filename = file.name.replace(/\.pdf$/i, '_encrypted.pdf');
        downloadPDF(resultBlob, filename);
        toast.success('Download started!');
    };

    const handleReset = () => {
        setState(ProcessState.IDLE);
        setFile(null);
        setPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        setErrorMsg('');
        setResultBlob(null);
        setPermissions({ printing: true, copying: false, modifying: false });
    };

    const togglePermission = (key: keyof EncryptPermissions) => {
        setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // ========================================
    // Render
    // ========================================

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

                    {/* Step Progress */}
                    <div style={{ padding: '1.5rem 1.5rem 0' }}>
                        <StepProgress steps={STEPS} currentStep={currentStep} />
                    </div>

                    <div className="workspace-body">
                        {/* Error Message */}
                        {errorMsg && (
                            <div className="error-msg">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-sm" style={{ flexShrink: 0 }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                                <div style={{ flex: 1, textAlign: 'left' }}>
                                    {errorMsg}
                                    {state === ProcessState.IDLE && file && (
                                        <button
                                            onClick={handleEncrypt}
                                            style={{
                                                display: 'block', marginTop: '0.5rem', fontSize: '0.8rem',
                                                fontWeight: 600, color: 'var(--accent)', textDecoration: 'underline',
                                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                            }}
                                        >
                                            Try Again
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ==================== UPLOAD STATE ==================== */}
                        {state === ProcessState.IDLE && !file && (
                            <div
                                className={`upload-zone${isDragging ? ' drag-over' : ''}`}
                                role="button" tabIndex={0} aria-label="Upload PDF file"
                                onClick={() => fileInputRef.current?.click()}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
                                onDragOver={handleDragOver}
                                onDragEnter={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
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
                                <span style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                    {isDragging ? 'Drop your PDF here' : 'Select a PDF to encrypt'}
                                </span>
                                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                                    Click to browse or drag and drop
                                </span>
                            </div>
                        )}

                        {/* ==================== CONFIGURE PASSWORD STATE ==================== */}
                        {state === ProcessState.IDLE && file && (
                            <div>
                                {/* File Info */}
                                <div style={{ padding: '1.5rem', background: 'var(--surface-light)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg" style={{ color: 'var(--text-primary)' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                        </svg>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                                {file.name}
                                            </div>
                                            <span className="file-size">{formatFileSize(file.size)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Password Input */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                        Password
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && canEncrypt) handleEncrypt(); }}
                                            placeholder="Enter a strong password"
                                            style={{
                                                width: '100%', padding: '0.75rem 2.75rem 0.75rem 0.75rem', fontSize: '0.9rem',
                                                border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
                                                background: 'var(--surface-light)', color: 'var(--text-primary)',
                                                outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
                                            }}
                                            onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                                            onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={{
                                                position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                                                background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem',
                                                color: 'var(--text-tertiary)', display: 'flex',
                                            }}
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20" height="20">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20" height="20">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>

                                    {/* Strength Indicator */}
                                    {password && (
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <div style={{
                                                height: '4px', borderRadius: '2px',
                                                background: 'var(--border-color)', overflow: 'hidden',
                                            }}>
                                                <div style={{
                                                    height: '100%', width: strengthInfo.width,
                                                    background: strengthInfo.color,
                                                    borderRadius: '2px', transition: 'width 0.3s, background 0.3s',
                                                }} />
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: strengthInfo.color, marginTop: '0.25rem', fontWeight: 600 }}>
                                                {strengthInfo.label}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm Password */}
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                        Confirm Password
                                    </label>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && canEncrypt) handleEncrypt(); }}
                                        placeholder="Re-enter your password"
                                        style={{
                                            width: '100%', padding: '0.75rem', fontSize: '0.9rem',
                                            border: `2px solid ${confirmPassword && !passwordsMatch ? 'var(--error)' : 'var(--border-color)'}`,
                                            borderRadius: 'var(--radius-sm)', background: 'var(--surface-light)',
                                            color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s',
                                            boxSizing: 'border-box',
                                        }}
                                    />
                                    {confirmPassword && !passwordsMatch && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>
                                            Passwords do not match
                                        </div>
                                    )}
                                </div>

                                {/* Permissions */}
                                <div style={{
                                    padding: '1rem', background: 'var(--surface-light)',
                                    borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem',
                                    border: '1px solid var(--border-color)',
                                }}>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                                        Document Permissions
                                    </div>
                                    {([
                                        { key: 'printing' as const, label: 'Allow printing' },
                                        { key: 'copying' as const, label: 'Allow copying text' },
                                        { key: 'modifying' as const, label: 'Allow modifying' },
                                    ]).map(({ key, label }) => (
                                        <label key={key} style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            padding: '0.5rem 0', cursor: 'pointer', fontSize: '0.875rem',
                                            color: 'var(--text-secondary)',
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={permissions[key] ?? false}
                                                onChange={() => togglePermission(key)}
                                                style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                                            />
                                            {label}
                                        </label>
                                    ))}
                                </div>

                                {/* Info Box */}
                                <div style={{
                                    padding: '1rem',
                                    background: 'var(--info-bg)',
                                    border: '1px solid color-mix(in srgb, var(--info) 30%, transparent)',
                                    borderRadius: 'var(--radius-sm)',
                                    marginBottom: '1.5rem',
                                }}>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                                        <strong>About encryption:</strong> Your PDF will be protected with AES encryption.
                                        The password cannot be recovered — store it securely.
                                        All processing happens locally in your browser.
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={handleEncrypt}
                                        className="btn-action"
                                        style={{ flex: 1, maxWidth: 'none', marginTop: 0, opacity: canEncrypt ? 1 : 0.5 }}
                                        disabled={!canEncrypt}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="18" height="18" style={{ marginRight: '0.5rem' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                        </svg>
                                        Encrypt PDF
                                    </button>
                                    <button onClick={handleReset} className="btn-secondary" style={{ flex: 1, maxWidth: 'none' }}>
                                        Change File
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ==================== PROCESSING STATE ==================== */}
                        {state === ProcessState.CONVERTING && (
                            <div className="result-area" style={{ padding: '3rem 0' }} aria-live="polite">
                                <div style={{ maxWidth: '300px', margin: '0 auto 2rem' }}>
                                    <div className="loader">
                                        <div className="loader-bar"></div>
                                    </div>
                                </div>
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>
                                    Encrypting...
                                </h3>
                                <p className="workspace-desc">Securing your PDF with password protection.</p>
                            </div>
                        )}

                        {/* ==================== COMPLETED STATE ==================== */}
                        {state === ProcessState.COMPLETED && (
                            <div className="result-area animate-fade-in">
                                <div className="success-check-animated">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="#fff" width="28" height="28">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                </div>
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>PDF Encrypted!</h3>
                                <p className="workspace-desc" style={{ marginBottom: '0.5rem' }}>
                                    Your password-protected PDF has been downloaded.
                                </p>
                                {file && resultBlob && (
                                    <div style={{ padding: '1rem 1.5rem', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', margin: '1.5rem auto', maxWidth: '360px', fontSize: '0.875rem' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                            {file.name.replace(/\.pdf$/i, '_encrypted.pdf')}
                                        </div>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                                            {formatFileSize(resultBlob.length)}
                                        </div>
                                    </div>
                                )}

                                <div className="action-row">
                                    <button onClick={handleDownloadAgain} className="btn-secondary btn-primary-alt">
                                        Download Again
                                    </button>
                                    <button onClick={handleReset} className="btn-secondary">
                                        Encrypt Another PDF
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

export default EncryptPDF;
