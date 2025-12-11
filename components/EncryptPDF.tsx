/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Tool, ProcessState } from '../types';
import { encryptPDF, downloadPDF } from '../services/pdfService';

interface EncryptPDFProps {
    tool: Tool;
    onBack: () => void;
}

const EncryptPDF: React.FC<EncryptPDFProps> = ({ tool, onBack }) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [password, setPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('');
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [processState, setProcessState] = useState<ProcessState>('idle');
    const [error, setError] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
                setError('Please select a PDF file');
                return;
            }
            setSelectedFile(file);
            setError('');
            setProcessState('idle');
            setPassword('');
            setConfirmPassword('');
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();

        const file = event.dataTransfer.files?.[0];
        if (file) {
            if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
                setError('Please select a PDF file');
                return;
            }
            setSelectedFile(file);
            setError('');
            setProcessState('idle');
            setPassword('');
            setConfirmPassword('');
        }
    };

    const handleEncrypt = async () => {
        if (!selectedFile) {
            setError('Please select a PDF file');
            return;
        }

        if (!password || password.trim() === '') {
            setError('Please enter a password');
            return;
        }

        if (password.length < 4) {
            setError('Password must be at least 4 characters long');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setProcessState('processing');
        setError('');

        try {
            const encryptedPdfBytes = await encryptPDF(selectedFile, password);

            const filename = selectedFile.name.replace('.pdf', '_encrypted.pdf');
            downloadPDF(encryptedPdfBytes, filename);

            setProcessState('completed');
            setPassword('');
            setConfirmPassword('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to encrypt PDF');
            setProcessState('idle');
        }
    };

    const resetAll = () => {
        setSelectedFile(null);
        setPassword('');
        setConfirmPassword('');
        setProcessState('idle');
        setError('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="tool-detail">
            <div className="tool-detail-header">
                <button className="back-btn" onClick={onBack}>
                    ← Back
                </button>
                <div className="tool-detail-title">
                    <div className="tool-detail-icon">{tool.icon}</div>
                    <div>
                        <h2>{tool.name}</h2>
                        <p>{tool.description}</p>
                    </div>
                </div>
            </div>

            <div className="tool-content">
                {!selectedFile ? (
                    <div
                        className="upload-zone"
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="upload-icon">📄</div>
                        <p className="upload-text">Click or drag PDF file here</p>
                        <p className="upload-subtext">Protect your PDF with a password</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />
                    </div>
                ) : (
                    <div className="process-section">
                        <div className="file-info">
                            <div className="file-icon">📄</div>
                            <div className="file-details">
                                <div className="file-name">{selectedFile.name}</div>
                                <div className="file-size">
                                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                </div>
                            </div>
                        </div>

                        {processState === 'idle' && (
                            <div className="password-section">
                                <div className="password-input-container">
                                    <label>Enter Password:</label>
                                    <div className="password-wrapper">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Enter a strong password"
                                            className="password-input"
                                        />
                                        <button
                                            className="password-toggle"
                                            onClick={() => setShowPassword(!showPassword)}
                                            type="button"
                                        >
                                            {showPassword ? '👁️' : '👁️‍🗨️'}
                                        </button>
                                    </div>
                                </div>

                                <div className="password-input-container">
                                    <label>Confirm Password:</label>
                                    <div className="password-wrapper">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Re-enter your password"
                                            className="password-input"
                                        />
                                    </div>
                                </div>

                                <div className="password-tips">
                                    <p><strong>Password Tips:</strong></p>
                                    <ul>
                                        <li>Use at least 4 characters (longer is better)</li>
                                        <li>Mix uppercase, lowercase, numbers, and symbols</li>
                                        <li>Store your password securely - it cannot be recovered</li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {processState === 'processing' && (
                            <div className="loader-container">
                                <div className="loader"></div>
                                <p>Encrypting your PDF...</p>
                            </div>
                        )}

                        {processState === 'completed' && (
                            <div className="success-message">
                                <div className="success-icon">✅</div>
                                <p>PDF encrypted successfully!</p>
                                <p className="success-subtext">
                                    Your encrypted PDF has been downloaded.
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="error-message">
                                <span className="error-icon">⚠️</span>
                                {error}
                            </div>
                        )}

                        <div className="action-buttons">
                            {processState === 'idle' && (
                                <>
                                    <button
                                        className="action-btn cancel-btn"
                                        onClick={resetAll}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="action-btn primary-btn"
                                        onClick={handleEncrypt}
                                        disabled={!password || password !== confirmPassword}
                                    >
                                        🔒 Encrypt PDF
                                    </button>
                                </>
                            )}

                            {processState === 'completed' && (
                                <button
                                    className="action-btn primary-btn"
                                    onClick={resetAll}
                                >
                                    Encrypt Another PDF
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .password-section {
                    margin: 20px 0;
                }

                .password-input-container {
                    margin-bottom: 20px;
                }

                .password-input-container label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: #333;
                }

                .password-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .password-input {
                    width: 100%;
                    padding: 12px 45px 12px 12px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 14px;
                    transition: border-color 0.3s;
                }

                .password-input:focus {
                    outline: none;
                    border-color: #007bff;
                }

                .password-toggle {
                    position: absolute;
                    right: 10px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 20px;
                    padding: 5px;
                }

                .password-tips {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 8px;
                    margin-top: 15px;
                }

                .password-tips p {
                    margin: 0 0 10px 0;
                    color: #555;
                }

                .password-tips ul {
                    margin: 0;
                    padding-left: 20px;
                    color: #666;
                }

                .password-tips li {
                    margin: 5px 0;
                    font-size: 14px;
                }

                .action-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
};

export default EncryptPDF;
