/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tool, ProcessState } from '../types';
import { unlockPDF, downloadPDF, isPDFEncrypted } from '../services/pdfService';
import { useWakeLock, usePageVisibility } from '../hooks/usePageVisibility';
import { toast } from '../hooks/useToast';
import { formatFileSize } from '../utils/formatFileSize';
import BackButton from './BackButton';
import StepProgress from './StepProgress';

interface UnlockPDFProps {
    tool: Tool;
    onBack: () => void;
}

const STEPS = [
    { label: 'Upload' },
    { label: 'Password' },
    { label: 'Unlocking' },
    { label: 'Complete' },
];

const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150MB (increased from 50MB)

const UnlockPDF: React.FC<UnlockPDFProps> = ({ tool, onBack }) => {
    const [state, setState] = useState<ProcessState>(ProcessState.IDLE);
    const [file, setFile] = useState<File | null>(null);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [isEncrypted, setIsEncrypted] = useState<boolean | null>(null);
    const [isCheckingEncryption, setIsCheckingEncryption] = useState(false);
    const [resultBlob, setResultBlob] = useState<Uint8Array | null>(null);

    // 🔒 BRUTE FORCE PROTECTION
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
    const [isLockedOut, setIsLockedOut] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const mountedRef = useRef(true);

    const isProcessing = state === ProcessState.CONVERTING;
    useWakeLock(isProcessing);
    usePageVisibility();

    useEffect(() => {
        return () => { mountedRef.current = false; };
    }, []);

    const currentStep = !file ? -1 :
        isCheckingEncryption ? 0 :
        state === ProcessState.IDLE && isEncrypted ? 1 :
        state === ProcessState.CONVERTING ? 2 :
        state === ProcessState.COMPLETED ? 3 : 0;

    // ========================================
    // File Handling
    // ========================================

    const validateAndSetFile = useCallback((selectedFile: File) => {
        if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
            setErrorMsg('Please select a valid PDF file.');
            return;
        }
        // 🔒 VALIDATION FIX: Check for 0-byte files to prevent wasted processing
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
        setPassword('');
        setShowPassword(false);
        setResultBlob(null);
        setIsEncrypted(null);

        checkEncryption(selectedFile);
    }, []);

    const checkEncryption = async (pdfFile: File) => {
        setIsCheckingEncryption(true);

        try {
            // Magic byte validation
            const header = new Uint8Array(await pdfFile.slice(0, 5).arrayBuffer());
            if (String.fromCharCode(...header).indexOf('%PDF') !== 0) {
                if (!mountedRef.current) return;
                setErrorMsg('This file does not appear to be a valid PDF (invalid file header).');
                setFile(null);
                setIsCheckingEncryption(false);
                return;
            }

            const encrypted = await isPDFEncrypted(pdfFile);
            if (!mountedRef.current) return;

            setIsEncrypted(encrypted);
            if (!encrypted) {
                setErrorMsg('This PDF is not encrypted. No password removal is needed.');
            }
        } catch {
            if (!mountedRef.current) return;
            setIsEncrypted(null);
            setErrorMsg('Failed to read the PDF. Please try selecting it again.');
            setFile(null);
        } finally {
            if (mountedRef.current) setIsCheckingEncryption(false);
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

    // ========================================
    // Brute Force Protection Logic
    // ========================================

    // Check lockout status
    useEffect(() => {
        if (lockoutUntil) {
            const now = Date.now();
            if (now >= lockoutUntil) {
                setIsLockedOut(false);
                setLockoutUntil(null);
                setFailedAttempts(0);
            } else {
                setIsLockedOut(true);
                const timer = setTimeout(() => {
                    setIsLockedOut(false);
                    setLockoutUntil(null);
                    setFailedAttempts(0);
                }, lockoutUntil - now);
                return () => clearTimeout(timer);
            }
        }
    }, [lockoutUntil]);

    // Calculate lockout duration based on failed attempts (exponential backoff)
    const getLockoutDuration = (attempts: number): number => {
        const durations = [
            0,          // 0 attempts - no lockout
            0,          // 1 attempt - no lockout
            0,          // 2 attempts - no lockout
            60000,      // 3 attempts - 1 minute
            300000,     // 4 attempts - 5 minutes
            900000,     // 5 attempts - 15 minutes
            1800000,    // 6 attempts - 30 minutes
            3600000,    // 7+ attempts - 60 minutes
        ];
        return attempts < durations.length ? durations[attempts] : durations[durations.length - 1];
    };

    // Format lockout time remaining
    const getLockoutMessage = (): string => {
        if (!lockoutUntil) return '';
        const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
        if (remaining < 60) return `${remaining} seconds`;
        const minutes = Math.ceil(remaining / 60);
        if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours} hour${hours > 1 ? 's' : ''}${mins > 0 ? ` ${mins} min` : ''}`;
    };

    // ========================================
    // Unlock Logic with Brute Force Protection
    // ========================================

    const handleUnlock = async () => {
        if (!file) { setErrorMsg('Please select a PDF file'); return; }
        if (!password || password.trim() === '') { setErrorMsg('Please enter the password'); return; }

        // 🔒 BRUTE FORCE PROTECTION: Check if locked out
        if (isLockedOut && lockoutUntil) {
            const remainingTime = getLockoutMessage();
            setErrorMsg(`⏱️ Too many failed attempts. Please wait ${remainingTime} before trying again.`);
            toast.error(`Locked out for ${remainingTime}`);
            return;
        }

        setState(ProcessState.CONVERTING);
        setErrorMsg('');
        setResultBlob(null);

        try {
            const unlockedBytes = await unlockPDF(file, password);
            if (!mountedRef.current) return;

            // ✅ SUCCESS: Reset brute force protection
            setFailedAttempts(0);
            setLockoutUntil(null);
            setIsLockedOut(false);

            setResultBlob(unlockedBytes);
            setState(ProcessState.COMPLETED);

            const baseName = file.name.replace(/\.pdf$/i, '');
            downloadPDF(unlockedBytes, `${baseName}_unlocked.pdf`);
            toast.success('PDF unlocked successfully!');
        } catch (err) {
            if (!mountedRef.current) return;

            let errorMessage = 'An unknown error occurred';
            let isPasswordError = false;

            if (err instanceof Error) {
                errorMessage = err.message;
                if (err.message.includes('password') || err.message.includes('incorrect') || err.message.includes('Incorrect')) {
                    isPasswordError = true;

                    // 🔒 BRUTE FORCE PROTECTION: Increment failed attempts
                    const newFailedAttempts = failedAttempts + 1;
                    setFailedAttempts(newFailedAttempts);

                    const lockoutDuration = getLockoutDuration(newFailedAttempts);

                    if (lockoutDuration > 0) {
                        const lockoutTime = Date.now() + lockoutDuration;
                        setLockoutUntil(lockoutTime);
                        setIsLockedOut(true);
                        const timeMsg = getLockoutMessage();
                        errorMessage = `❌ Incorrect password. Too many failed attempts (${newFailedAttempts}). Locked out for ${Math.ceil(lockoutDuration / 60000)} minutes.`;
                        toast.error(`Locked out for ${timeMsg}`);
                    } else {
                        const attemptsRemaining = 3 - newFailedAttempts;
                        errorMessage = `❌ Incorrect password. ${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining before lockout.`;
                    }
                } else if (err.message.includes('encrypted')) {
                    errorMessage = 'Failed to decrypt the PDF. The file may be corrupted.';
                }
            }

            setErrorMsg(errorMessage);
            if (!isPasswordError) {
                toast.error('Failed to unlock PDF');
            }
            setState(ProcessState.IDLE);
        }
    };

    const handleDownloadAgain = () => {
        if (!resultBlob || !file) return;
        const baseName = file.name.replace(/\.pdf$/i, '');
        downloadPDF(resultBlob, `${baseName}_unlocked.pdf`);
        toast.success('Download started!');
    };

    const handleReset = () => {
        setState(ProcessState.IDLE);
        setFile(null);
        setPassword('');
        setShowPassword(false);
        setErrorMsg('');
        setIsEncrypted(null);
        setIsCheckingEncryption(false);
        setResultBlob(null);
    };

    const handlePasswordKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && password.trim()) handleUnlock();
    };

    // ========================================
    // Render
    // ========================================

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
                        {/* Error Message */}
                        {errorMsg && (
                            <div className="error-msg">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-sm" style={{ flexShrink: 0 }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                                <div style={{ flex: 1, textAlign: 'left' }}>
                                    {errorMsg}
                                    {state === ProcessState.IDLE && file && isEncrypted && password && (
                                        <button onClick={handleUnlock} style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                            Try Again
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ==================== UPLOAD STATE ==================== */}
                        {state === ProcessState.IDLE && !file && !isCheckingEncryption && (
                            <div
                                className={`upload-zone${isDragging ? ' drag-over' : ''}`}
                                role="button" tabIndex={0} aria-label="Upload encrypted PDF file"
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
                                    {isDragging ? 'Drop your PDF here' : 'Select an encrypted PDF to unlock'}
                                </span>
                                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Click to browse or drag and drop</span>
                            </div>
                        )}

                        {/* ==================== CHECKING ENCRYPTION ==================== */}
                        {isCheckingEncryption && (
                            <div className="result-area" style={{ padding: '3rem 0' }} aria-live="polite">
                                <div style={{ maxWidth: '200px', margin: '0 auto 2rem' }}>
                                    <div className="loader"><div className="loader-bar"></div></div>
                                </div>
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Checking PDF...</h3>
                                <p className="workspace-desc">Verifying encryption status.</p>
                            </div>
                        )}

                        {/* ==================== PASSWORD STATE ==================== */}
                        {state === ProcessState.IDLE && file && !isCheckingEncryption && isEncrypted && (
                            <div>
                                {/* File Info */}
                                <div style={{ padding: '1.5rem', background: 'var(--surface-light)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg" style={{ color: 'var(--text-primary)' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                        </svg>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{file.name}</div>
                                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                <span className="file-size">{formatFileSize(file.size)}</span>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--warning)', background: 'var(--warning-bg)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                                                    Encrypted
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Password Input */}
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                        Enter PDF Password
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onKeyDown={handlePasswordKeyDown}
                                            placeholder="Enter the password to unlock"
                                            autoFocus
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
                                        <strong>Note:</strong> The password is case-sensitive.
                                        After unlocking, the PDF will be saved without password protection.
                                        All processing happens locally in your browser.
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={handleUnlock}
                                        className="btn-action"
                                        style={{ flex: 1, maxWidth: 'none', marginTop: 0, opacity: password.trim() ? 1 : 0.5 }}
                                        disabled={!password.trim()}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="18" height="18" style={{ marginRight: '0.5rem' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                        </svg>
                                        Unlock PDF
                                    </button>
                                    <button onClick={handleReset} className="btn-secondary" style={{ flex: 1, maxWidth: 'none' }}>
                                        Select Different PDF
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ==================== NOT ENCRYPTED STATE ==================== */}
                        {state === ProcessState.IDLE && file && !isCheckingEncryption && isEncrypted === false && (
                            <div>
                                <div style={{ padding: '1.5rem', background: 'var(--surface-light)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg" style={{ color: 'var(--success)' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                        </svg>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{file.name}</div>
                                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                <span className="file-size">{formatFileSize(file.size)}</span>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--success)', background: 'var(--success-bg)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                                                    Not Encrypted
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{
                                    padding: '1rem',
                                    background: 'var(--success-bg)',
                                    border: '1px solid var(--success)',
                                    borderRadius: 'var(--radius-sm)',
                                    marginBottom: '1.5rem',
                                }}>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                                        This PDF is not password-protected. No unlocking is needed.
                                        If you want to add password protection, use the <strong>Encrypt PDF</strong> tool instead.
                                    </div>
                                </div>

                                <button onClick={handleReset} className="btn-action" style={{ maxWidth: 'none', marginTop: 0 }}>
                                    Select Different PDF
                                </button>
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
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Unlocking PDF...</h3>
                                <p className="workspace-desc">Removing password protection from your document.</p>
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
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>PDF Unlocked!</h3>

                                {file && resultBlob && (
                                    <div style={{ padding: '1rem 1.5rem', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', margin: '1.5rem auto', maxWidth: '360px', fontSize: '0.875rem' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                            {file.name.replace(/\.pdf$/i, '_unlocked.pdf')}
                                        </div>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                                            {formatFileSize(resultBlob.length)}
                                        </div>
                                    </div>
                                )}

                                <p className="workspace-desc" style={{ marginBottom: '2rem' }}>Your file has been downloaded. Check your downloads folder.</p>
                                <div className="action-row">
                                    <button onClick={handleDownloadAgain} className="btn-secondary btn-primary-alt">Download Again</button>
                                    <button onClick={handleReset} className="btn-secondary">Unlock Another PDF</button>
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

export default UnlockPDF;
