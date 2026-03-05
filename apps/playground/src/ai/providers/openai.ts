import type { AIProvider, GenerateResult, ChatMessage } from '../types';
import type { ViewDefinition } from '@continuum/contract';
import { VIEW_SCHEMA } from '../schema/view-json-schema';

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { file_id: string } };

type OpenAIMessage = {
  role: string;
  content: string | OpenAIContentPart[];
};

async function uploadFileToOpenAI(base64: string, mimeType: string, filename: string, apiKey: string): Promise<string> {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });

  const formData = new FormData();
  formData.append('file', blob, filename);
  formData.append('purpose', 'assistants');

  const response = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('OpenAI File Upload Error Details:', errText);
    throw new Error(`OpenAI file upload failed (${response.status})`);
  }

  const result = await response.json();
  return result.id;
}

async function toOpenAIMessages(systemPrompt: string, messages: ChatMessage[], apiKey: string) {
  const openAIMessages: OpenAIMessage[] = [{ role: 'system', content: systemPrompt }];

  for (const message of messages) {
    const content: OpenAIContentPart[] = [{ type: 'text', text: message.content }];
    
    if (message.attachments) {
      for (const attachment of message.attachments) {
        if (attachment.mimeType.startsWith('image/')) {
          content.push({
            type: 'image_url',
            image_url: { url: `data:${attachment.mimeType};base64,${attachment.base64}` },
          });
        } else if (attachment.mimeType === 'application/pdf') {
          const fileId = await uploadFileToOpenAI(attachment.base64, attachment.mimeType, attachment.name, apiKey);
          // For gpt-4o, when using file_id to pass files uploaded to /v1/files, you don't use 'file' because wait... 
          // wait, actually vision requires "image_url" but for PDFs does it? No, wait. 
          // Does OpenAI /v1/chat/completions accept `file_id` for PDFs? NO IT DOES NOT.
          // Wait... is it Assistant API only or do vision endpoints accept it? 
          // The documentation says: "File Input: You can upload image files (e.g., PNG, JPEG, GIF, WEBP) or PDF documents through the /v1/files endpoint. After uploading, you receive a file ID, which can then be referenced in your chat completion requests."
          // Wait! The search result from earlier stated: 
          // "Missing required parameter: 'messages[1].content[1].file.file_id'." 
          // This MEANS it DOES support the object { type: 'file', file: { file_id: "..." } } !!!
          // The error message from our test literally told us exactly what parameter was missing!
          content.push({
            type: 'file',
            file: { file_id: fileId },
          });
        }
      }
    }

    openAIMessages.push({ role: message.role, content });
  }

  return openAIMessages;
}

function parseView(raw: string): ViewDefinition {
  return JSON.parse(raw) as ViewDefinition;
}

export const openAIProvider: AIProvider = {
  id: 'openai',
  name: 'OpenAI',
  models: ['gpt-5.2', 'gpt-5-nano', 'gpt-4o', 'gpt-4o-mini'],
  async generate(request): Promise<GenerateResult> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${request.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: await toOpenAIMessages(request.systemPrompt, request.messages, request.apiKey),
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'ViewDefinition',
            schema: VIEW_SCHEMA,
            strict: false
          }
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI Error Details:', errText);
      throw new Error(`OpenAI request failed (${response.status})`);
    }

    const payload = (await response.json()) as OpenAIResponse;
    const rawResponse = payload.choices?.[0]?.message?.content ?? '{}';

    return {
      view: parseView(rawResponse),
      rawResponse,
      usage: {
        promptTokens: payload.usage?.prompt_tokens,
        completionTokens: payload.usage?.completion_tokens,
        totalTokens: payload.usage?.total_tokens,
      },
    };
  },
};
