import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// POLISH #4: Clean Vite config
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
