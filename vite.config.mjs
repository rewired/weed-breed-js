// vite.config.mjs
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    server: { host: true },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      __WB_CLIENT_NAME__: JSON.stringify(env.VITE_CLIENT_NAME || 'Weed Breed'),
    },
  };
});
