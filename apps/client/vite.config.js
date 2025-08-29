import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/healthz': { target: 'http://localhost:7071', changeOrigin: true },
      '/api': { target: 'http://localhost:7071', changeOrigin: true },
      '/ui': { target: 'ws://localhost:7071', ws: true },
    },
  },
  publicDir: path.resolve(__dirname, 'public'),
  build: {
    outDir: path.resolve(__dirname, '../../dist/client'),
    emptyOutDir: true,
  },
});
