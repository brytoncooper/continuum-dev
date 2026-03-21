import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/demo',
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
      '@continuum-dev/ai-engine': resolve(
        __dirname,
        '../../packages/ai-engine/src/index.ts'
      ),
      '@continuum-dev/vercel-ai-sdk-adapter/server': resolve(
        __dirname,
        '../../packages/vercel-ai-sdk-adapter/src/server.ts'
      ),
      '@continuum-dev/vercel-ai-sdk-adapter': resolve(
        __dirname,
        '../../packages/vercel-ai-sdk-adapter/src/index.ts'
      ),
      '@continuum-dev/contract': resolve(
        __dirname,
        '../../packages/contract/src/index.ts'
      ),
      '@continuum-dev/protocol': resolve(
        __dirname,
        '../../packages/protocol/src/index.ts'
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
      '@continuum-dev/runtime/validator': resolve(
        __dirname,
        '../../packages/runtime/src/validator.ts'
      ),
      '@continuum-dev/runtime/node-lookup': resolve(
        __dirname,
        '../../packages/runtime/src/node-lookup.ts'
      ),
      '@continuum-dev/runtime/canonical-snapshot': resolve(
        __dirname,
        '../../packages/runtime/src/canonical-snapshot.ts'
      ),
      '@continuum-dev/runtime/value-write': resolve(
        __dirname,
        '../../packages/runtime/src/value-write.ts'
      ),
      '@continuum-dev/runtime/view-stream': resolve(
        __dirname,
        '../../packages/runtime/src/view-stream.ts'
      ),
      '@continuum-dev/runtime/restore-candidates': resolve(
        __dirname,
        '../../packages/runtime/src/restore-candidates.ts'
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
      '@continuum-dev/starter-kit-ai': resolve(
        __dirname,
        '../../packages/starter-kit-ai/src/index.ts'
      ),
    },
    conditions: ['@continuum-dev/source'],
  },
  ssr: {
    noExternal: [/^@continuum-dev\//],
  },
  test: {
    name: 'demo',
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
