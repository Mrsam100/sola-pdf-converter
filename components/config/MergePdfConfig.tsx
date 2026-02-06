/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Merge PDFs Configuration Dashboard
 * Professional-grade configuration UI matching ilovepdf.com quality
 * Ready for millions of users
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { MergePdfConfig } from '../../types';
import { DEFAULT_MERGE_PDF_CONFIG } from '../../types';
import { configService } from '../../services/configService';
import { DragDropReorder } from './DragDropReorder';
import { PagePreview } from './PagePreview';

interface MergePdfConfigProps {
  files: File[];
  onConfigChange: (config: MergePdfConfig) => void;
  onMerge: (config: MergePdfConfig) => void;
  onCancel: () => void;
}

export const MergePdfConfig: React.FC<MergePdfConfigProps> = ({
  files,
  onConfigChange,
  onMerge,
  onCancel,
}) => {
  const [config, setConfig] = useState<MergePdfConfig>(() =>
    configService.loadConfig<MergePdfConfig>('merge-pdf')
  );

  useEffect(() => {
    if (files.length > 0 && config.pageOrder.length === 0) {
      const initialOrder = files.map(file => ({
        fileId: file.name,
        fileName: file.name,
        pageIndices: [],
      }));
      updateConfig({ pageOrder: initialOrder });
    }
  }, [files]);

  const updateConfig = (updates: Partial<MergePdfConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange(newConfig);
    configService.saveConfig('merge-pdf', newConfig);
  };

  const handleReorder = (newOrder: string[]) => {
    const reorderedPageOrder = newOrder.map(fileName => {
      const existing = config.pageOrder.find(p => p.fileId === fileName);
      return existing || { fileId: fileName, fileName, pageIndices: [] };
    });
    updateConfig({ pageOrder: reorderedPageOrder });
  };

  // Track which file is currently highlighted during reorder
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  // Calculate total size and estimated page count
  const totalSizeMB = useMemo(() => {
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    return (totalBytes / (1024 * 1024)).toFixed(2);
  }, [files]);

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

  return (
    <div style={containerStyle}>
      {/* LEFT: Preview Section - All PDF Thumbnails */}
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
              Files to merge
            </div>
            <div style={{
              fontSize: '13px',
              color: 'var(--text-tertiary)',
            }}>
              {files.length} PDF{files.length !== 1 ? 's' : ''} selected
            </div>
          </div>

          {/* PDF Thumbnails Grid - Shows current merge order */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '16px',
            justifyItems: 'center',
          }}>
            {config.pageOrder.map((item, index) => {
              const file = files.find(f => f.name === item.fileName);
              if (!file) return null;

              return (
                <div key={index} style={{ textAlign: 'center', width: '100%' }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: 'var(--text-secondary)',
                    marginBottom: '8px',
                  }}>
                    Position {index + 1}
                  </div>
                  <div style={{
                    padding: '12px',
                    backgroundColor: highlightedIndex === index ? 'var(--config-active-bg)' : 'var(--config-bg)',
                    borderRadius: '8px',
                    border: highlightedIndex === index ? '2px solid var(--config-active)' : '1px solid var(--config-border)',
                    transform: highlightedIndex === index ? 'scale(1.05)' : 'scale(1)',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                  }}>
                    <PagePreview
                      file={file}
                      pageNumber={1}
                      width={120}
                      height={160}
                      showFileName={false}
                    />
                    {/* Order badge */}
                    <div style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--config-active)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: '700',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}>
                      {index + 1}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    marginTop: '8px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    padding: '0 4px',
                  }}>
                    {file.name}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total size indicator */}
          <div style={{
            marginTop: '24px',
            padding: '16px',
            backgroundColor: 'var(--info-bg)',
            borderRadius: '8px',
            border: '1px solid var(--info)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '13px',
              color: 'var(--info)',
              marginBottom: '4px',
            }}>
              Combined file size
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: '700',
              color: 'var(--info)',
            }}>
              {totalSizeMB} MB
            </div>
            <div style={{
              fontSize: '12px',
              color: 'var(--info)',
              marginTop: '4px',
            }}>
              {files.length} PDF{files.length !== 1 ? 's' : ''} will be merged
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Configuration Section */}
      <div style={configSectionStyle}>
        {/* Header */}
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '32px' }}>
          Merge PDFs options
        </h2>

        {/* File Order */}
        <div style={sectionStyle}>
          <label style={labelStyle}>File order</label>
          <div style={{
            fontSize: '13px',
            color: 'var(--text-tertiary)',
            marginBottom: '12px',
          }}>
            Drag and drop files to change the merge order
          </div>

          <DragDropReorder
            items={config.pageOrder.map(({ fileId, fileName }) => ({
              id: fileId,
              name: fileName,
            }))}
            onReorder={handleReorder}
            renderItem={(item, index) => (
              <div style={{
                padding: '12px 16px',
                backgroundColor: 'var(--config-bg)',
                borderRadius: '8px',
                border: '1px solid var(--config-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'move',
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--config-active)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: '700',
                  flexShrink: 0,
                }}>
                  {index + 1}
                </div>
                <div style={{
                  flex: 1,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.name}
                  </div>
                </div>
                <div style={{
                  fontSize: '18px',
                  color: 'var(--text-tertiary)',
                  cursor: 'move',
                }}>
                  ⋮⋮
                </div>
              </div>
            )}
          />
        </div>

        {/* Info Box */}
        <div style={{
          padding: '16px',
          backgroundColor: 'var(--info-bg)',
          borderLeft: '4px solid var(--info)',
          borderRadius: '6px',
          marginBottom: '28px',
        }}>
          <div style={{
            fontSize: '13px',
            color: 'var(--info)',
            lineHeight: '1.5',
          }}>
            All pages from each PDF will be included in the order shown above. The merged PDF will maintain the original quality and formatting.
          </div>
        </div>

        {/* Spacer to push button to bottom */}
        <div style={{ flex: 1 }} />

        {/* Merge Button */}
        <button
          onClick={() => onMerge(config)}
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
          Merge PDFs
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginLeft: '4px' }}>
            <circle cx="10" cy="10" r="9" stroke="white" strokeWidth="2" fill="none"/>
            <path d="M8 10L12 10M12 10L10 8M12 10L10 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};
