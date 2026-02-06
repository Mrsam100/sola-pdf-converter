/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PDF to Images Configuration Dashboard
 * Professional-grade configuration UI matching ilovepdf.com quality
 * Ready for millions of users
 */

import React, { useState, useMemo } from 'react';
import type { PdfToImageConfig, ImageFormat, DPI, ColorSpace } from '../../types';
import { DEFAULT_PDF_TO_IMAGE_CONFIG } from '../../types';
import { configService } from '../../services/configService';
import { PagePreview } from './PagePreview';

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

  const formats: { value: ImageFormat; label: string }[] = [
    { value: 'jpg', label: 'JPG' },
    { value: 'png', label: 'PNG' },
    { value: 'webp', label: 'WebP' },
  ];

  const dpiLevels: { value: DPI; label: string }[] = [
    { value: 72, label: '72 DPI' },
    { value: 150, label: '150 DPI' },
    { value: 300, label: '300 DPI' },
    { value: 600, label: '600 DPI' },
  ];

  const colorSpaces: { value: ColorSpace; label: string }[] = [
    { value: 'rgb', label: 'Color (RGB)' },
    { value: 'grayscale', label: 'Grayscale' },
    { value: 'blackwhite', label: 'Black & White' },
  ];

  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

  // Dynamic preview styles based on config
  const previewStyle = useMemo((): React.CSSProperties => ({
    filter: config.colorSpace === 'grayscale'
      ? 'grayscale(100%)'
      : config.colorSpace === 'blackwhite'
        ? 'grayscale(100%) contrast(200%)'
        : 'none',
    opacity: config.dpi === 72 ? 0.85 : config.dpi === 150 ? 0.95 : 1,
    transition: 'all 0.3s ease',
  }), [config.colorSpace, config.dpi]);

  const containerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '60% 40%',
    minHeight: '100vh',
    backgroundColor: 'var(--config-bg)',
  };

  const previewSectionStyle: React.CSSProperties = {
    backgroundColor: 'var(--config-surface)',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const configSectionStyle: React.CSSProperties = {
    backgroundColor: 'var(--config-surface)',
    padding: '40px 32px',
    borderLeft: '1px solid var(--config-border)',
    display: 'flex',
    flexDirection: 'column',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '28px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '12px',
    display: 'block',
  };

  const buttonGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
  };

  const buttonStyle = (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '12px 16px',
    border: isActive ? '2px solid var(--config-active)' : '2px solid var(--config-border)',
    borderRadius: '8px',
    backgroundColor: isActive ? 'var(--config-active-bg)' : 'var(--config-surface)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontSize: '14px',
    color: isActive ? 'var(--config-active)' : 'var(--text-secondary)',
    fontWeight: isActive ? '600' : '400',
    outline: 'none',
  });

  return (
    <div style={containerStyle}>
      {/* LEFT: Preview Section */}
      <div style={previewSectionStyle}>
        <div style={{
          maxWidth: '450px',
          width: '100%',
        }}>
          {/* File info */}
          <div style={{
            marginBottom: '24px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '13px',
              color: 'var(--text-tertiary)',
              marginBottom: '8px',
            }}>
              {file.name}
            </div>
            <div style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
            }}>
              {fileSizeMB} MB
            </div>
          </div>

          {/* Preview with dynamic effects */}
          <div style={{
            padding: '24px',
            backgroundColor: 'var(--config-bg)',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <div style={previewStyle}>
              <PagePreview file={file} pageNumber={1} width={400} height={500} />
            </div>
          </div>

          {/* Live preview indicators */}
          <div style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: 'var(--config-surface)',
            borderRadius: '8px',
            border: '1px solid var(--config-border)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}>
              <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Format:</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--config-active)' }}>
                {config.format.toUpperCase()}
              </span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}>
              <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>DPI Quality:</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--config-active)' }}>
                {config.dpi} DPI
              </span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Color Mode:</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--config-active)' }}>
                {config.colorSpace === 'rgb' ? 'Color (RGB)' :
                 config.colorSpace === 'grayscale' ? 'Grayscale' : 'Black & White'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Configuration Section */}
      <div style={configSectionStyle}>
        {/* Header */}
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '32px' }}>
          PDF to Images options
        </h2>

        {/* Image Format */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Image format</label>
          <div style={buttonGroupStyle}>
            {formats.map(({ value, label }) => (
              <button
                key={value}
                style={buttonStyle(config.format === value)}
                onClick={() => updateConfig({ format: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Resolution (DPI) */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Resolution</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {dpiLevels.map(({ value, label }) => (
              <button
                key={value}
                style={buttonStyle(config.dpi === value)}
                onClick={() => updateConfig({ dpi: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Color Space */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Color mode</label>
          <div style={buttonGroupStyle}>
            {colorSpaces.map(({ value, label }) => (
              <button
                key={value}
                style={buttonStyle(config.colorSpace === value)}
                onClick={() => updateConfig({ colorSpace: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Page Selection */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Pages to convert</label>
          <div style={{
            padding: '16px',
            backgroundColor: 'var(--config-bg)',
            borderRadius: '8px',
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '12px',
              cursor: 'pointer',
            }}>
              <input
                type="radio"
                checked={config.pageSelection === 'all'}
                onChange={() => updateConfig({ pageSelection: 'all', pageRange: undefined })}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: 'var(--config-active)',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                All pages
              </span>
            </label>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
            }}>
              <input
                type="radio"
                checked={config.pageSelection === 'range'}
                onChange={() => updateConfig({ pageSelection: 'range' })}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: 'var(--config-active)',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Specific pages
              </span>
            </label>
            {config.pageSelection === 'range' && (
              <input
                type="text"
                placeholder="e.g., 1-5, 7, 9-12"
                defaultValue={config.pageRange}
                onChange={(e) => updateConfig({ pageRange: e.target.value })}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '10px 12px',
                  border: '1px solid var(--config-border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--config-surface)',
                  outline: 'none',
                }}
              />
            )}
          </div>
        </div>

        {/* Quality Slider (for JPG) */}
        {config.format === 'jpg' && (
          <div style={sectionStyle}>
            <label style={labelStyle}>
              Quality: {Math.round(config.quality * 100)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={config.quality}
              onChange={(e) => updateConfig({ quality: parseFloat(e.target.value) })}
              style={{
                width: '100%',
                height: '6px',
                accentColor: 'var(--config-active)',
              }}
            />
          </div>
        )}

        {/* Spacer to push button to bottom */}
        <div style={{ flex: 1 }} />

        {/* Convert Button */}
        <button
          onClick={() => onConvert(config)}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: 'var(--config-active)',
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
            e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--config-active)';
          }}
        >
          Convert to Images
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginLeft: '4px' }}>
            <circle cx="10" cy="10" r="9" stroke="white" strokeWidth="2" fill="none"/>
            <path d="M8 10L12 10M12 10L10 8M12 10L10 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};
