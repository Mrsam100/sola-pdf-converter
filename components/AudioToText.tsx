/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Tool, ProcessState } from '../types';
import {
    checkBrowserSupport,
    validateAudioFile,
    decodeAudioFile,
    transcribeWithWhisper,
    createSpeechRecognizer,
    SpeechRecognizerHandle,
} from '../services/audioService';
import { useWakeLock } from '../hooks/usePageVisibility';
import { toast } from '../hooks/useToast';
import { formatFileSize } from '../utils/formatFileSize';
import BackButton from './BackButton';
import StepProgress from './StepProgress';

interface AudioToTextProps {
    tool: Tool;
    onBack: () => void;
}

type TabMode = 'record' | 'upload';

const UPLOAD_STEPS = [
    { label: 'Upload' },
    { label: 'AI Model' },
    { label: 'Transcribe' },
    { label: 'Complete' },
];

const RECORD_STEPS = [
    { label: 'Record' },
    { label: 'Complete' },
];

const AudioToText: React.FC<AudioToTextProps> = ({ tool, onBack }) => {
    const support = useRef(checkBrowserSupport());

    // Shared state
    const [activeTab, setActiveTab] = useState<TabMode>(support.current.speechRecognition ? 'record' : 'upload');
    const [resultText, setResultText] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [copied, setCopied] = useState(false);

    // Upload tab state
    const [uploadState, setUploadState] = useState<ProcessState>(ProcessState.IDLE);
    const [file, setFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatus, setUploadStatus] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Record tab state
    const [isRecording, setIsRecording] = useState(false);
    const [recordDuration, setRecordDuration] = useState(0);
    const [interimText, setInterimText] = useState('');
    const [finalParts, setFinalParts] = useState<string[]>([]);
    const recognizerRef = useRef<SpeechRecognizerHandle | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const isProcessing = uploadState === ProcessState.CONVERTING || isRecording;
    useWakeLock(isProcessing);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognizerRef.current) {
                recognizerRef.current.abort();
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    // ========================================
    // Upload Tab Logic
    // ========================================

    const uploadStepIndex = uploadState === ProcessState.IDLE
        ? (file ? 0 : -1)
        : uploadState === ProcessState.CONVERTING
            ? (uploadProgress < 50 ? 1 : 2)
            : 3;

    const validateAndSetFile = useCallback((selectedFile: File) => {
        const validation = validateAudioFile(selectedFile);
        if (!validation.valid) {
            setErrorMsg(validation.error || 'Invalid file');
            return;
        }
        setFile(selectedFile);
        setUploadState(ProcessState.IDLE);
        setResultText('');
        setErrorMsg('');
        setUploadProgress(0);
        setUploadStatus('');
        setCopied(false);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0]);
        }
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

    const handleTranscribeFile = async () => {
        if (!file) return;

        setUploadState(ProcessState.CONVERTING);
        setErrorMsg('');
        setUploadProgress(0);
        setResultText('');

        try {
            setUploadProgress(5);
            setUploadStatus('Decoding audio...');
            const audioData = await decodeAudioFile(file);

            const text = await transcribeWithWhisper(audioData, (progress, status) => {
                setUploadProgress(progress);
                setUploadStatus(status);
            });

            if (!text.trim()) {
                setResultText('(No speech could be detected in this audio file)');
            } else {
                setResultText(text);
            }
            setUploadState(ProcessState.COMPLETED);
            toast.success('Transcription complete!');
        } catch (err) {
            console.error('Transcription error:', err);
            let message = 'An unknown error occurred';
            if (err instanceof Error) {
                message = err.message;
                if (message.includes('decode')) {
                    message = 'Could not decode audio file. Try converting to WAV format first.';
                } else if (message.includes('model') || message.includes('fetch') || message.includes('network')) {
                    message = 'Failed to load AI model. Please check your internet connection and try again.';
                }
            }
            setErrorMsg(message);
            toast.error('Transcription failed');
            setUploadState(ProcessState.IDLE);
            setUploadProgress(0);
            setUploadStatus('');
        }
    };

    // ========================================
    // Record Tab Logic
    // ========================================

    const recordStepIndex = isRecording ? 0 : (finalParts.length > 0 ? 1 : -1);

    const startRecording = () => {
        setErrorMsg('');
        setInterimText('');
        setFinalParts([]);
        setResultText('');
        setRecordDuration(0);
        setCopied(false);

        try {
            const recognizer = createSpeechRecognizer({
                onResult: (transcript, isFinal) => {
                    if (isFinal) {
                        setFinalParts(prev => [...prev, transcript]);
                        setInterimText('');
                    } else {
                        setInterimText(transcript);
                    }
                },
                onError: (error) => {
                    setErrorMsg(error);
                    setIsRecording(false);
                    if (timerRef.current) {
                        clearInterval(timerRef.current);
                        timerRef.current = null;
                    }
                    toast.error('Recording error');
                },
                onEnd: () => {
                    // Auto-restart if still recording (browser may stop after silence)
                    if (recognizerRef.current && isRecordingRef.current) {
                        try {
                            recognizerRef.current.start();
                        } catch {
                            // Recognition may have been stopped intentionally
                            setIsRecording(false);
                        }
                    }
                },
            });

            recognizer.start();
            recognizerRef.current = recognizer;
            setIsRecording(true);

            // Duration timer
            timerRef.current = setInterval(() => {
                setRecordDuration(prev => prev + 1);
            }, 1000);

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to start recording';
            setErrorMsg(message);
            toast.error('Could not start recording');
        }
    };

    // Use a ref to track isRecording for the onEnd callback
    const isRecordingRef = useRef(false);
    useEffect(() => {
        isRecordingRef.current = isRecording;
    }, [isRecording]);

    const stopRecording = () => {
        if (recognizerRef.current) {
            recognizerRef.current.stop();
            recognizerRef.current = null;
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setIsRecording(false);

        // Combine all final parts into result
        setFinalParts(prev => {
            const combined = prev.join(' ').trim();
            if (combined) {
                setResultText(combined);
                toast.success('Recording transcribed!');
            }
            return prev;
        });
    };

    // ========================================
    // Shared Actions
    // ========================================

    const handleDownload = () => {
        if (!resultText) return;
        const blob = new Blob([resultText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const baseName = file?.name.replace(/\.[^.]+$/, '') || 'audio-transcript';
        link.download = `${baseName}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        toast.success('Download started!');
    };

    const handleCopy = async () => {
        if (!resultText) return;
        try {
            await navigator.clipboard.writeText(resultText);
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = resultText;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        setCopied(true);
        toast.success('Copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleReset = () => {
        if (recognizerRef.current) {
            recognizerRef.current.abort();
            recognizerRef.current = null;
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setUploadState(ProcessState.IDLE);
        setFile(null);
        setUploadProgress(0);
        setUploadStatus('');
        setResultText('');
        setErrorMsg('');
        setIsRecording(false);
        setRecordDuration(0);
        setInterimText('');
        setFinalParts([]);
        setCopied(false);
    };

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const wordCount = resultText.trim() ? resultText.trim().split(/\s+/).length : 0;

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

                    {/* Tab Switcher */}
                    <div className="audio-tab-group" role="tablist" aria-label="Transcription mode">
                        {support.current.speechRecognition && (
                            <button
                                role="tab"
                                aria-selected={activeTab === 'record'}
                                className={`audio-tab${activeTab === 'record' ? ' active' : ''}`}
                                onClick={() => { if (!isProcessing) { setActiveTab('record'); setErrorMsg(''); } }}
                                disabled={isProcessing}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="18" height="18">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                                </svg>
                                Record
                            </button>
                        )}
                        <button
                            role="tab"
                            aria-selected={activeTab === 'upload'}
                            className={`audio-tab${activeTab === 'upload' ? ' active' : ''}`}
                            onClick={() => { if (!isProcessing) { setActiveTab('upload'); setErrorMsg(''); } }}
                            disabled={isProcessing}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="18" height="18">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                            Upload File
                        </button>
                    </div>

                    {/* Step Progress */}
                    <div style={{ padding: '1.5rem 1.5rem 0' }}>
                        {activeTab === 'upload' ? (
                            <StepProgress steps={UPLOAD_STEPS} currentStep={uploadStepIndex} />
                        ) : (
                            <StepProgress steps={RECORD_STEPS} currentStep={recordStepIndex} />
                        )}
                    </div>

                    <div className="workspace-body">
                        {/* Error Message */}
                        {errorMsg && (
                            <div className="error-msg">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-sm" style={{ flexShrink: 0 }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                                <div style={{ flex: 1, textAlign: 'left' }}>{errorMsg}</div>
                            </div>
                        )}

                        {/* ==================== RECORD TAB ==================== */}
                        {activeTab === 'record' && !resultText && (
                            <div style={{ textAlign: 'center' }}>
                                {/* Recording Button */}
                                <button
                                    onClick={isRecording ? stopRecording : startRecording}
                                    className={`recording-btn${isRecording ? ' active' : ''}`}
                                    aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                                >
                                    {isRecording ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="32" height="32">
                                            <rect x="6" y="6" width="12" height="12" rx="2" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="32" height="32">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                                        </svg>
                                    )}
                                </button>

                                <div style={{ marginTop: '1rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {isRecording ? 'Listening...' : 'Click to start recording'}
                                </div>

                                {isRecording && (
                                    <div style={{ marginTop: '0.5rem', fontSize: '1.5rem', fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 700 }}>
                                        {formatDuration(recordDuration)}
                                    </div>
                                )}

                                {/* Live transcript preview */}
                                {(finalParts.length > 0 || interimText) && (
                                    <div style={{
                                        marginTop: '1.5rem',
                                        padding: '1rem',
                                        background: 'var(--surface-light)',
                                        borderRadius: 'var(--radius-sm)',
                                        textAlign: 'left',
                                        minHeight: '80px',
                                        maxHeight: '200px',
                                        overflow: 'auto',
                                        border: '1px solid var(--border-color)',
                                    }}>
                                        <span style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
                                            {finalParts.join(' ')}
                                        </span>
                                        {interimText && (
                                            <span className="interim-text"> {interimText}</span>
                                        )}
                                    </div>
                                )}

                                {!isRecording && !finalParts.length && (
                                    <div style={{
                                        marginTop: '2rem',
                                        padding: '1rem',
                                        background: 'var(--info-bg)',
                                        border: '1px solid color-mix(in srgb, var(--info) 30%, transparent)',
                                        borderRadius: 'var(--radius-sm)',
                                    }}>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                            <strong>How it works:</strong> Uses your browser's built-in speech recognition.
                                            Speak clearly into your microphone and see text appear in real-time.
                                            Works best in Chrome and Edge.
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ==================== UPLOAD TAB ==================== */}
                        {activeTab === 'upload' && uploadState === ProcessState.IDLE && !resultText && (
                            <>
                                {file ? (
                                    <div>
                                        <div style={{ padding: '1.5rem', background: 'var(--surface-light)', borderRadius: 'var(--radius-md)', marginBottom: '2rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg" style={{ color: 'var(--text-primary)' }}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                                                </svg>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                                        {file.name}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                        <span className="file-size">{formatFileSize(file.size)}</span>
                                                        <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Ready to transcribe</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{
                                                padding: '1rem',
                                                background: 'var(--info-bg)',
                                                border: '1px solid color-mix(in srgb, var(--info) 30%, transparent)',
                                                borderRadius: 'var(--radius-sm)',
                                            }}>
                                                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                                                    <strong>AI Transcription:</strong> Uses the Whisper model running entirely in your browser.
                                                    <ul style={{ margin: '0.5rem 0 0 1.5rem', paddingLeft: 0 }}>
                                                        <li>First use downloads a small AI model (~40MB, cached for future use)</li>
                                                        <li>All processing happens locally — your audio never leaves your device</li>
                                                        <li>Works best with clear speech in English</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            <button onClick={handleTranscribeFile} className="btn-action" style={{ flex: 1, maxWidth: 'none', marginTop: 0 }}>
                                                Transcribe Audio
                                            </button>
                                            <button onClick={handleReset} className="btn-secondary" style={{ flex: 1, maxWidth: 'none' }}>
                                                Select Different File
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className={`upload-zone${isDragging ? ' drag-over' : ''}`}
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={handleDragOver}
                                        onDragEnter={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        <input
                                            type="file"
                                            accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.wma,.flac,.aiff,.alac,.amr,.opus,.webm"
                                            ref={fileInputRef}
                                            onChange={handleFileSelect}
                                            style={{ display: 'none' }}
                                        />
                                        <div className="upload-icon-wrapper">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                                            </svg>
                                        </div>
                                        <span style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                            {isDragging ? 'Drop your audio file here' : 'Select an audio file to transcribe'}
                                        </span>
                                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                                            MP3, WAV, OGG, M4A, AAC, FLAC, WEBM — up to 25MB
                                        </span>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Upload Processing State */}
                        {activeTab === 'upload' && uploadState === ProcessState.CONVERTING && (
                            <div className="result-area" style={{ padding: '3rem 0' }} aria-live="polite">
                                <div style={{ maxWidth: '300px', margin: '0 auto 2rem' }}>
                                    <div className="loader">
                                        <div className="loader-bar" style={{ width: `${uploadProgress}%`, animation: uploadProgress > 0 ? 'none' : undefined }}></div>
                                    </div>
                                    <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        {Math.round(uploadProgress)}%
                                    </div>
                                </div>
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>
                                    {uploadProgress < 50 ? 'Loading AI Model...' : 'Transcribing...'}
                                </h3>
                                <p className="workspace-desc">{uploadStatus || 'Processing your audio file.'}</p>
                                {uploadProgress < 50 && (
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginTop: '1rem' }}>
                                        First-time model download may take a moment. It will be cached for future use.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* ==================== RESULT VIEW (shared) ==================== */}
                        {resultText && (uploadState === ProcessState.COMPLETED || (activeTab === 'record' && !isRecording && finalParts.length > 0)) && (
                            <div className="result-area animate-fade-in">
                                <div className="success-check-animated">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="#fff" width="28" height="28">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                </div>
                                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Transcription Complete!</h3>

                                <div style={{ textAlign: 'left', marginBottom: '1rem', width: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            Transcribed Text
                                        </label>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                            {wordCount} word{wordCount !== 1 ? 's' : ''} &middot; {resultText.length} characters
                                        </span>
                                    </div>
                                    <textarea
                                        value={resultText}
                                        onChange={(e) => setResultText(e.target.value)}
                                        style={{
                                            width: '100%',
                                            minHeight: '200px',
                                            maxHeight: '400px',
                                            padding: '1rem',
                                            fontFamily: 'monospace',
                                            fontSize: '0.875rem',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-sm)',
                                            resize: 'vertical',
                                            background: 'var(--surface-light)',
                                            color: 'var(--text-primary)',
                                        }}
                                    />
                                </div>

                                <div className="action-row">
                                    <button onClick={handleDownload} className="btn-secondary btn-primary-alt">
                                        Download as TXT
                                    </button>
                                    <button onClick={handleCopy} className="btn-secondary">
                                        {copied ? 'Copied!' : 'Copy to Clipboard'}
                                    </button>
                                    <button onClick={handleReset} className="btn-secondary">
                                        Start Over
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
                        All processing happens in your browser. Your audio never leaves your device.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AudioToText;
