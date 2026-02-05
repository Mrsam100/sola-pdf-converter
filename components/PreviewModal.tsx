/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Real-time Preview Modal
 * Shows preview of files before conversion
 * Optimized for production with lazy loading and memory management
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PagePreview } from './config/PagePreview';

interface PreviewModalProps {
  files: File[];
  onClose: () => void;
  onProceed: () => void;
  toolName: string;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  files,
  onClose,
  onProceed,
  toolName,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  // Generate preview URLs
  useEffect(() => {
    const generatePreviews = async () => {
      setLoading(true);
      const urls: string[] = [];

      for (const file of files) {
        if (file.type.startsWith('image/')) {
          urls.push(URL.createObjectURL(file));
        } else {
          urls.push(''); // PDF previews handled by PagePreview component
        }
      }

      setPreviewUrls(urls);
      setLoading(false);
    };

    generatePreviews();
  }, [files]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      } else if (e.key === 'ArrowRight' && selectedIndex < files.length - 1) {
        setSelectedIndex(selectedIndex + 1);
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        onProceed();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedIndex, files.length, onClose, onProceed]);

  // Click outside to close
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === modalRef.current) {
      onClose();
    }
  }, [onClose]);

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          maxWidth: '1200px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#333', margin: 0 }}>
              Preview - {toolName}
            </h2>
            <p style={{ fontSize: '14px', color: '#666', margin: '4px 0 0 0' }}>
              {files.length} file{files.length !== 1 ? 's' : ''} ready for conversion
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '24px',
              color: '#666',
              lineHeight: 1,
            }}
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* Preview Area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          {/* Main Preview */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f5f5f5',
              position: 'relative',
              padding: '40px',
            }}
          >
            {loading ? (
              <div style={{ textAlign: 'center', color: '#666' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                <div>Loading preview...</div>
              </div>
            ) : (
              <>
                {/* Navigation Arrows */}
                {files.length > 1 && (
                  <>
                    <button
                      onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                      disabled={selectedIndex === 0}
                      style={{
                        position: 'absolute',
                        left: '16px',
                        padding: '16px',
                        border: 'none',
                        borderRadius: '50%',
                        backgroundColor: '#fff',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        cursor: selectedIndex === 0 ? 'not-allowed' : 'pointer',
                        opacity: selectedIndex === 0 ? 0.3 : 1,
                        fontSize: '24px',
                        transition: 'all 0.2s',
                      }}
                      title="Previous (←)"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => setSelectedIndex(Math.min(files.length - 1, selectedIndex + 1))}
                      disabled={selectedIndex === files.length - 1}
                      style={{
                        position: 'absolute',
                        right: '16px',
                        padding: '16px',
                        border: 'none',
                        borderRadius: '50%',
                        backgroundColor: '#fff',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        cursor: selectedIndex === files.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: selectedIndex === files.length - 1 ? 0.3 : 1,
                        fontSize: '24px',
                        transition: 'all 0.2s',
                      }}
                      title="Next (→)"
                    >
                      →
                    </button>
                  </>
                )}

                {/* Preview Content */}
                <div style={{ maxWidth: '100%', maxHeight: '100%', textAlign: 'center' }}>
                  {files[selectedIndex].type.startsWith('image/') ? (
                    <img
                      src={previewUrls[selectedIndex]}
                      alt={files[selectedIndex].name}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '60vh',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      }}
                    />
                  ) : (
                    <div style={{ width: '400px', margin: '0 auto' }}>
                      <PagePreview
                        file={files[selectedIndex]}
                        pageNumber={1}
                        width={400}
                        height={550}
                        showFileName={false}
                      />
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: '16px',
                      fontSize: '14px',
                      color: '#666',
                      fontWeight: '500',
                    }}
                  >
                    {files[selectedIndex].name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                    {(files[selectedIndex].size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Thumbnail Sidebar */}
          {files.length > 1 && (
            <div
              style={{
                width: '200px',
                borderLeft: '1px solid #e0e0e0',
                backgroundColor: '#fafafa',
                overflowY: 'auto',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#666', marginBottom: '12px' }}>
                ALL FILES ({files.length})
              </div>
              {files.map((file, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedIndex(index)}
                  style={{
                    padding: '8px',
                    marginBottom: '8px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: selectedIndex === index ? '#e3f2fd' : '#fff',
                    border: selectedIndex === index ? '2px solid #2196F3' : '1px solid #e0e0e0',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: '500', color: '#333', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {index + 1}. {file.name}
                  </div>
                  <div style={{ fontSize: '10px', color: '#999' }}>
                    {(file.size / 1024).toFixed(0)} KB
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '24px',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#fafafa',
          }}
        >
          <div style={{ fontSize: '13px', color: '#666' }}>
            {selectedIndex + 1} of {files.length} • Use ← → to navigate • Press Enter to proceed
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '12px 24px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: '#fff',
                color: '#666',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Cancel
            </button>
            <button
              onClick={onProceed}
              style={{
                padding: '12px 32px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: '#4CAF50',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Proceed to Convert →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
