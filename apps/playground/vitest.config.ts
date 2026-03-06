import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['@continuum/source'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
  },
});
