import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { getProviderById } from './src/ai/registry';
import type { ChatMessage, ProviderId, AIAttachment } from './src/ai/types';

interface GenerateBody {
  provider: ProviderId;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  attachments?: AIAttachment[];
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

function isGenerateBody(value: unknown): value is GenerateBody {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.provider === 'string' &&
    typeof record.model === 'string' &&
    typeof record.systemPrompt === 'string' &&
    Array.isArray(record.messages)
  );
}

export function aiApiPlugin(): Plugin {
  return {
    name: 'playground-ai-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST' || req.url !== '/api/ai/generate') {
          next();
          return;
        }

        try {
          const apiKey = req.headers['x-api-key'];
          const normalizedApiKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;
          if (!normalizedApiKey) {
            sendJson(res, 400, { error: 'Missing x-api-key header' });
            return;
          }

          const body = await readJson(req);
          if (!isGenerateBody(body)) {
            sendJson(res, 400, { error: 'Invalid request body' });
            return;
          }

          const provider = getProviderById(body.provider);
          if (!provider) {
            sendJson(res, 400, { error: `Unknown provider: ${body.provider}` });
            return;
          }

          const result = await provider.generate({
            apiKey: normalizedApiKey,
            model: body.model,
            systemPrompt: body.systemPrompt,
            messages: body.messages,
            attachments: body.attachments,
          });

          sendJson(res, 200, result);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          sendJson(res, 500, { error: message });
        }
      });
    },
  };
}
