// vite.config.mjs
import { defineConfig, loadEnv } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = __dirname;

// Client lives in /frontend
const clientRoot = path.resolve(projectRoot, 'frontend');

export default defineConfig(({ mode }) => {
  // Only load VITE_* variables for client
  const env = loadEnv(mode, projectRoot, 'VITE_');
  const apiBase = env.VITE_API_BASE || 'http://localhost:3000';

  return {
    root: clientRoot,
    base: '/',
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiBase,
          changeOrigin: true
        }
      }
    },
    preview: {
      port: 5173,
      strictPort: true
    },
    resolve: {
      alias: {
        '@': path.resolve(clientRoot, 'src')
      }
    },
    define: {
      // Safe fallback for rare client code paths checking NODE_ENV
      'process.env.NODE_ENV': JSON.stringify(mode)
    }
  };
});

