/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { Tool, ProcessState } from '../types';
import { removeBackground, downloadBlob } from '../services/imageService';
import BackButton from './BackButton';

interface RemoveBackgroundProps {
  tool: Tool;
  onBack: () => void;
}

const RemoveBackground: React.FC<RemoveBackgroundProps> = ({ tool, onBack }) => {
  const [state, setState] = useState<ProcessState>(ProcessState.IDLE);
  const [fileName, setFileName] = useState<string>('');
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string>('');
  const [processedPreview, setProcessedPreview] = useState<string>('');
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [threshold, setThreshold] = useState<number>(30);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Please select a valid image file');
        return;
      }

      // Validate file size (max 10MB for images)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        setErrorMsg('Image is too large. Maximum size is 10MB');
        return;
      }

      setFileObj(file);
      setFileName(file.name);
      setState(ProcessState.IDLE);
      setErrorMsg('');
      setProcessedPreview('');
      setProcessedBlob(null);

      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setOriginalPreview(event.target.result as string);
        }
      };
      reader.onerror = () => {
        setErrorMsg('Failed to read image file');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveBackground = async () => {
    if (!fileObj) return;

    setState(ProcessState.CONVERTING);
    setErrorMsg('');

    try {
      const blob = await removeBackground(fileObj, threshold);
      setProcessedBlob(blob);

      // Create preview
      const url = URL.createObjectURL(blob);
      setProcessedPreview(url);

      setState(ProcessState.COMPLETED);
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to remove background");
      setState(ProcessState.IDLE);
    }
  };

  const handleDownload = () => {
    if (!processedBlob) return;

    const namePart = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
    downloadBlob(processedBlob, `${namePart}_no_bg.png`);
  };

  const handleReset = () => {
    // Clean up blob URLs to prevent memory leaks
    if (originalPreview && originalPreview.startsWith('blob:')) {
      URL.revokeObjectURL(originalPreview);
    }
    if (processedPreview && processedPreview.startsWith('blob:')) {
      URL.revokeObjectURL(processedPreview);
    }

    setState(ProcessState.IDLE);
    setFileName('');
    setFileObj(null);
    setOriginalPreview('');
    setProcessedPreview('');
    setProcessedBlob(null);
    setErrorMsg('');
  };

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setThreshold(Number(e.target.value));
  };

  // Cleanup blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (originalPreview && originalPreview.startsWith('blob:')) {
        URL.revokeObjectURL(originalPreview);
      }
      if (processedPreview && processedPreview.startsWith('blob:')) {
        URL.revokeObjectURL(processedPreview);
      }
    };
  }, [originalPreview, processedPreview]);

  return (
    <div className="detail-view animate-fade-in">
      <div className="container">

        {/* Navigation */}
        <BackButton onBack={onBack} />

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
              <div className="error-msg">
                {errorMsg}
              </div>
            )}

            {state === ProcessState.IDLE || state === ProcessState.UPLOADING ? (
              <div>
                <div
                  className={`upload-zone ${fileName ? 'active' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    className="hidden"
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                  />

                  {fileName ? (
                    <div className="file-preview">
                      <div className="upload-icon-wrapper" style={{ color: 'var(--text-primary)', background: 'transparent' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-xl">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                      </div>
                      <span className="file-name">{fileName}</span>
                      <span className="label-text" style={{ fontSize: '0.875rem' }}>Ready to process</span>
                    </div>
                  ) : (
                    <div className="file-preview" style={{ cursor: 'pointer' }}>
                      <div className="upload-icon-wrapper">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                      </div>
                      <span style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Drop your image here</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>or click to browse</span>
                    </div>
                  )}
                </div>

                {originalPreview && (
                  <div style={{ marginTop: '2rem' }}>
                    <label className="label-text">Original Image</label>
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
                        alt="Original"
                        style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }}
                      />
                    </div>

                    <div style={{ marginTop: '1.5rem' }}>
                      <label className="label-text">
                        Sensitivity: {threshold}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginLeft: '0.5rem' }}>
                          (Lower = stricter, Higher = more removal)
                        </span>
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={threshold}
                        onChange={handleThresholdChange}
                        style={{
                          width: '100%',
                          marginTop: '0.5rem',
                          accentColor: 'var(--text-primary)'
                        }}
                      />
                    </div>
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
                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Removing Background...</h3>
                <p className="workspace-desc">Processing your image</p>
              </div>
            ) : (
              <div className="result-area animate-fade-in">
                <div className="success-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-lg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Success!</h3>
                <p className="workspace-desc" style={{ marginBottom: '2rem' }}>Background removed successfully</p>

                <div className="comparison-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
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
                  </div>
                  <div>
                    <label className="label-text">No Background</label>
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '1rem',
                      background: 'repeating-conic-gradient(var(--surface-light) 0% 25%, var(--surface-alt) 0% 50%) 50% / 20px 20px',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      minHeight: '150px'
                    }}>
                      <img
                        src={processedPreview}
                        alt="Processed"
                        style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }}
                      />
                    </div>
                  </div>
                </div>

                <div className="action-row">
                  <button
                    onClick={handleDownload}
                    className="btn-secondary btn-primary-alt"
                  >
                    Download PNG
                  </button>
                  <button
                    onClick={handleReset}
                    className="btn-secondary"
                  >
                    Process Another
                  </button>
                </div>
              </div>
            )}

            {state === ProcessState.IDLE && fileName && (
              <div className="flex-center" style={{ marginTop: '1.5rem' }}>
                <button
                  onClick={handleRemoveBackground}
                  className="btn-action"
                >
                  Remove Background
                </button>
              </div>
            )}
          </div>

          {/* Footer of card */}
          <div className="workspace-footer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-sm">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            All processing happens in your browser. No uploads required.
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemoveBackground;
