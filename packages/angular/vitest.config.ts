import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/angular',
  resolve: {
    conditions: ['@continuum-dev/source'],
  },
  ssr: {
    resolve: {
      conditions: ['@continuum-dev/source'],
    },
  },
  plugins: [],
  test: {
    name: '@continuum-dev/angular',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
