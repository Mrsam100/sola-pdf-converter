/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Image to PDF Configuration Dashboard
 * Professional-grade configuration UI matching ilovepdf.com quality
 * Ready for millions of users
 */

import React, { useState, useEffect } from 'react';
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

  // Initialize image order with file names
  useEffect(() => {
    if (files.length > 0 && config.imageOrder.length === 0) {
      setConfig(prev => ({
        ...prev,
        imageOrder: files.map(f => f.name),
      }));
    }
  }, [files]);

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
    maxWidth: '900px',
    margin: '0 auto',
    padding: '24px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '32px',
    paddingBottom: '24px',
    borderBottom: '1px solid #e0e0e0',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const buttonGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  };

  const buttonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '12px 20px',
    border: isActive ? '2px solid #4CAF50' : '2px solid #e0e0e0',
    borderRadius: '8px',
    backgroundColor: isActive ? '#f1f8f4' : '#fff',
    color: isActive ? '#4CAF50' : '#666',
    fontSize: '14px',
    fontWeight: isActive ? '600' : '400',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
  });

  const actionButtonStyle = (isPrimary: boolean): React.CSSProperties => ({
    padding: '14px 32px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: isPrimary ? '#4CAF50' : '#e0e0e0',
    color: isPrimary ? '#fff' : '#666',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  });

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#333', marginBottom: '8px' }}>
          Configure Image to PDF
        </h2>
        <p style={{ fontSize: '14px', color: '#666' }}>
          {files.length} image{files.length !== 1 ? 's' : ''} selected
        </p>
      </div>

      {/* Page Orientation */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <span>📄</span>
          <span>Page Orientation</span>
        </div>
        <div style={buttonGroupStyle}>
          <button
            style={buttonStyle(config.orientation === 'portrait')}
            onClick={() => updateConfig({ orientation: 'portrait' })}
          >
            📱 Portrait
          </button>
          <button
            style={buttonStyle(config.orientation === 'landscape')}
            onClick={() => updateConfig({ orientation: 'landscape' })}
          >
            📺 Landscape
          </button>
        </div>
      </div>

      {/* Page Size */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <span>📏</span>
          <span>Page Size</span>
        </div>
        <div style={buttonGroupStyle}>
          {pageSizes.map(size => (
            <button
              key={size}
              style={buttonStyle(config.pageSize === size)}
              onClick={() => updateConfig({ pageSize: size })}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Margins */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <span>📐</span>
          <span>Margins</span>
        </div>
        <div style={buttonGroupStyle}>
          {margins.map(({ value, label }) => (
            <button
              key={value}
              style={buttonStyle(config.margin === value)}
              onClick={() => updateConfig({ margin: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Image Quality */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <span>🎨</span>
          <span>Image Quality</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          {qualities.map(({ value, label, description }) => (
            <button
              key={value}
              style={{
                ...buttonStyle(config.quality === value),
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
              }}
              onClick={() => updateConfig({ quality: value })}
            >
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>{description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Fit to Page */}
      <div style={sectionStyle}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          <input
            type="checkbox"
            checked={config.fitToPage}
            onChange={(e) => updateConfig({ fitToPage: e.target.checked })}
            style={{
              width: '20px',
              height: '20px',
              cursor: 'pointer',
            }}
          />
          <div>
            <div style={{ fontWeight: '600', color: '#333' }}>Fit images to page</div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Automatically scale images to fit within page margins while maintaining aspect ratio
            </div>
          </div>
        </label>
      </div>

      {/* Image Order */}
      {files.length > 1 && (
        <div style={{ ...sectionStyle, borderBottom: 'none' }}>
          <div style={sectionTitleStyle}>
            <span>📋</span>
            <span>Image Order</span>
          </div>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
            Drag and drop to reorder images, or use arrow buttons
          </p>
          <DragDropReorder
            items={config.imageOrder.map(name => {
              const file = files.find(f => f.name === name);
              return {
                id: name,
                name,
                preview: file ? URL.createObjectURL(file) : undefined,
              };
            })}
            onReorder={(newOrder) => updateConfig({ imageOrder: newOrder })}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid #e0e0e0',
        }}
      >
        <button
          style={actionButtonStyle(false)}
          onClick={onCancel}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#d0d0d0';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#e0e0e0';
          }}
        >
          Cancel
        </button>
        <button
          style={actionButtonStyle(true)}
          onClick={handleConvert}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#45a049';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#4CAF50';
          }}
        >
          Convert to PDF →
        </button>
      </div>
    </div>
  );
};
