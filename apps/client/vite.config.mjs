import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// __dirname in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Vite ist *hier* im Ordner /apps/client konfiguriert:
 * - root: genau dieses Verzeichnis (damit ./src/main.jsx sicher existiert)
 * - envDir: ebenfalls /apps/client (kein Leak aus Repo-Root)
 * - envPrefix: ausschließlich VITE_ (Hartverdrahtung)
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_')
  const serverUrl = env.VITE_SERVER_URL || 'http://localhost:7071'
  const wsPath = env.VITE_WS_PATH || '/ui'

  return {
    root: __dirname,
    envDir: __dirname,
    envPrefix: 'VITE_',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,        // kein „Port hüpfen“
      open: false,
      proxy: {
        '/healthz': { target: serverUrl, changeOrigin: true },
        '/api':     { target: serverUrl, changeOrigin: true },
        // Socket.IO/SignalR nicht proxfizieren, wenn Cross-Origin ok ist.
      },
    },
    define: {
      __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __WS_PATH__: JSON.stringify(wsPath),
    },
    logLevel: 'info',
  }
})
