/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Split PDF Configuration Dashboard
 * Professional-grade configuration UI matching ilovepdf.com quality
 * Ready for millions of users
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { SplitPdfConfig } from '../../types';
import { DEFAULT_SPLIT_PDF_CONFIG } from '../../types';
import { configService } from '../../services/configService';
import { PagePreview } from './PagePreview';

interface SplitPdfConfigProps {
  file: File;
  onConfigChange: (config: SplitPdfConfig) => void;
  onSplit: (config: SplitPdfConfig) => void;
  onCancel: () => void;
}

export const SplitPdfConfig: React.FC<SplitPdfConfigProps> = ({
  file,
  onConfigChange,
  onSplit,
  onCancel,
}) => {
  const [config, setConfig] = useState<SplitPdfConfig>(() =>
    configService.loadConfig<SplitPdfConfig>('split-pdf')
  );
  const [pageCount, setPageCount] = useState<number>(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());

  useEffect(() => {
    const loadPageCount = async () => {
      try {
        const { pdfjsLib } = await import('../../services/pdfConfig');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setPageCount(pdf.numPages);
      } catch (err) {
        console.error('Failed to load PDF page count:', err);
      }
    };
    loadPageCount();
  }, [file]);

  // Parse page ranges and update selected pages dynamically
  const parsePageRanges = (ranges: string[], totalPages: number): number[] => {
    const pages = new Set<number>();
    ranges.forEach(range => {
      if (range.includes('-')) {
        const [start, end] = range.split('-').map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) {
            pages.add(i);
          }
        }
      } else {
        const page = parseInt(range.trim());
        if (!isNaN(page) && page >= 1 && page <= totalPages) {
          pages.add(page);
        }
      }
    });
    return Array.from(pages).sort((a, b) => a - b);
  };

  // Update selected pages based on config changes
  useEffect(() => {
    if (pageCount === 0) return;

    let pages = new Set<number>();

    if (config.mode === 'ranges' && config.pageRanges && config.pageRanges.length > 0) {
      const parsedPages = parsePageRanges(config.pageRanges, pageCount);
      pages = new Set(parsedPages);
    } else if (config.mode === 'extract' && config.extractPages && config.extractPages.length > 0) {
      pages = new Set(config.extractPages.filter(p => p >= 1 && p <= pageCount));
    } else if (config.mode === 'every-n-pages' && config.splitEvery) {
      // Highlight first page of each chunk
      for (let i = 1; i <= pageCount; i += config.splitEvery) {
        pages.add(i);
      }
    }

    setSelectedPages(pages);
  }, [config.mode, config.pageRanges, config.extractPages, config.splitEvery, pageCount]);

  const updateConfig = (updates: Partial<SplitPdfConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange(newConfig);
    configService.saveConfig('split-pdf', newConfig);
  };

  const splitModes = [
    {
      value: 'ranges' as const,
      label: 'By page ranges',
      description: 'Split into specific page ranges (e.g., 1-5, 6-10)',
    },
    {
      value: 'extract' as const,
      label: 'Extract pages',
      description: 'Extract specific pages (e.g., 1, 3, 5, 7)',
    },
    {
      value: 'every-n-pages' as const,
      label: 'Split every N pages',
      description: 'Split into equal chunks of N pages each',
    },
  ];

  const containerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '60% 40%',
    minHeight: '100vh',
    backgroundColor: 'var(--config-bg)',
  };

  const previewSectionStyle: React.CSSProperties = {
    backgroundColor: 'var(--config-surface)',
    padding: '40px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
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

  const modeButtonStyle = (isActive: boolean): React.CSSProperties => ({
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
      {/* LEFT: Preview Section - Page Thumbnails */}
      <div style={previewSectionStyle}>
        <div style={{
          width: '100%',
          maxWidth: '600px',
        }}>
          {/* Header */}
          <div style={{
            marginBottom: '32px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              marginBottom: '8px',
            }}>
              Page thumbnails
            </div>
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
                {pageCount} {pageCount === 1 ? 'page' : 'pages'}
              </div>
            )}
          </div>

          {/* Page Thumbnails Grid with dynamic selection highlighting */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '16px',
            justifyItems: 'center',
          }}>
            {pageCount > 0 && Array.from({ length: Math.min(pageCount, 20) }, (_, i) => {
              const pageNum = i + 1;
              const isSelected = selectedPages.has(pageNum);

              return (
                <div key={i} style={{ textAlign: 'center', width: '100%' }}>
                  <div style={{
                    padding: '8px',
                    backgroundColor: isSelected ? 'var(--config-active-bg)' : 'var(--config-bg)',
                    borderRadius: '8px',
                    border: isSelected ? '3px solid var(--config-active)' : '1px solid var(--config-border)',
                    transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                  }}>
                    <PagePreview
                      file={file}
                      pageNumber={pageNum}
                      width={100}
                      height={140}
                      showFileName={false}
                    />
                    {/* Selection checkmark */}
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--config-active)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: '700',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                      }}>
                        ✓
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: isSelected ? 'var(--config-active)' : 'var(--text-tertiary)',
                    marginTop: '6px',
                    fontWeight: isSelected ? '700' : '600',
                    transition: 'all 0.3s ease',
                  }}>
                    Page {pageNum}
                  </div>
                </div>
              );
            })}
          </div>

          {pageCount > 20 && (
            <div style={{
              textAlign: 'center',
              padding: '16px',
              color: 'var(--text-tertiary)',
              fontSize: '13px',
              marginTop: '16px',
            }}>
              Showing first 20 of {pageCount} pages
            </div>
          )}

          {/* Selected pages summary */}
          {selectedPages.size > 0 && (
            <div style={{
              marginTop: '24px',
              padding: '16px',
              backgroundColor: 'var(--success-bg)',
              borderRadius: '8px',
              border: '1px solid var(--success)',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '13px',
                color: 'var(--success)',
                marginBottom: '4px',
              }}>
                Pages selected for {config.mode === 'extract' ? 'extraction' : 'splitting'}
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: '700',
                color: 'var(--success)',
              }}>
                {selectedPages.size} page{selectedPages.size !== 1 ? 's' : ''}
              </div>
              {config.mode === 'every-n-pages' && config.splitEvery && (
                <div style={{
                  fontSize: '12px',
                  color: 'var(--success)',
                  marginTop: '4px',
                }}>
                  Will create {Math.ceil(pageCount / config.splitEvery)} separate PDFs
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Configuration Section */}
      <div style={configSectionStyle}>
        {/* Header */}
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '32px' }}>
          Split PDF options
        </h2>

        {/* Split Mode */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Split mode</label>
          <div>
            {splitModes.map(({ value, label, description }) => (
              <button
                key={value}
                style={modeButtonStyle(config.mode === value)}
                onClick={() => updateConfig({ mode: value })}
              >
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: config.mode === value ? 'var(--config-active)' : 'var(--text-primary)',
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

        {/* Mode-specific inputs */}
        <div style={sectionStyle}>
          <div style={{
            padding: '16px',
            backgroundColor: 'var(--config-bg)',
            borderRadius: '8px',
          }}>
            {config.mode === 'ranges' && (
              <div>
                <label style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  display: 'block',
                  marginBottom: '8px',
                }}>
                  Page ranges
                </label>
                <input
                  type="text"
                  placeholder="e.g., 1-3, 5-7, 9-12"
                  onChange={(e) => {
                    const ranges = e.target.value.split(',').map(r => r.trim());
                    updateConfig({ pageRanges: ranges });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--config-border)',
                    borderRadius: '6px',
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--config-surface)',
                    outline: 'none',
                  }}
                />
                <div style={{
                  fontSize: '12px',
                  color: 'var(--text-tertiary)',
                  marginTop: '8px',
                }}>
                  Separate ranges with commas. Each range will become a separate PDF.
                </div>
              </div>
            )}

            {config.mode === 'extract' && (
              <div>
                <label style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  display: 'block',
                  marginBottom: '8px',
                }}>
                  Pages to extract
                </label>
                <input
                  type="text"
                  placeholder="e.g., 1, 3, 5, 7, 10"
                  onChange={(e) => {
                    const pages = e.target.value.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
                    updateConfig({ extractPages: pages });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--config-border)',
                    borderRadius: '6px',
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--config-surface)',
                    outline: 'none',
                  }}
                />
                <div style={{
                  fontSize: '12px',
                  color: 'var(--text-tertiary)',
                  marginTop: '8px',
                }}>
                  Enter page numbers separated by commas. Each page will become a separate PDF.
                </div>
              </div>
            )}

            {config.mode === 'every-n-pages' && (
              <div>
                <label style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  display: 'block',
                  marginBottom: '8px',
                }}>
                  Split every N pages
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g., 5"
                  defaultValue={config.splitEvery || 5}
                  onChange={(e) => updateConfig({ splitEvery: parseInt(e.target.value) || 5 })}
                  style={{
                    width: '150px',
                    padding: '10px 12px',
                    border: '1px solid var(--config-border)',
                    borderRadius: '6px',
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--config-surface)',
                    outline: 'none',
                  }}
                />
                <div style={{
                  fontSize: '12px',
                  color: 'var(--text-tertiary)',
                  marginTop: '8px',
                }}>
                  PDF will be split into chunks of this many pages.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Output Format */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Output format</label>
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
                checked={config.outputFormat === 'separate'}
                onChange={() => updateConfig({ outputFormat: 'separate' })}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: 'var(--config-active)',
                  cursor: 'pointer',
                }}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Separate files
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  Each range/page as a separate PDF
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
                type="radio"
                checked={config.outputFormat === 'merged'}
                onChange={() => updateConfig({ outputFormat: 'merged' })}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: 'var(--config-active)',
                  cursor: 'pointer',
                }}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Single merged file
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  All selected pages in one PDF
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Spacer to push button to bottom */}
        <div style={{ flex: 1 }} />

        {/* Split Button */}
        <button
          onClick={() => onSplit(config)}
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
          Split PDF
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginLeft: '4px' }}>
            <circle cx="10" cy="10" r="9" stroke="white" strokeWidth="2" fill="none"/>
            <path d="M8 10L12 10M12 10L10 8M12 10L10 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};
