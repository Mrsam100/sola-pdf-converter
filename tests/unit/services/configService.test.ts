/**
 * Unit tests for Configuration Service
 * Tests saving, loading, and managing user preferences
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '@/services/configService';
import type { ImageToPdfConfig } from '@/types';

describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(() => {
    service = new ConfigService();
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('saveConfig and loadConfig', () => {
    it('should save and load configuration for image-to-pdf', () => {
      const config: ImageToPdfConfig = {
        orientation: 'landscape',
        pageSize: 'Letter',
        margin: 'large',
        quality: 'high',
        imageOrder: ['img1.jpg', 'img2.jpg'],
        fitToPage: true,
      };

      service.saveConfig('image-to-pdf', config);
      const loaded = service.loadConfig<ImageToPdfConfig>('image-to-pdf');

      expect(loaded).toEqual(config);
    });

    it('should return default config when none exists', () => {
      const loaded = service.loadConfig<ImageToPdfConfig>('image-to-pdf');

      expect(loaded).toBeDefined();
      expect(loaded.orientation).toBe('portrait');
      expect(loaded.pageSize).toBe('A4');
      expect(loaded.margin).toBe('small');
      expect(loaded.quality).toBe('high');
    });

    it('should handle multiple tool configs independently', () => {
      const imageConfig: ImageToPdfConfig = {
        orientation: 'landscape',
        pageSize: 'A3',
        margin: 'none',
        quality: 'medium',
        imageOrder: [],
        fitToPage: false,
      };

      service.saveConfig('image-to-pdf', imageConfig);
      service.saveConfig('compress-pdf', { compressionLevel: 'high', optimizeImages: true, removeMetadata: true });

      const loadedImage = service.loadConfig<ImageToPdfConfig>('image-to-pdf');
      expect(loadedImage.orientation).toBe('landscape');
      expect(loadedImage.pageSize).toBe('A3');
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default config for image-to-pdf', () => {
      const defaults = service.getDefaultConfig('image-to-pdf') as ImageToPdfConfig;

      expect(defaults.orientation).toBe('portrait');
      expect(defaults.pageSize).toBe('A4');
      expect(defaults.margin).toBe('small');
      expect(defaults.quality).toBe('high');
      expect(defaults.fitToPage).toBe(true);
      expect(defaults.imageOrder).toEqual([]);
    });

    it('should return default config for pdf-to-jpg', () => {
      const defaults = service.getDefaultConfig('pdf-to-jpg');

      expect(defaults).toBeDefined();
      expect(defaults).toHaveProperty('format');
      expect(defaults).toHaveProperty('quality');
      expect(defaults).toHaveProperty('dpi');
    });

    it('should return empty config for unknown tool', () => {
      const defaults = service.getDefaultConfig('unknown-tool');

      expect(defaults).toEqual({});
    });
  });

  describe('clearConfig', () => {
    it('should clear specific tool config', () => {
      const config: ImageToPdfConfig = {
        orientation: 'landscape',
        pageSize: 'A4',
        margin: 'small',
        quality: 'high',
        imageOrder: [],
        fitToPage: true,
      };

      service.saveConfig('image-to-pdf', config);
      expect(localStorage.getItem('sola_config_image-to-pdf')).toBeTruthy();

      service.clearConfig('image-to-pdf');
      expect(localStorage.getItem('sola_config_image-to-pdf')).toBeNull();
    });

    it('should not affect other configs when clearing one', () => {
      service.saveConfig('image-to-pdf', { orientation: 'portrait', pageSize: 'A4', margin: 'small', quality: 'high', imageOrder: [], fitToPage: true });
      service.saveConfig('compress-pdf', { compressionLevel: 'high', optimizeImages: true, removeMetadata: false });

      service.clearConfig('image-to-pdf');

      const compressConfig = service.loadConfig('compress-pdf');
      expect(compressConfig).toBeDefined();
      expect(compressConfig).toHaveProperty('compressionLevel');
    });
  });

  describe('clearAllConfigs', () => {
    it('should clear all stored configs', () => {
      service.saveConfig('image-to-pdf', { orientation: 'portrait', pageSize: 'A4', margin: 'small', quality: 'high', imageOrder: [], fitToPage: true });
      service.saveConfig('compress-pdf', { compressionLevel: 'high', optimizeImages: true, removeMetadata: false });
      service.saveConfig('merge-pdf', { pageOrder: [], removePages: [] });

      service.clearAllConfigs();

      expect(localStorage.getItem('sola_config_image-to-pdf')).toBeNull();
      expect(localStorage.getItem('sola_config_compress-pdf')).toBeNull();
      expect(localStorage.getItem('sola_config_merge-pdf')).toBeNull();
    });

    it('should not affect non-config localStorage items', () => {
      localStorage.setItem('other_key', 'value');
      service.saveConfig('image-to-pdf', { orientation: 'portrait', pageSize: 'A4', margin: 'small', quality: 'high', imageOrder: [], fitToPage: true });

      service.clearAllConfigs();

      expect(localStorage.getItem('other_key')).toBe('value');
      expect(localStorage.getItem('sola_config_image-to-pdf')).toBeNull();
    });
  });

  describe('getAllConfigs', () => {
    it('should return all stored configs', () => {
      service.saveConfig('image-to-pdf', { orientation: 'landscape', pageSize: 'A4', margin: 'small', quality: 'high', imageOrder: [], fitToPage: true });
      service.saveConfig('compress-pdf', { compressionLevel: 'medium', optimizeImages: true, removeMetadata: false });

      const allConfigs = service.getAllConfigs();

      expect(allConfigs.size).toBe(2);
      expect(allConfigs.has('image-to-pdf')).toBe(true);
      expect(allConfigs.has('compress-pdf')).toBe(true);
    });

    it('should return empty map when no configs exist', () => {
      const allConfigs = service.getAllConfigs();

      expect(allConfigs.size).toBe(0);
    });
  });

  describe('exportConfigs and importConfigs', () => {
    it('should export configs as JSON', () => {
      service.saveConfig('image-to-pdf', { orientation: 'portrait', pageSize: 'A4', margin: 'small', quality: 'high', imageOrder: [], fitToPage: true });
      service.saveConfig('compress-pdf', { compressionLevel: 'high', optimizeImages: true, removeMetadata: false });

      const exported = service.exportConfigs();
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveProperty('image-to-pdf');
      expect(parsed).toHaveProperty('compress-pdf');
    });

    it('should import configs from JSON', () => {
      const configsJson = JSON.stringify({
        'image-to-pdf': {
          orientation: 'landscape',
          pageSize: 'Letter',
          margin: 'large',
          quality: 'medium',
          imageOrder: [],
          fitToPage: false,
        },
        'compress-pdf': {
          compressionLevel: 'extreme',
          optimizeImages: true,
          removeMetadata: true,
        },
      });

      service.importConfigs(configsJson);

      const imageConfig = service.loadConfig<ImageToPdfConfig>('image-to-pdf');
      expect(imageConfig.orientation).toBe('landscape');
      expect(imageConfig.pageSize).toBe('Letter');

      const compressConfig = service.loadConfig('compress-pdf');
      expect(compressConfig).toHaveProperty('compressionLevel', 'extreme');
    });

    it('should throw error on invalid JSON import', () => {
      expect(() => {
        service.importConfigs('invalid json{');
      }).toThrow('Invalid configuration data');
    });
  });

  describe('localStorage errors', () => {
    it('should handle localStorage quota exceeded gracefully', () => {
      const largConfig = {
        orientation: 'portrait' as const,
        pageSize: 'A4' as const,
        margin: 'small' as const,
        quality: 'high' as const,
        imageOrder: new Array(10000).fill('image.jpg'),
        fitToPage: true,
      };

      // Should not throw even if save fails
      expect(() => {
        service.saveConfig('image-to-pdf', largConfig);
      }).not.toThrow();
    });
  });
});
