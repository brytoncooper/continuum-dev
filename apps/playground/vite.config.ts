import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { aiApiPlugin } from './vite-api-plugin';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/playground',
  plugins: [react(), aiApiPlugin()],
  build: {
    outDir: '../../dist/apps/playground',
    emptyOutDir: true,
  },
});
