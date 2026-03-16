import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {
  handleVercelAiSdkDemoRequest,
  isVercelAiSdkDemoPath,
} from '../demo-api/vercel-ai-sdk-demo-route.mjs';
import {
  handleVercelAiSdkLiveRequest,
  isVercelAiSdkLivePath,
} from '../demo-api/vercel-ai-sdk-live-route.mjs';
import {
  handleVercelAiSdkProvidersRequest,
  isVercelAiSdkProvidersPath,
} from '../demo-api/vercel-ai-sdk-providers-route.mjs';

async function readRequestBody(
  request: IncomingMessage
): Promise<Buffer | undefined> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of request) {
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
      continue;
    }

    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return Buffer.concat(chunks);
}

function createFetchHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === 'undefined') {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
      continue;
    }

    headers.set(key, value);
  }

  return headers;
}

async function toFetchRequest(request: IncomingMessage): Promise<Request> {
  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await readRequestBody(request);

  return new Request(
    `http://${request.headers.host ?? 'localhost'}${request.url ?? '/'}`,
    {
      method: request.method ?? 'GET',
      headers: createFetchHeaders(request),
      body,
    }
  );
}

function sendFetchResponse(
  response: ServerResponse,
  fetchResponse: Response
): void {
  response.statusCode = fetchResponse.status;

  if (fetchResponse.statusText) {
    response.statusMessage = fetchResponse.statusText;
  }

  fetchResponse.headers.forEach((value, key) => {
    response.setHeader(key, value);
  });

  if (!fetchResponse.body) {
    response.end();
    return;
  }

  Readable.fromWeb(fetchResponse.body).pipe(response);
}

const localVercelAiSdkRouteHandlers = [
  {
    matches: isVercelAiSdkDemoPath,
    handle: (request: Request) => handleVercelAiSdkDemoRequest(request),
  },
  {
    matches: isVercelAiSdkLivePath,
    handle: (request: Request) => handleVercelAiSdkLiveRequest(request, {}),
  },
  {
    matches: isVercelAiSdkProvidersPath,
    handle: (request: Request) => handleVercelAiSdkProvidersRequest(request, {}),
  },
];

function localVercelAiSdkRoutes() {
  return {
    name: 'local-vercel-ai-sdk-routes',
    apply: 'serve' as const,
    configureServer(server: {
      middlewares: {
        use: (
          handler: (
            request: IncomingMessage,
            response: ServerResponse,
            next: () => void
          ) => void | Promise<void>
        ) => void;
      };
    }) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(
          request.url ?? '/',
          'http://localhost'
        ).pathname;
        const routeHandler = localVercelAiSdkRouteHandlers.find((candidate) =>
          candidate.matches(pathname)
        );

        if (!routeHandler) {
          next();
          return;
        }

        try {
          const fetchRequest = await toFetchRequest(request);
          const fetchResponse = await routeHandler.handle(fetchRequest);
          sendFetchResponse(response, fetchResponse);
        } catch (error) {
          response.statusCode = 500;
          response.setHeader('content-type', 'application/json');
          response.end(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : 'Unknown Vercel AI SDK demo error',
            })
          );
        }
      });
    },
  };
}

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/demo',
  plugins: [react(), localVercelAiSdkRoutes()],
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
      '@continuum-dev/runtime/state-ops': resolve(
        __dirname,
        '../../packages/runtime/src/lib/state-ops/index.ts'
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
