import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Production-Grade Security Headers Plugin
 * Adds Content Security Policy and other security headers
 */
const securityHeadersPlugin = (): Plugin => ({
  name: 'security-headers',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      // Content Security Policy - Production Grade with WebAssembly Support
      const csp = [
        "default-src 'self'",
        "script-src 'self' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self' blob: https://cdn.jsdelivr.net https://tessdata.projectnaptha.com https://huggingface.co https://*.huggingface.co https://*.hf.co",
        "worker-src 'self' blob: https://cdn.jsdelivr.net",
        "media-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests"
      ].join('; ');

      res.setHeader('Content-Security-Policy', csp);

      // Additional Security Headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()');

      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      // Same headers for preview server
      const csp = [
        "default-src 'self'",
        "script-src 'self' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self' blob: https://cdn.jsdelivr.net https://tessdata.projectnaptha.com https://huggingface.co https://*.huggingface.co https://*.hf.co",
        "worker-src 'self' blob: https://cdn.jsdelivr.net",
        "media-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests"
      ].join('; ');

      res.setHeader('Content-Security-Policy', csp);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()');

      next();
    });
  }
});

export default defineConfig({
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        securityHeadersPlugin()
      ],
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
});
