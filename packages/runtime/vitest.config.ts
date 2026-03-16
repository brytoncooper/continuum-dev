import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/runtime',
  resolve: {
    alias: {
      '@continuum-dev/protocol': resolve(__dirname, '../protocol/src/index.ts'),
    },
    conditions: ['@continuum-dev/source'],
  },
  ssr: {
    resolve: {
      conditions: ['@continuum-dev/source'],
    },
  },
  plugins: [],
  test: {
    name: '@continuum-dev/runtime',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
