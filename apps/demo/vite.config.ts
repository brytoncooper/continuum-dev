import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/demo',
  plugins: [react()],
  resolve: {
    alias: {
      '@continuum/adapters': resolve(__dirname, '../../packages/adapters/src/index.ts'),
      '@continuum/contract': resolve(__dirname, '../../packages/contract/src/index.ts'),
      '@continuum/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@continuum/prompts': resolve(__dirname, '../../packages/prompts/src/index.ts'),
      '@continuum/react': resolve(__dirname, '../../packages/react/src/index.ts'),
      '@continuum/runtime': resolve(__dirname, '../../packages/runtime/src/index.ts'),
      '@continuum/session': resolve(__dirname, '../../packages/session/src/index.ts'),
      '@continuum/starter-kit': resolve(__dirname, '../../packages/starter-kit/src/index.ts'),
    },
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
