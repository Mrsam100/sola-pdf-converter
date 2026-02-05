import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock crypto.randomUUID for tests
if (typeof global.crypto === 'undefined') {
  (global as any).crypto = {
    randomUUID: () => Math.random().toString(36).substring(2, 15),
  };
}

// Mock FileReader for File.arrayBuffer()
if (typeof global.FileReader === 'undefined') {
  global.FileReader = class FileReader {
    result: string | ArrayBuffer | null = null;
    onloadend: ((this: FileReader, ev: ProgressEvent) => any) | null = null;

    readAsArrayBuffer(blob: Blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        if (this.onloadend) {
          this.onloadend.call(this, {} as ProgressEvent);
        }
      });
    }

    readAsDataURL(blob: Blob) {
      blob.arrayBuffer().then((buffer) => {
        const base64 = Buffer.from(buffer).toString('base64');
        this.result = `data:${blob.type};base64,${base64}`;
        if (this.onloadend) {
          this.onloadend.call(this, {} as ProgressEvent);
        }
      });
    }
  } as any;
}

// Suppress console errors in tests unless explicitly needed
const originalError = console.error;
beforeEach(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Not implemented: HTMLFormElement.prototype.submit') ||
       args[0].includes('Not implemented: HTMLCanvasElement'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});
