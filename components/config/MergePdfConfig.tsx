/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Merge PDF Configuration Dashboard
 * Professional PDF merging with page reordering
 */

import React, { useState, useEffect } from 'react';
import type { MergePdfConfig } from '../../types';
import { DEFAULT_MERGE_PDF_CONFIG } from '../../types';
import { configService } from '../../services/configService';
import { DragDropReorder } from './DragDropReorder';

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
        pageIndices: [], // Empty means all pages
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

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#333', marginBottom: '8px' }}>
          Merge PDFs
        </h2>
        <p style={{ fontSize: '14px', color: '#666' }}>
          {files.length} PDF{files.length !== 1 ? 's' : ''} selected
        </p>
      </div>

      {/* File Order */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
          📋 File Order
        </div>
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
          Drag and drop files to change the merge order
        </p>

        <DragDropReorder
          items={config.pageOrder.map(({ fileId, fileName }) => ({
            id: fileId,
            name: fileName,
          }))}
          onReorder={handleReorder}
          renderItem={(item, index) => (
            <div style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{
                width: '60px',
                height: '80px',
                margin: '0 auto 12px',
                backgroundColor: '#f44336',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '32px',
                fontWeight: '700',
              }}>
                PDF
              </div>
              <div style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#333',
                marginBottom: '4px',
              }}>
                File {index + 1}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#666',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {item.name}
              </div>
            </div>
          )}
        />
      </div>

      {/* Info Box */}
      <div style={{
        padding: '16px',
        backgroundColor: '#e3f2fd',
        borderLeft: '4px solid #2196F3',
        borderRadius: '4px',
        marginBottom: '32px',
      }}>
        <div style={{ fontSize: '14px', color: '#1565C0', fontWeight: '600', marginBottom: '4px' }}>
          ℹ️ Merge Options
        </div>
        <div style={{ fontSize: '13px', color: '#1976D2' }}>
          All pages from each PDF will be included in the order shown above. The merged PDF will maintain the original quality and formatting.
        </div>
      </div>

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
          onClick={() => onMerge(config)}
        >
          Merge PDFs →
        </button>
      </div>
    </div>
  );
};
