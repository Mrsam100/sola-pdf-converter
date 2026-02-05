/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PDF to JPG Configuration Dashboard
 * Professional image export settings
 */

import React, { useState } from 'react';
import type { PdfToImageConfig, ImageFormat, DPI, ColorSpace } from '../../types';
import { DEFAULT_PDF_TO_IMAGE_CONFIG } from '../../types';
import { configService } from '../../services/configService';

interface PdfToJpgConfigProps {
  file: File;
  onConfigChange: (config: PdfToImageConfig) => void;
  onConvert: (config: PdfToImageConfig) => void;
  onCancel: () => void;
}

export const PdfToJpgConfig: React.FC<PdfToJpgConfigProps> = ({
  file,
  onConfigChange,
  onConvert,
  onCancel,
}) => {
  const [config, setConfig] = useState<PdfToImageConfig>(() =>
    configService.loadConfig<PdfToImageConfig>('pdf-to-jpg')
  );

  const updateConfig = (updates: Partial<PdfToImageConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange(newConfig);
    configService.saveConfig('pdf-to-jpg', newConfig);
  };

  const formats: { value: ImageFormat; label: string; description: string }[] = [
    { value: 'jpg', label: 'JPG', description: 'Best for photos' },
    { value: 'png', label: 'PNG', description: 'Lossless, larger files' },
    { value: 'webp', label: 'WebP', description: 'Modern, smaller files' },
  ];

  const dpiLevels: { value: DPI; label: string; description: string }[] = [
    { value: 72, label: '72 DPI', description: 'Screen quality' },
    { value: 150, label: '150 DPI', description: 'Recommended' },
    { value: 300, label: '300 DPI', description: 'Print quality' },
    { value: 600, label: '600 DPI', description: 'Professional' },
  ];

  const colorSpaces: { value: ColorSpace; label: string }[] = [
    { value: 'rgb', label: 'Color (RGB)' },
    { value: 'grayscale', label: 'Grayscale' },
    { value: 'blackwhite', label: 'Black & White' },
  ];

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#333', marginBottom: '8px' }}>
          PDF to Images
        </h2>
        <p style={{ fontSize: '14px', color: '#666' }}>{file.name}</p>
      </div>

      {/* Format */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
          🖼️ Image Format
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {formats.map(({ value, label, description }) => (
            <button
              key={value}
              style={{
                flex: 1,
                padding: '16px',
                border: config.format === value ? '2px solid #4CAF50' : '2px solid #e0e0e0',
                borderRadius: '8px',
                backgroundColor: config.format === value ? '#f1f8f4' : '#fff',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
              }}
              onClick={() => updateConfig({ format: value })}
            >
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* DPI/Quality */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
          📊 Resolution (DPI)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {dpiLevels.map(({ value, label, description }) => (
            <button
              key={value}
              style={{
                padding: '14px',
                border: config.dpi === value ? '2px solid #4CAF50' : '2px solid #e0e0e0',
                borderRadius: '8px',
                backgroundColor: config.dpi === value ? '#f1f8f4' : '#fff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
              onClick={() => updateConfig({ dpi: value })}
            >
              <div style={{ fontWeight: '600', marginBottom: '2px' }}>{label}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Color Space */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
          🎨 Color Mode
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {colorSpaces.map(({ value, label }) => (
            <button
              key={value}
              style={{
                flex: 1,
                padding: '12px',
                border: config.colorSpace === value ? '2px solid #4CAF50' : '2px solid #e0e0e0',
                borderRadius: '8px',
                backgroundColor: config.colorSpace === value ? '#f1f8f4' : '#fff',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.2s',
              }}
              onClick={() => updateConfig({ colorSpace: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Page Selection */}
      <div style={{ marginBottom: '32px', padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
          📄 Pages to Convert
        </div>
        <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
          <input
            type="radio"
            checked={config.pageSelection === 'all'}
            onChange={() => updateConfig({ pageSelection: 'all', pageRange: undefined })}
            style={{ marginRight: '8px' }}
          />
          All pages
        </label>
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <input
            type="radio"
            checked={config.pageSelection === 'range'}
            onChange={() => updateConfig({ pageSelection: 'range' })}
            style={{ marginRight: '8px' }}
          />
          Specific pages
        </label>
        {config.pageSelection === 'range' && (
          <input
            type="text"
            placeholder="e.g., 1-5,7,9-12"
            defaultValue={config.pageRange}
            onChange={(e) => updateConfig({ pageRange: e.target.value })}
            style={{
              width: '100%',
              marginTop: '12px',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
            }}
          />
        )}
      </div>

      {/* Quality Slider (for JPG) */}
      {config.format === 'jpg' && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Quality: {Math.round(config.quality * 100)}%
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={config.quality}
            onChange={(e) => updateConfig({ quality: parseFloat(e.target.value) })}
            style={{ width: '100%', height: '8px' }}
          />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          style={{ padding: '14px 32px', borderRadius: '8px', border: 'none', backgroundColor: '#e0e0e0', color: '#666', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          style={{ padding: '14px 32px', borderRadius: '8px', border: 'none', backgroundColor: '#4CAF50', color: '#fff', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}
          onClick={() => onConvert(config)}
        >
          Convert to Images →
        </button>
      </div>
    </div>
  );
};
