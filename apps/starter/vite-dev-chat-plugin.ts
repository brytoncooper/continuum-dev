import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Plugin } from 'vite';

const moduleDir = dirname(fileURLToPath(import.meta.url));

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
      body: body ? new Uint8Array(body) : undefined,
    }
  );
}

function sendFetchResponse(
  nodeResponse: ServerResponse,
  fetchResponse: Response
): void {
  nodeResponse.statusCode = fetchResponse.status;

  if (fetchResponse.statusText) {
    nodeResponse.statusMessage = fetchResponse.statusText;
  }

  fetchResponse.headers.forEach((value, key) => {
    nodeResponse.setHeader(key, value);
  });

  if (!fetchResponse.body) {
    nodeResponse.end();
    return;
  }

  Readable.fromWeb(
    fetchResponse.body as import('stream/web').ReadableStream
  ).pipe(nodeResponse);
}

export function starterChatDevPlugin(): Plugin {
  return {
    name: 'starter-chat-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost')
          .pathname;

        if (pathname !== '/api/chat' || request.method !== 'POST') {
          next();
          return;
        }

        try {
          const fetchRequest = await toFetchRequest(request);
          const moduleUrl = pathToFileURL(
            resolve(moduleDir, 'server/starter-chat-route.mjs')
          ).href;
          const handler = (await import(
            /* @vite-ignore */ moduleUrl
          )) as { default: (req: Request) => Promise<Response> };
          const fetchResponse = await handler.default(fetchRequest);
          sendFetchResponse(response, fetchResponse);
        } catch (error) {
          response.statusCode = 500;
          response.setHeader('content-type', 'text/plain; charset=utf-8');
          response.end(
            error instanceof Error ? error.message : 'chat route failed'
          );
        }
      });
    },
  };
}
