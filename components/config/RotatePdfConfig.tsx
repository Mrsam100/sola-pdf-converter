/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Rotate PDF Configuration Dashboard
 * Simple, professional rotation settings
 */

import React, { useState } from 'react';
import type { RotatePdfConfig } from '../../types';
import { DEFAULT_ROTATE_PDF_CONFIG } from '../../types';
import { configService } from '../../services/configService';

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

  const updateConfig = (updates: Partial<RotatePdfConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange(newConfig);
    configService.saveConfig('rotate-pdf', newConfig);
  };

  const rotations: { value: 90 | 180 | 270; label: string; icon: string }[] = [
    { value: 90, label: '90° Clockwise', icon: '↻' },
    { value: 180, label: '180° Upside Down', icon: '↻↻' },
    { value: 270, label: '270° (90° Counter)', icon: '↺' },
  ];

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#333', marginBottom: '8px' }}>
          Rotate PDF
        </h2>
        <p style={{ fontSize: '14px', color: '#666' }}>{file.name}</p>
      </div>

      {/* Rotation Angle */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
          🔄 Rotation Angle
        </div>
        <div style={{ display: 'grid', gap: '12px' }}>
          {rotations.map(({ value, label, icon }) => (
            <button
              key={value}
              style={{
                padding: '20px',
                border: config.rotation === value ? '2px solid #4CAF50' : '2px solid #e0e0e0',
                borderRadius: '8px',
                backgroundColor: config.rotation === value ? '#f1f8f4' : '#fff',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s',
              }}
              onClick={() => updateConfig({ rotation: value })}
            >
              <span style={{ fontSize: '28px' }}>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Page Selection */}
      <div style={{ marginBottom: '32px', padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
          📄 Apply to
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
          <input
            type="radio"
            checked={config.pageSelection === 'all'}
            onChange={() => updateConfig({ pageSelection: 'all', pageNumbers: undefined })}
            style={{ width: '18px', height: '18px' }}
          />
          <span>All pages</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="radio"
            checked={config.pageSelection === 'specific'}
            onChange={() => updateConfig({ pageSelection: 'specific' })}
            style={{ width: '18px', height: '18px' }}
          />
          <span>Specific pages</span>
        </label>

        {config.pageSelection === 'specific' && (
          <input
            type="text"
            placeholder="e.g., 1,3-5,7"
            style={{
              width: '100%',
              marginTop: '12px',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px',
            }}
            onChange={(e) => {
              const pages = e.target.value.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
              updateConfig({ pageNumbers: pages });
            }}
          />
        )}
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
          onClick={() => onRotate(config)}
        >
          Rotate PDF →
        </button>
      </div>
    </div>
  );
};
