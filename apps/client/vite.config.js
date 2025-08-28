import react from '@vitejs/plugin-react';

export default {
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/ws': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
      '/api': { target: 'http://localhost:3000', changeOrigin: true }
    }
  }
};
