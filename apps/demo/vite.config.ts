import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/demo',
  plugins: [react()],
  resolve: {
    alias: {
      '@continuum-dev/adapters': resolve(
        __dirname,
        '../../packages/adapters/src/index.ts'
      ),
      '@continuum-dev/ai-connect': resolve(
        __dirname,
        '../../packages/ai-connect/src/index.ts'
      ),
      '@continuum-dev/contract': resolve(
        __dirname,
        '../../packages/contract/src/index.ts'
      ),
      '@continuum-dev/core': resolve(
        __dirname,
        '../../packages/core/src/index.ts'
      ),
      '@continuum-dev/prompts': resolve(
        __dirname,
        '../../packages/prompts/src/index.ts'
      ),
      '@continuum-dev/react': resolve(
        __dirname,
        '../../packages/react/src/index.ts'
      ),
      '@continuum-dev/runtime': resolve(
        __dirname,
        '../../packages/runtime/src/index.ts'
      ),
      '@continuum-dev/session': resolve(
        __dirname,
        '../../packages/session/src/index.ts'
      ),
      '@continuum-dev/starter-kit': resolve(
        __dirname,
        '../../packages/starter-kit/src/index.ts'
      ),
    },
    conditions: ['@continuum-dev/source'],
  },
  server: {
    port: 4300,
    proxy: {
      '/api/anthropic': {
        target: 'https://api.anthropic.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
      },
    },
  },
  build: {
    outDir: '../../dist/apps/demo',
    emptyOutDir: true,
  },
});
