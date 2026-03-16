import { useEffect, useMemo, useState } from 'react';
import type {
  AiConnectClient,
  AiConnectGenerateResult,
} from '@continuum-dev/ai-connect';
import { createAiConnectRegistry } from '@continuum-dev/ai-connect';
import type {
  StarterKitSessionLike,
  StarterKitViewAuthoringFormat,
} from '@continuum-dev/ai-engine';
import {
  createStarterKitSessionAdapter,
  runStarterKitViewGeneration,
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
  authoringFormat?: StarterKitViewAuthoringFormat;
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
  const session = useContinuumSession() as StarterKitSessionLike;
  const sessionAdapter = useMemo(
    () => createStarterKitSessionAdapter(session),
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

      const result = await runStarterKitViewGeneration({
        provider: registry.get(activeProviderId),
        session: sessionAdapter,
        instruction,
        mode: args.mode ?? 'evolve-view',
        addons: args.addons,
        outputContract: args.outputContract,
        authoringFormat: args.authoringFormat,
        autoApplyView: args.autoApplyView,
      });

      setStatus(result.status);
      args.onResult?.(result.result, result.parsed);
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
