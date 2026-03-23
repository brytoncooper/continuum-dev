import { useEffect, useMemo, useState } from 'react';
import type {
  AiConnectClient,
  AiConnectGenerateResult,
  AiConnectProviderKind,
} from '@continuum-dev/ai-connect';
import {
  createAiConnectContinuumExecutionAdapter,
  createAiConnectRegistry,
} from '@continuum-dev/ai-connect';
import type {
  ContinuumExecutionFinalResult,
  ContinuumSessionLike,
  ContinuumViewAuthoringFormat,
} from '@continuum-dev/ai-engine';
import {
  applyContinuumExecutionFinalResult,
  buildContinuumExecutionContext,
  createContinuumSessionAdapter,
  runContinuumExecution,
} from '@continuum-dev/ai-engine';
import type {
  PromptAddon,
  PromptMode,
  PromptOutputContract,
} from '@continuum-dev/prompts';
import { useContinuumSession } from '@continuum-dev/react';

export interface ProviderChatControllerArgs {
  providers: AiConnectClient[];
  mode?: PromptMode;
  addons?: PromptAddon[];
  outputContract?: PromptOutputContract;
  authoringFormat?: ContinuumViewAuthoringFormat;
  autoApplyView?: boolean;
  onResult?: (result: AiConnectGenerateResult, parsed: unknown) => void;
  onError?: (error: Error) => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}

export interface ProviderChatControllerState {
  listedProviders: AiConnectClient[];
  providerId: string;
  instruction: string;
  isSubmitting: boolean;
  status: string | null;
  errorText: string | null;
  copiedPrompt: string | null;
  setProviderId(providerId: string): void;
  setInstruction(instruction: string): void;
  submit(): Promise<void>;
  copyPrompt(prompt: string): void;
}

export function useProviderChatController(
  args: ProviderChatControllerArgs
): ProviderChatControllerState {
  const session = useContinuumSession() as ContinuumSessionLike;
  const sessionAdapter = useMemo(
    () => createContinuumSessionAdapter(session),
    [session]
  );
  const registry = useMemo(
    () => createAiConnectRegistry(args.providers),
    [args.providers]
  );
  const listedProviders = registry.list();
  const [providerId, setProviderId] = useState(listedProviders[0]?.id ?? '');
  const [instruction, setInstruction] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (listedProviders.length === 0) {
      setProviderId('');
      return;
    }

    const hasProvider = listedProviders.some(
      (provider) => provider.id === providerId
    );
    if (!hasProvider) {
      setProviderId(listedProviders[0].id);
    }
  }, [listedProviders, providerId]);

  async function submit(): Promise<void> {
    if (isSubmitting || !instruction.trim()) {
      return;
    }

    setIsSubmitting(true);
    args.onSubmittingChange?.(true);
    setErrorText(null);
    setStatus(null);

    try {
      const activeProviderId = listedProviders.some(
        (provider) => provider.id === providerId
      )
        ? providerId
        : listedProviders[0]?.id;

      if (!activeProviderId) {
        throw new Error('No AI provider is configured.');
      }

      const activeProvider = registry.get(activeProviderId);
      const result = await runContinuumExecution({
        adapter: createAiConnectContinuumExecutionAdapter(activeProvider),
        context: buildContinuumExecutionContext(sessionAdapter),
        instruction,
        mode: args.mode ?? 'evolve-view',
        addons: args.addons,
        outputContract: args.outputContract,
        authoringFormat: args.authoringFormat,
        autoApplyView: args.autoApplyView,
      });

      if (args.autoApplyView !== false) {
        applyContinuumExecutionFinalResult(sessionAdapter, result);
      }

      setStatus(result.status);
      const rawResult = findAiConnectRawResult(result, activeProvider.kind);
      if (rawResult) {
        args.onResult?.(
          rawResult,
          'parsed' in result ? result.parsed : undefined
        );
      }
    } catch (error) {
      const normalized =
        error instanceof Error ? error : new Error(String(error));
      setErrorText(normalized.message);
      args.onError?.(normalized);
    } finally {
      setIsSubmitting(false);
      args.onSubmittingChange?.(false);
    }
  }

  function copyPrompt(prompt: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(prompt);
      setCopiedPrompt(prompt);
    }
  }

  return {
    listedProviders,
    providerId,
    instruction,
    isSubmitting,
    status,
    errorText,
    copiedPrompt,
    setProviderId,
    setInstruction,
    submit,
    copyPrompt,
  };
}

function isAiConnectGenerateResult(
  value: unknown,
  kind: AiConnectProviderKind
): value is AiConnectGenerateResult {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'providerId' in value &&
      'model' in value &&
      'text' in value &&
      typeof (value as AiConnectGenerateResult).providerId === 'string' &&
      typeof (value as AiConnectGenerateResult).model === 'string' &&
      typeof (value as AiConnectGenerateResult).text === 'string' &&
      kind !== undefined
  );
}

function findAiConnectRawResult(
  result: ContinuumExecutionFinalResult,
  kind: AiConnectProviderKind
): AiConnectGenerateResult | null {
  for (let index = result.trace.length - 1; index >= 0; index -= 1) {
    const candidate = result.trace[index]?.response.raw;
    if (isAiConnectGenerateResult(candidate, kind)) {
      return candidate;
    }
  }

  return null;
}
