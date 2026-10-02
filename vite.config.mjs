import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative assets work at /movewell/ and at a custom domain root.
  base: './',
  plugins: [react()],
  server: { proxy: { '/api': { target: process.env.MOVEWELL_API_PROXY || 'http://127.0.0.1:8787', changeOrigin: false } } },
});
