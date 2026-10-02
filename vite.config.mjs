import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative assets work at /movewell/ and at a custom domain root.
  base: './',
  plugins: [react()],
});
