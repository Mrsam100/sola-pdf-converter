/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Configuration Service
 * Handles saving and loading user preferences for conversion tools
 */

import {
  ImageToPdfConfig,
  PdfToImageConfig,
  MergePdfConfig,
  SplitPdfConfig,
  CompressPdfConfig,
  RotatePdfConfig,
  DEFAULT_IMAGE_TO_PDF_CONFIG,
  DEFAULT_PDF_TO_IMAGE_CONFIG,
  DEFAULT_MERGE_PDF_CONFIG,
  DEFAULT_SPLIT_PDF_CONFIG,
  DEFAULT_COMPRESS_PDF_CONFIG,
  DEFAULT_ROTATE_PDF_CONFIG,
} from '../types';

const CONFIG_STORAGE_PREFIX = 'sola_config_';
const CONFIG_VERSION = '1.0';

type ToolConfig =
  | ImageToPdfConfig
  | PdfToImageConfig
  | MergePdfConfig
  | SplitPdfConfig
  | CompressPdfConfig
  | RotatePdfConfig;

interface StoredConfig {
  version: string;
  config: ToolConfig;
  lastUsed: number;
}

/**
 * Configuration Service Class
 * Manages user preferences with localStorage persistence
 */
class ConfigService {
  /**
   * Save configuration for a specific tool
   * @param toolId - The ID of the tool (e.g., 'image-to-pdf')
   * @param config - The configuration object
   */
  saveConfig(toolId: string, config: ToolConfig): void {
    try {
      const storedConfig: StoredConfig = {
        version: CONFIG_VERSION,
        config,
        lastUsed: Date.now(),
      };

      localStorage.setItem(
        `${CONFIG_STORAGE_PREFIX}${toolId}`,
        JSON.stringify(storedConfig)
      );
    } catch (error) {
      console.error(`Failed to save config for ${toolId}:`, error);
    }
  }

  /**
   * Load configuration for a specific tool
   * Returns default config if none exists or if there's an error
   * @param toolId - The ID of the tool
   * @returns The tool configuration
   */
  loadConfig<T extends ToolConfig>(toolId: string): T {
    try {
      const stored = localStorage.getItem(`${CONFIG_STORAGE_PREFIX}${toolId}`);

      if (!stored) {
        return this.getDefaultConfig(toolId) as T;
      }

      const storedConfig: StoredConfig = JSON.parse(stored);

      // Version check - if version mismatch, return defaults
      if (storedConfig.version !== CONFIG_VERSION) {
        console.warn(`Config version mismatch for ${toolId}, using defaults`);
        return this.getDefaultConfig(toolId) as T;
      }

      return storedConfig.config as T;
    } catch (error) {
      console.error(`Failed to load config for ${toolId}:`, error);
      return this.getDefaultConfig(toolId) as T;
    }
  }

  /**
   * Get default configuration for a tool
   * @param toolId - The ID of the tool
   * @returns The default configuration
   */
  getDefaultConfig(toolId: string): ToolConfig {
    switch (toolId) {
      case 'image-to-pdf':
      case 'jpg-to-pdf':
      case 'png-to-pdf':
        return { ...DEFAULT_IMAGE_TO_PDF_CONFIG };

      case 'pdf-to-jpg':
      case 'pdf-to-png':
        return { ...DEFAULT_PDF_TO_IMAGE_CONFIG };

      case 'merge-pdf':
        return { ...DEFAULT_MERGE_PDF_CONFIG };

      case 'split-pdf':
        return { ...DEFAULT_SPLIT_PDF_CONFIG };

      case 'compress-pdf':
        return { ...DEFAULT_COMPRESS_PDF_CONFIG };

      case 'rotate-pdf':
        return { ...DEFAULT_ROTATE_PDF_CONFIG };

      default:
        console.warn(`Unknown tool ID: ${toolId}, returning empty config`);
        return {} as ToolConfig;
    }
  }

  /**
   * Clear configuration for a specific tool
   * @param toolId - The ID of the tool
   */
  clearConfig(toolId: string): void {
    try {
      localStorage.removeItem(`${CONFIG_STORAGE_PREFIX}${toolId}`);
    } catch (error) {
      console.error(`Failed to clear config for ${toolId}:`, error);
    }
  }

  /**
   * Clear all stored configurations
   */
  clearAllConfigs(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(CONFIG_STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Failed to clear all configs:', error);
    }
  }

  /**
   * Get all stored configurations
   * @returns Map of tool IDs to their configs
   */
  getAllConfigs(): Map<string, ToolConfig> {
    const configs = new Map<string, ToolConfig>();

    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(CONFIG_STORAGE_PREFIX)) {
          const toolId = key.replace(CONFIG_STORAGE_PREFIX, '');
          const config = this.loadConfig(toolId);
          configs.set(toolId, config);
        }
      });
    } catch (error) {
      console.error('Failed to get all configs:', error);
    }

    return configs;
  }

  /**
   * Export all configurations as JSON
   * @returns JSON string of all configs
   */
  exportConfigs(): string {
    const configs = this.getAllConfigs();
    const exportData = Object.fromEntries(configs);
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import configurations from JSON
   * @param json - JSON string of configs
   */
  importConfigs(json: string): void {
    try {
      const configs = JSON.parse(json);
      Object.entries(configs).forEach(([toolId, config]) => {
        this.saveConfig(toolId, config as ToolConfig);
      });
    } catch (error) {
      console.error('Failed to import configs:', error);
      throw new Error('Invalid configuration data');
    }
  }
}

// Export singleton instance
export const configService = new ConfigService();

// Export class for testing
export { ConfigService };
