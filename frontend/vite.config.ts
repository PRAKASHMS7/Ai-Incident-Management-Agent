/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/alerts': 'http://localhost:8000',
      '/incidents': 'http://localhost:8000',
      '/timeline': 'http://localhost:8000',
      '/rca': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/topology': 'http://localhost:8000'
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', '**/src/tests/integration/**']
  }
});
