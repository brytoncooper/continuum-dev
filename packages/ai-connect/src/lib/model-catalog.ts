import type { AiConnectProviderKind } from './types.js';

export interface AiConnectModelOption {
  id: string;
  label: string;
}

const MODEL_CATALOG: Record<AiConnectProviderKind, AiConnectModelOption[]> = {
  openai: [
    { id: 'gpt-5.4', label: 'gpt-5.4' },
    { id: 'gpt-5-mini', label: 'gpt-5-mini' },
    { id: 'gpt-5', label: 'gpt-5' },
    { id: 'gpt-5.1', label: 'gpt-5.1' },
    { id: 'gpt-5.2', label: 'gpt-5.2' },
    { id: 'gpt-5-nano', label: 'gpt-5-nano' },
  ],
  anthropic: [
    { id: 'claude-opus-4-6', label: 'claude-opus-4-6' },
    { id: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6' },
    { id: 'claude-haiku-4-5', label: 'claude-haiku-4-5' },
  ],
  google: [
    { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
    { id: 'gemini-2.5-flash-lite', label: 'gemini-2.5-flash-lite' },
    { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro' },
    { id: 'gemini-3.1-pro-preview', label: 'gemini-3.1-pro-preview' },
    { id: 'gemini-3-flash-preview', label: 'gemini-3-flash-preview' },
    { id: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
    { id: 'gemini-2.0-flash-lite', label: 'gemini-2.0-flash-lite' },
  ],
};

export function getAiConnectModelCatalog(
  provider: AiConnectProviderKind
): AiConnectModelOption[] {
  return MODEL_CATALOG[provider];
}

export const AI_CONNECT_MODEL_CATALOG = MODEL_CATALOG;
