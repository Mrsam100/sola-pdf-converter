/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Compress PDF Configuration Dashboard
 * Production-ready compression settings
 */

import React, { useState } from 'react';
import type { CompressPdfConfig, CompressionLevel } from '../../types';
import { DEFAULT_COMPRESS_PDF_CONFIG } from '../../types';
import { configService } from '../../services/configService';

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

  const compressionLevels: { value: CompressionLevel; label: string; description: string; reduction: string }[] = [
    { value: 'low', label: 'Low', description: 'Best quality', reduction: '~20% smaller' },
    { value: 'medium', label: 'Medium', description: 'Recommended', reduction: '~40% smaller' },
    { value: 'high', label: 'High', description: 'Good compression', reduction: '~60% smaller' },
    { value: 'extreme', label: 'Extreme', description: 'Maximum compression', reduction: '~80% smaller' },
  ];

  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#333', marginBottom: '8px' }}>
          Compress PDF
        </h2>
        <p style={{ fontSize: '14px', color: '#666' }}>
          Current size: {fileSizeMB} MB
        </p>
      </div>

      {/* Compression Level */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
          🗜️ Compression Level
        </div>
        <div style={{ display: 'grid', gap: '12px' }}>
          {compressionLevels.map(({ value, label, description, reduction }) => (
            <button
              key={value}
              style={{
                padding: '16px',
                border: config.compressionLevel === value ? '2px solid #4CAF50' : '2px solid #e0e0e0',
                borderRadius: '8px',
                backgroundColor: config.compressionLevel === value ? '#f1f8f4' : '#fff',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => updateConfig({ compressionLevel: value })}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '600', color: '#333', marginBottom: '4px' }}>{label}</div>
                  <div style={{ fontSize: '13px', color: '#666' }}>{description}</div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#4CAF50' }}>
                  {reduction}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Options */}
      <div style={{ marginBottom: '32px', padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={config.optimizeImages}
            onChange={(e) => updateConfig({ optimizeImages: e.target.checked })}
            style={{ width: '18px', height: '18px' }}
          />
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>Optimize images</div>
            <div style={{ fontSize: '12px', color: '#666' }}>Compress embedded images for smaller file size</div>
          </div>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={config.removeMetadata}
            onChange={(e) => updateConfig({ removeMetadata: e.target.checked })}
            style={{ width: '18px', height: '18px' }}
          />
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>Remove metadata</div>
            <div style={{ fontSize: '12px', color: '#666' }}>Remove author info, creation date, etc.</div>
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
          onClick={() => onCompress(config)}
        >
          Compress PDF →
        </button>
      </div>
    </div>
  );
};
