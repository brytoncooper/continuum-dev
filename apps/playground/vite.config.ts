import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/playground',
  plugins: [react()],
  build: {
    outDir: '../../dist/apps/playground',
    emptyOutDir: true,
  },
});
