/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef } from 'react';
import { Tool, ProcessState } from '../types';
import { convertFile } from '../services/geminiService';
import MergePDF from './MergePDF';
import SplitPDF from './SplitPDF';
import CompressPDF from './CompressPDF';
import RotatePDF from './RotatePDF';
import PDFToJPG from './PDFToJPG';
import ImageToPDF from './ImageToPDF';
import PDFToWord from './PDFToWord';
import WordToPDF from './WordToPDF';
import EncryptPDF from './EncryptPDF';
import UnlockPDF from './UnlockPDF';
import EditPDF from './EditPDF';
import RemoveBackground from './RemoveBackground';
import ImageConverter from './ImageConverter';

interface ToolDetailProps {
  tool: Tool;
  onBack: () => void;
}

const ProductDetail: React.FC<ToolDetailProps> = ({ tool, onBack }) => {
  // Route to specialized PDF components
  if (tool.id === 'pdf-merge') {
    return <MergePDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'pdf-split') {
    return <SplitPDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'compress-pdf') {
    return <CompressPDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'rotate-pdf') {
    return <RotatePDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'pdf-jpg') {
    return <PDFToJPG tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'jpg-pdf') {
    return <ImageToPDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'pdf-word') {
    return <PDFToWord tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'word-pdf') {
    return <WordToPDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'encrypt-pdf') {
    return <EncryptPDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'unlock-pdf') {
    return <UnlockPDF tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'edit-pdf') {
    return <EditPDF tool={tool} onBack={onBack} />;
  }

  // Route to image processing components
  if (tool.id === 'remove-bg') {
    return <RemoveBackground tool={tool} onBack={onBack} />;
  }
  if (tool.id === 'jpg-png' || tool.id === 'png-jpg' || tool.id === 'heic-jpg') {
    return <ImageConverter tool={tool} onBack={onBack} />;
  }

  // Default converter for other tools

  const [state, setState] = useState<ProcessState>(ProcessState.IDLE);
  const [fileName, setFileName] = useState<string>('');
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [resultText, setResultText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAcceptTypes = (toolId: string, category: string) => {
      if (toolId === 'audio-text') return 'audio/*,.mp3,.wav,.ogg,.m4a,.aac,.wma,.flac,.aiff,.alac,.amr,.opus,.webm';
      if (category === 'Image') return 'image/*';
      if (category === 'PDF') return '.pdf';
      return '*/*';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];

          // Validate file size (max 20MB for API uploads)
          const maxSize = 20 * 1024 * 1024; // 20MB
          if (file.size > maxSize) {
              setErrorMsg('File is too large. Maximum size is 20MB');
              return;
          }

          // Validate file type for audio
          if (tool.id === 'audio-text') {
              const validAudioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.wma', '.flac', '.aiff', '.alac', '.amr', '.opus', '.webm'];
              const fileName = file.name.toLowerCase();
              const hasValidExtension = validAudioExtensions.some(ext => fileName.endsWith(ext));
              const isAudioType = file.type && file.type.startsWith('audio/');

              // Accept if either MIME type is audio OR file has valid audio extension
              if (!hasValidExtension && !isAudioType) {
                  setErrorMsg(`Invalid audio file. Supported formats: MP3, WAV, OGG, M4A, AAC, WMA, FLAC, AIFF, ALAC, AMR, OPUS, WEBM`);
                  return;
              }
          }

          setFileObj(file);
          setFileName(file.name);
          setState(ProcessState.IDLE);
          setResultText('');
          setErrorMsg('');
      }
  };

  const handleConvert = async () => {
      if (!fileObj) return;

      setState(ProcessState.CONVERTING);
      setErrorMsg('');

      try {
          const result = await convertFile(fileObj, tool.id);
          setResultText(result);
          setState(ProcessState.COMPLETED);
      } catch (err) {
          console.error('Conversion error:', err);

          let errorMessage = "An unknown error occurred";
          if (err instanceof Error) {
              errorMessage = err.message;

              // Provide helpful error messages
              if (errorMessage.includes('API Key missing')) {
                  errorMessage = 'API Key not configured. Please add GEMINI_API_KEY to your .env file.';
              } else if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
                  errorMessage = 'API quota exceeded. Please try again later or check your API limits.';
              } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
                  errorMessage = 'Network error. Please check your internet connection and try again.';
              } else if (errorMessage.includes('unsupported')) {
                  errorMessage = 'This file format is not supported. Please try a different file.';
              }
          }

          setErrorMsg(errorMessage);
          setState(ProcessState.IDLE);
      }
  };

  const handleDownload = () => {
      if (!resultText) return;
      
      const element = document.createElement("a");
      const file = new Blob([resultText], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      const namePart = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
      element.download = `${namePart}_converted.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
  };

  const handleReset = () => {
      setState(ProcessState.IDLE);
      setFileName('');
      setFileObj(null);
      setResultText('');
      setErrorMsg('');
  };

  return (
    <div className="detail-view animate-fade-in">
      <div className="container">
        
        {/* Navigation */}
        <button 
          onClick={onBack}
          className="back-btn"
        >
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
                    <div className="error-msg">
                        {errorMsg}
                    </div>
                )}

                {state === ProcessState.IDLE || state === ProcessState.UPLOADING ? (
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
                            accept={getAcceptTypes(tool.id, tool.category)}
                        />
                        
                        {fileName ? (
                             <div className="file-preview">
                                <div className="upload-icon-wrapper" style={{ color: '#2C2A26', background: 'transparent' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-xl">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                </div>
                                <span className="file-name">{fileName}</span>
                                <span className="label-text" style={{ fontSize: '0.875rem' }}>Ready to convert</span>
                             </div>
                        ) : (
                            <div className="file-preview" style={{ cursor: 'pointer' }}>
                                <div className="upload-icon-wrapper">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                    </svg>
                                </div>
                                <span style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem', color: '#2C2A26' }}>Drop your file here</span>
                                <span style={{ color: '#A8A29E', fontSize: '0.875rem' }}>or click to browse</span>
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
                        <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Processing...</h3>
                        <p className="workspace-desc">Our AI is analyzing your document.</p>
                    </div>
                ) : (
                    <div className="result-area animate-fade-in">
                         <div className="success-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-lg">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                        </div>
                        <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Success!</h3>
                        <p className="workspace-desc" style={{ marginBottom: '2rem' }}>Your file has been processed successfully.</p>
                        
                        {resultText && (
                            <div style={{ textAlign: 'left', marginBottom: '2rem', width: '100%' }}>
                                <label className="label-text">Preview</label>
                                <textarea 
                                    readOnly 
                                    value={resultText}
                                    className="conversion-output"
                                />
                            </div>
                        )}
                        
                        <div className="action-row">
                            <button 
                                onClick={handleDownload}
                                className="btn-secondary btn-primary-alt"
                            >
                                Download Result
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

                {state === ProcessState.IDLE && fileName && (
                    <div className="flex-center">
                        <button 
                            onClick={handleConvert}
                            className="btn-action"
                        >
                            Start Processing
                        </button>
                    </div>
                )}
            </div>

            {/* Footer of card */}
            <div className="workspace-footer">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-sm">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Files are encrypted and processed securely.
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;