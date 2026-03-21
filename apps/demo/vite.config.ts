import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {
  isVercelAiSdkDemoPath,
  isVercelAiSdkLivePath,
  isVercelAiSdkProvidersPath,
} from '../demo-api/vercel-ai-sdk-shared.mjs';

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

type DemoViteDevServer = {
  middlewares: {
    use: (
      handler: (
        request: IncomingMessage,
        response: ServerResponse,
        next: () => void
      ) => void | Promise<void>
    ) => void;
  };
  ssrLoadModule?: (url: string) => Promise<unknown>;
};

function importDemoApiModule<TModule>(
  server: DemoViteDevServer,
  relativePath: string
): Promise<TModule> {
  const modulePath = resolve(__dirname, relativePath);

  if (server.ssrLoadModule) {
    return server.ssrLoadModule(modulePath) as Promise<TModule>;
  }

  // Keep these route modules runtime-only so config graph evaluation does not
  // pull workspace source packages into Vite's temporary bundled config file.
  const moduleUrl = pathToFileURL(modulePath).href;
  return import(/* @vite-ignore */ moduleUrl) as Promise<TModule>;
}

function localVercelAiSdkRoutes() {
  return {
    name: 'local-vercel-ai-sdk-routes',
    apply: 'serve' as const,
    configureServer(server: DemoViteDevServer) {
      server.middlewares.use(async (request, response, next) => {
        const localVercelAiSdkRouteHandlers = [
          {
            matches: isVercelAiSdkDemoPath,
            handle: async (fetchRequest: Request) =>
              (
                await importDemoApiModule<
                  typeof import('../demo-api/vercel-ai-sdk-demo-route.mjs')
                >(server, '../demo-api/vercel-ai-sdk-demo-route.mjs')
              ).handleVercelAiSdkDemoRequest(fetchRequest),
          },
          {
            matches: isVercelAiSdkLivePath,
            handle: async (fetchRequest: Request) =>
              (
                await importDemoApiModule<
                  typeof import('../demo-api/vercel-ai-sdk-live-route.mjs')
                >(server, '../demo-api/vercel-ai-sdk-live-route.mjs')
              ).handleVercelAiSdkLiveRequest(fetchRequest, {}),
          },
          {
            matches: isVercelAiSdkProvidersPath,
            handle: async (fetchRequest: Request) =>
              (
                await importDemoApiModule<
                  typeof import('../demo-api/vercel-ai-sdk-providers-route.mjs')
                >(server, '../demo-api/vercel-ai-sdk-providers-route.mjs')
              ).handleVercelAiSdkProvidersRequest(fetchRequest, {}),
          },
        ];
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

export default defineConfig(({ command }) => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/demo',
  plugins: [react(), ...(command === 'serve' ? [localVercelAiSdkRoutes()] : [])],
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
  },
  ssr: {
    noExternal: [/^@continuum-dev\//],
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
}));
