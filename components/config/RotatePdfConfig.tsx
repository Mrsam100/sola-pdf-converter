/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Rotate PDF Configuration Dashboard
 * Professional-grade configuration UI matching ilovepdf.com quality
 * Ready for millions of users
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { RotatePdfConfig } from '../../types';
import { configService } from '../../services/configService';
import { PagePreview } from './PagePreview';

interface RotatePdfConfigProps {
  file: File;
  onConfigChange: (config: RotatePdfConfig) => void;
  onRotate: (config: RotatePdfConfig) => void;
  onCancel: () => void;
}

export const RotatePdfConfig: React.FC<RotatePdfConfigProps> = ({
  file,
  onConfigChange,
  onRotate,
  onCancel,
}) => {
  const [config, setConfig] = useState<RotatePdfConfig>(() =>
    configService.loadConfig<RotatePdfConfig>('rotate-pdf')
  );
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageCount, setPageCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const loadPageCount = async () => {
      try {
        const { pdfjsLib } = await import('../../services/pdfConfig');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        try {
          if (!cancelled) setPageCount(pdf.numPages);
        } finally {
          pdf.destroy();
        }
      } catch {
        // Silent — page count is non-critical
      }
    };
    loadPageCount();
    return () => { cancelled = true; };
  }, [file]);

  const updateConfig = (updates: Partial<RotatePdfConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange(newConfig);
    configService.saveConfig('rotate-pdf', newConfig);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < pageCount) setCurrentPage(currentPage + 1);
  };

  const rotations: { value: 90 | 180 | 270; label: string }[] = [
    { value: 90, label: '90° clockwise' },
    { value: 180, label: '180° upside down' },
    { value: 270, label: '270° (90° counter)' },
  ];

  // Dynamic rotation style for preview
  const previewRotationStyle = useMemo((): React.CSSProperties => ({
    transform: `rotate(${config.rotation}deg)`,
    transition: 'transform 0.5s ease',
    transformOrigin: 'center center',
  }), [config.rotation]);

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

  const rotationButtonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '16px',
    border: isActive ? '2px solid var(--config-active)' : '2px solid var(--config-border)',
    borderRadius: '8px',
    backgroundColor: isActive ? 'var(--config-active-bg)' : 'var(--config-surface)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontSize: '14px',
    fontWeight: isActive ? '600' : '400',
    color: isActive ? 'var(--config-active)' : 'var(--text-secondary)',
    outline: 'none',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
            {pageCount > 0 && (
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--config-active)',
              }}>
                Page {currentPage} of {pageCount}
              </div>
            )}
          </div>

          {/* Preview with dynamic rotation */}
          <div style={{
            padding: '24px',
            backgroundColor: 'var(--config-bg)',
            borderRadius: '8px',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '550px',
          }}>
            <div style={previewRotationStyle}>
              <PagePreview file={file} pageNumber={currentPage} width={400} height={500} />
            </div>
          </div>

          {/* Rotation indicator */}
          <div style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: 'var(--config-surface)',
            borderRadius: '8px',
            border: '1px solid var(--config-border)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '14px',
              color: 'var(--text-tertiary)',
              marginBottom: '8px',
            }}>
              Current rotation
            </div>
            <div style={{
              fontSize: '32px',
              fontWeight: '700',
              color: 'var(--config-active)',
              marginBottom: '12px',
              transition: 'all 0.3s ease',
            }}>
              {config.rotation}°
            </div>
            {/* Visual rotation indicator (circular arrow) */}
            <svg width="60" height="60" style={{ margin: '0 auto', display: 'block' }}>
              <circle
                cx="30"
                cy="30"
                r="25"
                stroke="var(--config-active)"
                strokeWidth="3"
                fill="none"
              />
              <g
                style={{
                  transform: `rotate(${config.rotation}deg)`,
                  transformOrigin: '30px 30px',
                  transition: 'transform 0.5s ease',
                }}
              >
                <path
                  d="M30 5 L35 12 L25 12 Z"
                  fill="var(--config-active)"
                />
              </g>
            </svg>
          </div>

          {/* Page Navigation */}
          {pageCount > 1 && (
            <div style={{
              marginTop: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}>
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                style={{
                  padding: '6px 12px',
                  border: '1px solid var(--config-border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--config-surface)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.5 : 1,
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                {currentPage} / {pageCount}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === pageCount}
                style={{
                  padding: '6px 12px',
                  border: '1px solid var(--config-border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--config-surface)',
                  cursor: currentPage === pageCount ? 'not-allowed' : 'pointer',
                  opacity: currentPage === pageCount ? 0.5 : 1,
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Configuration Section */}
      <div style={configSectionStyle}>
        {/* Header */}
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '32px' }}>
          Rotate PDF options
        </h2>

        {/* Rotation Angle */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Rotation angle</label>
          <div>
            {rotations.map(({ value, label }) => (
              <button
                key={value}
                style={rotationButtonStyle(config.rotation === value)}
                onClick={() => updateConfig({ rotation: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Page Selection */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Apply to</label>
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
                onChange={() => updateConfig({ pageSelection: 'all', pageNumbers: undefined })}
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
                checked={config.pageSelection === 'specific'}
                onChange={() => updateConfig({ pageSelection: 'specific' })}
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

            {config.pageSelection === 'specific' && (
              <div>
                <input
                  type="text"
                  placeholder="e.g., 1, 3-5, 7"
                  defaultValue={config.pageNumbers?.join(', ') || ''}
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
                  onChange={(e) => {
                    const input = e.target.value.trim();
                    if (!input) {
                      updateConfig({ pageNumbers: [] });
                      return;
                    }

                    // 🔒 SECURITY: Validate page numbers
                    const pages: number[] = [];
                    const invalidPages: number[] = [];

                    input.split(',').forEach(part => {
                      const trimmed = part.trim();

                      // Handle ranges (e.g., "3-5")
                      if (trimmed.includes('-')) {
                        const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
                        if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
                          for (let i = start; i <= end; i++) {
                            if (pageCount > 0 && i > pageCount) {
                              invalidPages.push(i);
                            } else if (i > 0 && !pages.includes(i)) {
                              pages.push(i);
                            }
                          }
                        }
                      } else {
                        // Handle single page numbers
                        const page = parseInt(trimmed);
                        if (!isNaN(page) && page > 0) {
                          if (pageCount > 0 && page > pageCount) {
                            invalidPages.push(page);
                          } else if (!pages.includes(page)) {
                            pages.push(page);
                          }
                        }
                      }
                    });

                    // Validate all pages are within range
                    if (invalidPages.length > 0) {
                      console.warn(`⚠️ Invalid page numbers (exceed total ${pageCount}):`, invalidPages);
                    }

                    // Sort pages in ascending order
                    pages.sort((a, b) => a - b);
                    updateConfig({ pageNumbers: pages });
                  }}
                />
                {pageCount > 0 && config.pageNumbers && config.pageNumbers.length > 0 && (
                  <div style={{
                    marginTop: '8px',
                    fontSize: '12px',
                    color: config.pageNumbers.some(p => p > pageCount) ? 'var(--error)' : 'var(--text-tertiary)'
                  }}>
                    {config.pageNumbers.some(p => p > pageCount) ? (
                      <>⚠️ Some pages exceed document page count ({pageCount})</>
                    ) : (
                      <>✓ {config.pageNumbers.length} page{config.pageNumbers.length !== 1 ? 's' : ''} selected (max: {pageCount})</>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Spacer to push button to bottom */}
        <div style={{ flex: 1 }} />

        {/* Rotate Button */}
        <button
          onClick={() => onRotate(config)}
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
          Rotate PDF
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginLeft: '4px' }}>
            <circle cx="10" cy="10" r="9" stroke="white" strokeWidth="2" fill="none"/>
            <path d="M8 10L12 10M12 10L10 8M12 10L10 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};
