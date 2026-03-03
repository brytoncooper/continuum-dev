import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { getProviderById } from './src/ai/registry';
import { getSchemaIndex, getNodeSpec } from './src/ai/schema-api';
import { resolveIntent } from './src/ai/pipeline/intent-resolver';
import { collectData } from './src/ai/pipeline/data-collector';
import { architectForm } from './src/ai/pipeline/form-architect';
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
        if (req.method === 'GET' && req.url === '/api/schema') {
          sendJson(res, 200, getSchemaIndex());
          return;
        }

        if (req.method === 'GET' && req.url?.startsWith('/api/schema/')) {
          const type = req.url.split('/api/schema/')[1];
          const spec = getNodeSpec(type);
          if (spec) {
            sendJson(res, 200, spec);
          } else {
            sendJson(res, 404, { error: `Node type not found: ${type}` });
          }
          return;
        }

        if (req.method === 'POST' && req.url === '/api/ai/pipeline') {
          try {
            const apiKey = req.headers['x-api-key'];
            const normalizedApiKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;
            if (!normalizedApiKey) {
              sendJson(res, 400, { error: 'Missing x-api-key header' });
              return;
            }
            const body = await readJson(req);
            const { provider, model, prompt, stage, nodeTypes, manifest } = body as any;

            if (stage === 'intent') {
              const result = await resolveIntent(provider, model, normalizedApiKey, prompt);
              sendJson(res, 200, result);
            } else if (stage === 'collect') {
              const result = await collectData(provider, model, normalizedApiKey, prompt, nodeTypes);
              sendJson(res, 200, result);
            } else if (stage === 'architect') {
              const result = await architectForm(provider, model, normalizedApiKey, prompt, manifest);
              sendJson(res, 200, result);
            } else {
              sendJson(res, 400, { error: 'Invalid stage' });
            }
          } catch (error) {
            sendJson(res, 500, { error: error instanceof Error ? error.message : 'Unknown error' });
          }
          return;
        }

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
