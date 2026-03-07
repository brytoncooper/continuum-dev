import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/demo',
  plugins: [react()],
  resolve: {
    conditions: ['@continuum/source'],
  },
  server: {
    port: 4300,
  },
  build: {
    outDir: '../../dist/apps/demo',
    emptyOutDir: true,
  },
});
