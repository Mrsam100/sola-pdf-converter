/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Compress PDF Configuration Dashboard
 * Professional-grade configuration UI matching ilovepdf.com quality
 * Ready for millions of users
 */

import React, { useState, useMemo } from 'react';
import type { CompressPdfConfig, CompressionLevel } from '../../types';
import { DEFAULT_COMPRESS_PDF_CONFIG } from '../../types';
import { configService } from '../../services/configService';
import { PagePreview } from './PagePreview';

interface CompressPdfConfigProps {
  file: File;
  onConfigChange: (config: CompressPdfConfig) => void;
  onCompress: (config: CompressPdfConfig) => void;
  onCancel: () => void;
}

export const CompressPdfConfig: React.FC<CompressPdfConfigProps> = ({
  file,
  onConfigChange,
  onCompress,
  onCancel,
}) => {
  const [config, setConfig] = useState<CompressPdfConfig>(() =>
    configService.loadConfig<CompressPdfConfig>('compress-pdf')
  );

  const updateConfig = (updates: Partial<CompressPdfConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange(newConfig);
    configService.saveConfig('compress-pdf', newConfig);
  };

  const compressionLevels: { value: CompressionLevel; label: string; description: string }[] = [
    { value: 'low', label: 'Low compression', description: 'Best quality, ~20% smaller' },
    { value: 'medium', label: 'Medium compression', description: 'Recommended, ~40% smaller' },
    { value: 'high', label: 'High compression', description: 'Good balance, ~60% smaller' },
    { value: 'extreme', label: 'Extreme compression', description: 'Maximum size reduction, ~80% smaller' },
  ];

  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

  // Calculate estimated compressed size in real-time
  const estimatedSize = useMemo(() => {
    const originalSize = file.size / (1024 * 1024);
    const reductions: Record<CompressionLevel, number> = {
      low: 0.8,
      medium: 0.6,
      high: 0.4,
      extreme: 0.2,
    };
    return (originalSize * reductions[config.compressionLevel]).toFixed(2);
  }, [file.size, config.compressionLevel]);

  const reductionPercentage = useMemo(() => {
    return ((1 - parseFloat(estimatedSize) / (file.size / (1024 * 1024))) * 100).toFixed(0);
  }, [estimatedSize, file.size]);

  // Dynamic preview opacity based on compression level
  const previewStyle = useMemo((): React.CSSProperties => ({
    opacity: config.compressionLevel === 'extreme' ? 0.7 :
             config.compressionLevel === 'high' ? 0.85 :
             config.compressionLevel === 'medium' ? 0.95 : 1,
    transition: 'opacity 0.3s ease',
  }), [config.compressionLevel]);

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

  const compressionButtonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '16px',
    border: isActive ? '2px solid var(--config-active)' : '2px solid var(--config-border)',
    borderRadius: '8px',
    backgroundColor: isActive ? 'var(--config-active-bg)' : 'var(--config-surface)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'left',
    outline: 'none',
    marginBottom: '12px',
  });

  return (
    <div style={containerStyle}>
      {/* LEFT: Preview Section */}
      <div style={previewSectionStyle}>
        <div style={{
          maxWidth: '450px',
          width: '100%',
        }}>
          {/* File info with prominent size display */}
          <div style={{
            marginBottom: '24px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '13px',
              color: 'var(--text-tertiary)',
              marginBottom: '12px',
            }}>
              {file.name}
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'var(--text-primary)',
              marginBottom: '4px',
            }}>
              {fileSizeMB} MB
            </div>
            <div style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
            }}>
              Current file size
            </div>
          </div>

          {/* Preview with compression quality indicator */}
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

          {/* Live size comparison */}
          <div style={{
            marginTop: '20px',
            padding: '20px',
            backgroundColor: 'var(--config-surface)',
            borderRadius: '8px',
            border: '1px solid var(--config-border)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Original Size
                </div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  {fileSizeMB} MB
                </div>
              </div>
              <div style={{
                fontSize: '24px',
                color: 'var(--config-active)',
                fontWeight: '700',
              }}>
                →
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Estimated Size
                </div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--config-active)' }}>
                  {estimatedSize} MB
                </div>
              </div>
            </div>
            <div style={{
              padding: '12px',
              backgroundColor: 'var(--success-bg)',
              borderRadius: '6px',
              border: '1px solid var(--success)',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '700',
                color: 'var(--success)',
              }}>
                {reductionPercentage}% size reduction
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Configuration Section */}
      <div style={configSectionStyle}>
        {/* Header */}
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '32px' }}>
          Compress PDF options
        </h2>

        {/* Compression Level */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Compression level</label>
          <div>
            {compressionLevels.map(({ value, label, description }) => (
              <button
                key={value}
                style={compressionButtonStyle(config.compressionLevel === value)}
                onClick={() => updateConfig({ compressionLevel: value })}
              >
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: config.compressionLevel === value ? 'var(--config-active)' : 'var(--text-primary)',
                  marginBottom: '4px',
                }}>
                  {label}
                </div>
                <div style={{
                  fontSize: '13px',
                  color: 'var(--text-tertiary)',
                }}>
                  {description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Additional Options */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Additional options</label>
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
                type="checkbox"
                checked={config.optimizeImages}
                onChange={(e) => updateConfig({ optimizeImages: e.target.checked })}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: 'var(--config-active)',
                  cursor: 'pointer',
                }}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Optimize images
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  Compress embedded images for smaller file size
                </div>
              </div>
            </label>

            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={config.removeMetadata}
                onChange={(e) => updateConfig({ removeMetadata: e.target.checked })}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: 'var(--config-active)',
                  cursor: 'pointer',
                }}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Remove metadata
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  Remove author info, creation date, etc.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Spacer to push button to bottom */}
        <div style={{ flex: 1 }} />

        {/* Compress Button */}
        <button
          onClick={() => onCompress(config)}
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
          Compress PDF
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginLeft: '4px' }}>
            <circle cx="10" cy="10" r="9" stroke="white" strokeWidth="2" fill="none"/>
            <path d="M8 10L12 10M12 10L10 8M12 10L10 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};
