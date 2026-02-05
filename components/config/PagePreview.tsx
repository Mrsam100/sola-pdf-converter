/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PagePreview Component
 * Displays thumbnail previews of PDF pages or images
 */

import React, { useState, useEffect } from 'react';

interface PagePreviewProps {
  file: File;
  pageNumber?: number; // For PDFs with multiple pages
  width?: number;
  height?: number;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
  showFileName?: boolean;
}

export const PagePreview: React.FC<PagePreviewProps> = ({
  file,
  pageNumber = 1,
  width = 120,
  height = 160,
  className = '',
  onClick,
  selected = false,
  showFileName = true,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    generatePreview();

    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [file, pageNumber]);

  const generatePreview = async () => {
    try {
      setLoading(true);
      setError('');

      if (file.type.startsWith('image/')) {
        // For images, create direct preview
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else if (file.type.includes('pdf')) {
        // For PDFs, render the specified page
        await renderPDFPage();
      } else {
        setError('Unsupported file type');
      }
    } catch (err) {
      setError('Failed to generate preview');
      console.error('Preview generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderPDFPage = async () => {
    try {
      // Dynamically import pdf.js
      const { pdfjsLib } = await import('../../services/pdfConfig');

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(pageNumber);

      // Create canvas for rendering
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Failed to get canvas context');
      }

      // Calculate scale to fit preview size
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min(width / viewport.width, height / viewport.height);
      const scaledViewport = page.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      // Render PDF page to canvas
      await page.render({
        canvasContext: context,
        viewport: scaledViewport,
      }).promise;

      // Convert canvas to blob URL
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
      });

      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      throw new Error('Failed to render PDF page');
    }
  };

  return (
    <div
      className={`page-preview ${selected ? 'selected' : ''} ${className}`}
      onClick={onClick}
      style={{
        width: `${width}px`,
        display: 'inline-block',
        margin: '8px',
        cursor: onClick ? 'pointer' : 'default',
        border: selected ? '3px solid #4CAF50' : '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#f5f5f5',
        transition: 'all 0.2s ease',
      }}
    >
      <div
        style={{
          width: '100%',
          height: `${height}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff',
        }}
      >
        {loading && (
          <div style={{ textAlign: 'center', color: '#666' }}>
            Loading...
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', color: '#f44336', padding: '10px', fontSize: '12px' }}>
            {error}
          </div>
        )}

        {!loading && !error && previewUrl && (
          <img
            src={previewUrl}
            alt={`${file.name} preview`}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        )}
      </div>

      {showFileName && (
        <div
          style={{
            padding: '8px',
            fontSize: '11px',
            color: '#333',
            backgroundColor: '#f9f9f9',
            borderTop: '1px solid #e0e0e0',
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={file.name}
        >
          {file.name}
          {file.type.includes('pdf') && pageNumber > 1 && ` (p.${pageNumber})`}
        </div>
      )}
    </div>
  );
};
