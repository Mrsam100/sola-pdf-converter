/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Split PDF Configuration Dashboard
 * Professional PDF splitting with multiple modes
 */

import React, { useState } from 'react';
import type { SplitPdfConfig } from '../../types';
import { DEFAULT_SPLIT_PDF_CONFIG } from '../../types';
import { configService } from '../../services/configService';

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

  const updateConfig = (updates: Partial<SplitPdfConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange(newConfig);
    configService.saveConfig('split-pdf', newConfig);
  };

  const splitModes = [
    {
      value: 'ranges' as const,
      icon: '📄',
      label: 'By Page Ranges',
      description: 'Split into specific page ranges (e.g., 1-5, 6-10)',
    },
    {
      value: 'extract' as const,
      icon: '✂️',
      label: 'Extract Pages',
      description: 'Extract specific pages (e.g., 1, 3, 5, 7)',
    },
    {
      value: 'every-n-pages' as const,
      icon: '📚',
      label: 'Split Every N Pages',
      description: 'Split into equal chunks of N pages each',
    },
  ];

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#333', marginBottom: '8px' }}>
          Split PDF
        </h2>
        <p style={{ fontSize: '14px', color: '#666' }}>{file.name}</p>
      </div>

      {/* Split Mode */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
          ✂️ Split Mode
        </div>
        <div style={{ display: 'grid', gap: '12px' }}>
          {splitModes.map(({ value, icon, label, description }) => (
            <button
              key={value}
              style={{
                padding: '16px',
                border: config.mode === value ? '2px solid #4CAF50' : '2px solid #e0e0e0',
                borderRadius: '8px',
                backgroundColor: config.mode === value ? '#f1f8f4' : '#fff',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
              }}
              onClick={() => updateConfig({ mode: value })}
            >
              <span style={{ fontSize: '24px' }}>{icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>{description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Mode-specific inputs */}
      <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
        {config.mode === 'ranges' && (
          <div>
            <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
              Page Ranges
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
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
            <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              Separate ranges with commas. Each range will become a separate PDF.
            </div>
          </div>
        )}

        {config.mode === 'extract' && (
          <div>
            <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
              Pages to Extract
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
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
            <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              Enter page numbers separated by commas. Each page will become a separate PDF.
            </div>
          </div>
        )}

        {config.mode === 'every-n-pages' && (
          <div>
            <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
              Split Every N Pages
            </label>
            <input
              type="number"
              min="1"
              placeholder="e.g., 5"
              defaultValue={config.splitEvery || 5}
              onChange={(e) => updateConfig({ splitEvery: parseInt(e.target.value) || 5 })}
              style={{
                width: '150px',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
            <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              PDF will be split into chunks of this many pages.
            </div>
          </div>
        )}
      </div>

      {/* Output Format */}
      <div style={{ marginBottom: '32px', padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
          📦 Output Format
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
          <input
            type="radio"
            checked={config.outputFormat === 'separate'}
            onChange={() => updateConfig({ outputFormat: 'separate' })}
            style={{ width: '18px', height: '18px' }}
          />
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>Separate files</div>
            <div style={{ fontSize: '12px', color: '#666' }}>Each range/page as a separate PDF</div>
          </div>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="radio"
            checked={config.outputFormat === 'merged'}
            onChange={() => updateConfig({ outputFormat: 'merged' })}
            style={{ width: '18px', height: '18px' }}
          />
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>Single merged file</div>
            <div style={{ fontSize: '12px', color: '#666' }}>All selected pages in one PDF</div>
          </div>
        </label>
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
          onClick={() => onSplit(config)}
        >
          Split PDF →
        </button>
      </div>
    </div>
  );
};
