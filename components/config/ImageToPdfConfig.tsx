/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Image to PDF Configuration Dashboard
 * Professional-grade configuration UI matching ilovepdf.com quality
 * Ready for millions of users
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { ImageToPdfConfig, PageSize, Orientation, MarginSize, ImageQuality } from '../../types';
import { DEFAULT_IMAGE_TO_PDF_CONFIG } from '../../types';
import { configService } from '../../services/configService';
import { DragDropReorder } from './DragDropReorder';

interface ImageToPdfConfigProps {
  files: File[];
  onConfigChange: (config: ImageToPdfConfig) => void;
  onConvert: (config: ImageToPdfConfig) => void;
  onCancel: () => void;
}

export const ImageToPdfConfig: React.FC<ImageToPdfConfigProps> = ({
  files,
  onConfigChange,
  onConvert,
  onCancel,
}) => {
  // Load saved config or use defaults
  const [config, setConfig] = useState<ImageToPdfConfig>(() =>
    configService.loadConfig<ImageToPdfConfig>('image-to-pdf')
  );

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);

  // Initialize image order with file names
  useEffect(() => {
    if (files.length > 0 && config.imageOrder.length === 0) {
      setConfig(prev => ({
        ...prev,
        imageOrder: files.map(f => f.name),
      }));
    }
  }, [files]);

  // Generate preview URLs
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    setImagePreviewUrls(urls);

    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [files]);

  // Calculate dynamic page dimensions based on config
  const pageDimensions = useMemo(() => {
    // Base dimensions (in mm, scaled down for display)
    const sizes = {
      A4: { width: 210, height: 297 },
      Letter: { width: 216, height: 279 },
      Legal: { width: 216, height: 356 },
      A3: { width: 297, height: 420 },
      A5: { width: 148, height: 210 },
    };

    const base = sizes[config.pageSize] || sizes.A4;
    const scale = 1.4; // Scale for better visibility

    if (config.orientation === 'landscape') {
      return {
        width: base.height * scale,
        height: base.width * scale,
      };
    }

    return {
      width: base.width * scale,
      height: base.height * scale,
    };
  }, [config.orientation, config.pageSize]);

  // Calculate margin padding
  const marginPadding = useMemo(() => {
    const margins = {
      none: 0,
      small: 10,
      medium: 20,
      large: 30,
    };
    return margins[config.margin] || 0;
  }, [config.margin]);

  const updateConfig = (updates: Partial<ImageToPdfConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange(newConfig);
    configService.saveConfig('image-to-pdf', newConfig);
  };

  const handleConvert = () => {
    onConvert(config);
  };

  const pageSizes: PageSize[] = ['A4', 'Letter', 'Legal', 'A3', 'A5'];
  const margins: { value: MarginSize; label: string }[] = [
    { value: 'none', label: 'No margin' },
    { value: 'small', label: 'Small (10mm)' },
    { value: 'medium', label: 'Medium (20mm)' },
    { value: 'large', label: 'Large (30mm)' },
  ];
  const qualities: { value: ImageQuality; label: string; description: string }[] = [
    { value: 'original', label: 'Original', description: 'Best quality, largest file' },
    { value: 'high', label: 'High', description: 'Recommended' },
    { value: 'medium', label: 'Medium', description: 'Good balance' },
    { value: 'low', label: 'Low', description: 'Smallest file' },
  ];

  const containerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '60% 40%',
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
  };

  const previewSectionStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const configSectionStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    padding: '40px 32px',
    borderLeft: '1px solid #e9ecef',
    display: 'flex',
    flexDirection: 'column',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '28px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: '600',
    color: '#212529',
    marginBottom: '12px',
    display: 'block',
  };

  const buttonGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
  };

  const orientationButtonStyle = (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '16px',
    border: isActive ? '2px solid #d5232b' : '2px solid #dee2e6',
    borderRadius: '8px',
    backgroundColor: isActive ? '#fff5f5' : '#fff',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    outline: 'none',
  });

  const marginButtonStyle = (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '20px 12px',
    border: isActive ? '2px solid #d5232b' : '2px solid #dee2e6',
    borderRadius: '8px',
    backgroundColor: isActive ? '#fff5f5' : '#fff',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    outline: 'none',
  });

  return (
    <div style={containerStyle}>
      {/* LEFT: Preview Section */}
      <div style={previewSectionStyle}>
        {imagePreviewUrls.length > 0 && (
          <div style={{
            position: 'relative',
            maxWidth: '450px',
            width: '100%',
          }}>
            {/* Add more files badge (if multiple files) */}
            {files.length > 1 && (
              <div style={{
                position: 'absolute',
                top: '-10px',
                right: '-10px',
                zIndex: 10,
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#d5232b',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: '700',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  position: 'relative',
                }}>
                  {files.length}
                  <div style={{
                    position: 'absolute',
                    bottom: '-4px',
                    right: '-4px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#d5232b',
                    border: '2px solid #fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: '300',
                  }}>
                    +
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic Live Preview */}
            <div style={{
              padding: '24px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              textAlign: 'center',
              position: 'relative',
              minHeight: '550px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {/* Page representation */}
              <div style={{
                position: 'relative',
                backgroundColor: '#fff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                borderRadius: '4px',
                width: `${pageDimensions.width}px`,
                height: `${pageDimensions.height}px`,
                maxWidth: '100%',
                maxHeight: '500px',
                padding: `${marginPadding}px`,
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
                border: '2px solid #e0e0e0',
              }}>
                {/* Margin visualization */}
                {marginPadding > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    border: `${marginPadding}px dashed rgba(213, 35, 43, 0.3)`,
                    pointerEvents: 'none',
                    transition: 'border 0.3s ease',
                  }} />
                )}

                {/* Image inside the page with margins applied */}
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#fafafa',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}>
                  <img
                    src={imagePreviewUrls[selectedImageIndex]}
                    alt={files[selectedImageIndex].name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: config.fitToPage ? 'contain' : 'cover',
                      transition: 'all 0.3s ease',
                    }}
                  />
                </div>
              </div>

              {/* Configuration indicator overlay */}
              <div style={{
                position: 'absolute',
                bottom: '32px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(213, 35, 43, 0.95)',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}>
                {config.orientation === 'portrait' ? '📄 Portrait' : '📺 Landscape'} • {config.pageSize} • Margin: {config.margin}
              </div>
            </div>

            {/* File name */}
            <div style={{
              marginTop: '16px',
              textAlign: 'center',
              fontSize: '13px',
              color: '#6c757d',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {files[selectedImageIndex].name}
            </div>

            {/* Navigation for multiple images */}
            {files.length > 1 && (
              <div style={{
                marginTop: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
              }}>
                <button
                  onClick={() => setSelectedImageIndex(Math.max(0, selectedImageIndex - 1))}
                  disabled={selectedImageIndex === 0}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    backgroundColor: '#fff',
                    cursor: selectedImageIndex === 0 ? 'not-allowed' : 'pointer',
                    opacity: selectedImageIndex === 0 ? 0.5 : 1,
                    fontSize: '13px',
                  }}
                >
                  ← Prev
                </button>
                <span style={{ fontSize: '13px', color: '#6c757d' }}>
                  {selectedImageIndex + 1} / {files.length}
                </span>
                <button
                  onClick={() => setSelectedImageIndex(Math.min(files.length - 1, selectedImageIndex + 1))}
                  disabled={selectedImageIndex === files.length - 1}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    backgroundColor: '#fff',
                    cursor: selectedImageIndex === files.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: selectedImageIndex === files.length - 1 ? 0.5 : 1,
                    fontSize: '13px',
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: Configuration Section */}
      <div style={configSectionStyle}>
        {/* Header */}
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#212529', marginBottom: '32px' }}>
          Image to PDF options
        </h2>

        {/* Page Orientation */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Page orientation</label>
          <div style={buttonGroupStyle}>
            <button
              style={orientationButtonStyle(config.orientation === 'portrait')}
              onClick={() => updateConfig({ orientation: 'portrait' })}
            >
              <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
                <rect x="1" y="1" width="22" height="30" rx="2" stroke={config.orientation === 'portrait' ? '#d5232b' : '#adb5bd'} strokeWidth="2" fill="none"/>
              </svg>
              <span style={{ fontSize: '14px', color: config.orientation === 'portrait' ? '#d5232b' : '#495057', fontWeight: config.orientation === 'portrait' ? '600' : '400' }}>
                Portrait
              </span>
            </button>
            <button
              style={orientationButtonStyle(config.orientation === 'landscape')}
              onClick={() => updateConfig({ orientation: 'landscape' })}
            >
              <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
                <rect x="1" y="1" width="30" height="22" rx="2" stroke={config.orientation === 'landscape' ? '#d5232b' : '#adb5bd'} strokeWidth="2" fill="none"/>
              </svg>
              <span style={{ fontSize: '14px', color: config.orientation === 'landscape' ? '#d5232b' : '#495057', fontWeight: config.orientation === 'landscape' ? '600' : '400' }}>
                Landscape
              </span>
            </button>
          </div>
        </div>

        {/* Page Size */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Page size</label>
          <select
            value={config.pageSize}
            onChange={(e) => updateConfig({ pageSize: e.target.value as PageSize })}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#495057',
              backgroundColor: '#fff',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {pageSizes.map(size => (
              <option key={size} value={size}>
                {size} {size === 'A4' ? '(297x210 mm)' : size === 'Letter' ? '(279x216 mm)' : size === 'Legal' ? '(356x216 mm)' : size === 'A3' ? '(420x297 mm)' : '(210x148 mm)'}
              </option>
            ))}
          </select>
        </div>

        {/* Margin */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Margin</label>
          <div style={buttonGroupStyle}>
            <button
              style={marginButtonStyle(config.margin === 'none')}
              onClick={() => updateConfig({ margin: 'none' })}
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="4" y="4" width="32" height="32" rx="2" stroke={config.margin === 'none' ? '#d5232b' : '#adb5bd'} strokeWidth="2" fill={config.margin === 'none' ? '#d5232b' : '#adb5bd'}/>
              </svg>
              <span style={{ fontSize: '13px', color: config.margin === 'none' ? '#d5232b' : '#495057', fontWeight: config.margin === 'none' ? '600' : '400' }}>
                No margin
              </span>
            </button>
            <button
              style={marginButtonStyle(config.margin === 'small')}
              onClick={() => updateConfig({ margin: 'small' })}
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="4" y="4" width="32" height="32" rx="2" stroke={config.margin === 'small' ? '#d5232b' : '#adb5bd'} strokeWidth="2" fill="none"/>
                <rect x="8" y="8" width="24" height="24" rx="1" fill={config.margin === 'small' ? '#d5232b' : '#adb5bd'}/>
              </svg>
              <span style={{ fontSize: '13px', color: config.margin === 'small' ? '#d5232b' : '#495057', fontWeight: config.margin === 'small' ? '600' : '400' }}>
                Small
              </span>
            </button>
            <button
              style={marginButtonStyle(config.margin === 'medium')}
              onClick={() => updateConfig({ margin: 'medium' })}
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="4" y="4" width="32" height="32" rx="2" stroke={config.margin === 'medium' ? '#d5232b' : '#adb5bd'} strokeWidth="2" fill="none"/>
                <rect x="10" y="10" width="20" height="20" rx="1" fill={config.margin === 'medium' ? '#d5232b' : '#adb5bd'}/>
              </svg>
              <span style={{ fontSize: '13px', color: config.margin === 'medium' ? '#d5232b' : '#495057', fontWeight: config.margin === 'medium' ? '600' : '400' }}>
                Big
              </span>
            </button>
          </div>
        </div>

        {/* Merge all images checkbox */}
        <div style={sectionStyle}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={files.length > 1}
              disabled={true}
              style={{
                width: '18px',
                height: '18px',
                accentColor: '#17c1bc',
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: '14px', color: '#495057' }}>
              Merge all images in one PDF file
            </span>
          </label>
        </div>

        {/* Spacer to push button to bottom */}
        <div style={{ flex: 1 }} />

        {/* Convert Button */}
        <button
          onClick={handleConvert}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: '#d5232b',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background-color 0.2s',
            marginTop: 'auto',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#b81f26';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#d5232b';
          }}
        >
          Convert to PDF
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginLeft: '4px' }}>
            <circle cx="10" cy="10" r="9" stroke="white" strokeWidth="2" fill="none"/>
            <path d="M8 10L12 10M12 10L10 8M12 10L10 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};
