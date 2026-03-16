import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/demo-api',
  resolve: {
    conditions: ['@continuum-dev/source'],
  },
  test: {
    name: 'demo-api',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.mjs'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
    },
  },
});
