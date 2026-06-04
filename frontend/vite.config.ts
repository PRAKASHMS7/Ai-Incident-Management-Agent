/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/alerts': {
        target: 'http://localhost:8000',
        bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : undefined
      },
      '/incidents': {
        target: 'http://localhost:8000',
        bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : undefined
      },
      '/timeline': {
        target: 'http://localhost:8000',
        bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : undefined
      },
      '/rca': {
        target: 'http://localhost:8000',
        bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : undefined
      },
      '/health': {
        target: 'http://localhost:8000',
        bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : undefined
      },
      '/topology': {
        target: 'http://localhost:8000',
        bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : undefined
      },
      '/dashboard': {
        target: 'http://localhost:8000',
        bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : undefined
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', '**/src/tests/integration/**']
  }
});
