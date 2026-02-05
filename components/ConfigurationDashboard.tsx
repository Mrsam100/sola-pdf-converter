/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Configuration Dashboard Wrapper
 * Routes to appropriate tool-specific configuration UI
 */

import React from 'react';
import type { Tool } from '../types';
import type {
  ImageToPdfConfig,
  PdfToImageConfig,
  MergePdfConfig,
  SplitPdfConfig,
  CompressPdfConfig,
  RotatePdfConfig,
} from '../types';

import { ImageToPdfConfig as ImageToPdfConfigComponent } from './config/ImageToPdfConfig';
import { PdfToJpgConfig } from './config/PdfToJpgConfig';
import { MergePdfConfig as MergePdfConfigComponent } from './config/MergePdfConfig';
import { SplitPdfConfig as SplitPdfConfigComponent } from './config/SplitPdfConfig';
import { CompressPdfConfig as CompressPdfConfigComponent } from './config/CompressPdfConfig';
import { RotatePdfConfig as RotatePdfConfigComponent } from './config/RotatePdfConfig';

interface ConfigurationDashboardProps {
  tool: Tool;
  files: File[];
  onConfigChange: (config: any) => void;
  onConvert: (config: any) => void;
  onCancel: () => void;
}

export const ConfigurationDashboard: React.FC<ConfigurationDashboardProps> = ({
  tool,
  files,
  onConfigChange,
  onConvert,
  onCancel,
}) => {
  // Route to appropriate configuration UI based on tool ID
  switch (tool.id) {
    case 'image-to-pdf':
      return (
        <ImageToPdfConfigComponent
          files={files}
          onConfigChange={(config: ImageToPdfConfig) => onConfigChange(config)}
          onConvert={(config: ImageToPdfConfig) => onConvert(config)}
          onCancel={onCancel}
        />
      );

    case 'pdf-to-jpg':
    case 'pdf-to-png':
      return (
        <PdfToJpgConfig
          file={files[0]} // PDF to image typically operates on single file
          onConfigChange={(config: PdfToImageConfig) => onConfigChange(config)}
          onConvert={(config: PdfToImageConfig) => onConvert(config)}
          onCancel={onCancel}
        />
      );

    case 'merge-pdf':
      return (
        <MergePdfConfigComponent
          files={files}
          onConfigChange={(config: MergePdfConfig) => onConfigChange(config)}
          onMerge={(config: MergePdfConfig) => onConvert(config)}
          onCancel={onCancel}
        />
      );

    case 'split-pdf':
      return (
        <SplitPdfConfigComponent
          file={files[0]}
          onConfigChange={(config: SplitPdfConfig) => onConfigChange(config)}
          onSplit={(config: SplitPdfConfig) => onConvert(config)}
          onCancel={onCancel}
        />
      );

    case 'compress-pdf':
      return (
        <CompressPdfConfigComponent
          file={files[0]}
          onConfigChange={(config: CompressPdfConfig) => onConfigChange(config)}
          onCompress={(config: CompressPdfConfig) => onConvert(config)}
          onCancel={onCancel}
        />
      );

    case 'rotate-pdf':
      return (
        <RotatePdfConfigComponent
          file={files[0]}
          onConfigChange={(config: RotatePdfConfig) => onConfigChange(config)}
          onRotate={(config: RotatePdfConfig) => onConvert(config)}
          onCancel={onCancel}
        />
      );

    default:
      return (
        <div
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: '24px',
            backgroundColor: '#fff',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#333', marginBottom: '16px' }}>
            Configuration Not Available
          </div>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>
            This tool does not have a configuration dashboard yet.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              style={{
                padding: '14px 32px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#e0e0e0',
                color: '#666',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
              onClick={onCancel}
            >
              Go Back
            </button>
            <button
              style={{
                padding: '14px 32px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#4CAF50',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
              onClick={() => onConvert({})}
            >
              Convert Now →
            </button>
          </div>
        </div>
      );
  }
};
