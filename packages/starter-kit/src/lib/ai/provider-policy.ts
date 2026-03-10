import type {
  AiConnectClient,
  AiConnectGenerateRequest,
} from '@continuum-dev/ai-connect';
import type { PromptMode } from '@continuum-dev/prompts';

export function shouldUsePatchMode(args: {
  autoApplyView: boolean;
  mode: PromptMode;
  provider: AiConnectClient;
}): boolean {
  return (
    args.autoApplyView &&
    args.mode === 'evolve-view' &&
    args.provider.kind === 'openai'
  );
}

export function shouldAttemptRepair(args: {
  autoApplyView: boolean;
  provider: AiConnectClient;
}): boolean {
  return args.autoApplyView;
}

export function getPatchGenerateOptions(
  provider: AiConnectClient
): Pick<
  AiConnectGenerateRequest,
  'temperature' | 'maxTokens'
> {
  return {
    temperature: 0,
    maxTokens: provider.kind === 'anthropic' ? 16384 : undefined,
  };
}

export function getFullGenerateOptions(
  provider: AiConnectClient
): Pick<AiConnectGenerateRequest, 'temperature' | 'maxTokens'> {
  return {
    temperature: provider.kind === 'google' ? 0.1 : undefined,
    maxTokens:
      provider.kind === 'google'
        ? 100000
        : provider.kind === 'anthropic'
          ? 64000
          : undefined,
  };
}

export function getRepairGenerateOptions(
  provider: AiConnectClient
): Pick<AiConnectGenerateRequest, 'temperature' | 'maxTokens'> {
  return {
    temperature: provider.kind === 'google' ? 0.1 : undefined,
    maxTokens:
      provider.kind === 'google'
        ? 100000
        : provider.kind === 'anthropic'
          ? 64000
          : undefined,
  };
}
