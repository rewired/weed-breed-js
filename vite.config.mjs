// vite.config.mjs
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, 'apps', 'client');

export default defineConfig({
  root: clientRoot,
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/healthz': { target: 'http://localhost:7071', changeOrigin: true },
      '/api': { target: 'http://localhost:7071', changeOrigin: true },
      '/ui': { target: 'ws://localhost:7071', ws: true, changeOrigin: true }
    }
  },
  resolve: {
    alias: { '@': path.resolve(clientRoot, 'src') }
  },
  publicDir: path.resolve(clientRoot, 'public'),
  build: {
    outDir: path.resolve(__dirname, 'dist/client'),
    emptyOutDir: true
  }
});
