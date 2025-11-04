import { defineConfig } from 'vite';
// @ts-ignore - module's types require node16/nodenext moduleResolution; ignore to avoid compile error here
import react from '@vitejs/plugin-react';
import * as path from 'path';

// Build tool and dev server config
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Shortcuts for imports
      '@': path.resolve(__dirname, './src'),
      '@leadflow/ui': path.resolve(__dirname, '../../packages/ui'),
      '@leadflow/types': path.resolve(__dirname, '../../packages/types')
    }
  },
  server: {
    port: 3000,
    // Forward /api requests to backend
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});