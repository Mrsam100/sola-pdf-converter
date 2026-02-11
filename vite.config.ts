import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, '.'),
        }
      },
      optimizeDeps: {
        include: ['pdfjs-dist', 'tesseract.js'],
        exclude: ['tesseract.js-core']
      },
      worker: {
        format: 'es'
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              'tesseract': ['tesseract.js'],
              'ml-transformers': ['@huggingface/transformers']
            }
          }
        }
      }
    };
});
