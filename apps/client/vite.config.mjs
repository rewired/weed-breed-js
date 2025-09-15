import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_')
  const serverUrl = env.VITE_SERVER_URL || 'http://localhost:7071'
  const wsPath = env.VITE_SOCKET_PATH || '/ui'

  return {
    root: __dirname,
    envDir: __dirname,
    envPrefix: 'VITE_',
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      proxy: {
        '/healthz': { target: serverUrl, changeOrigin: true },
        '/api': { target: serverUrl, changeOrigin: true },
        [wsPath]: { target: serverUrl, changeOrigin: true, ws: true }, // WS-Upgrade aktiv
      },
    },
    define: {
      __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __WS_PATH__: JSON.stringify(wsPath),
    },
    logLevel: 'info',
  }
})
