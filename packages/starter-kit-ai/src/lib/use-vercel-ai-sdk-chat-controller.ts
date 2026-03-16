import { useEffect, useMemo, useState } from 'react';
import {
  useContinuumVercelAiSdkChat,
  type ContinuumVercelAiSdkMessage,
  type UseContinuumVercelAiSdkChatOptions,
} from '@continuum-dev/vercel-ai-sdk';
import type { StarterKitSessionLike } from '@continuum-dev/ai-engine';
import { createStarterKitSessionAdapter } from '@continuum-dev/ai-engine';
import { useContinuumSession, useContinuumStreaming } from '@continuum-dev/react';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

type SessionlessVercelAiSdkChatOptions<T extends ContinuumVercelAiSdkMessage> =
  DistributiveOmit<UseContinuumVercelAiSdkChatOptions<T>, 'session'>;

export interface VercelAiSdkChatControllerArgs {
  chatOptions?: SessionlessVercelAiSdkChatOptions<ContinuumVercelAiSdkMessage>;
  onError?: (error: Error) => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}

export interface VercelAiSdkChatControllerState {
  instruction: string;
  isSubmitting: boolean;
  status: string | null;
  errorText: string | null;
  copiedPrompt: string | null;
  setInstruction(instruction: string): void;
  submit(): Promise<void>;
  copyPrompt(prompt: string): void;
}

export function useVercelAiSdkChatController(
  args: VercelAiSdkChatControllerArgs
): VercelAiSdkChatControllerState {
  const session = useContinuumSession() as StarterKitSessionLike;
  const streaming = useContinuumStreaming();
  const sessionAdapter = useMemo(
    () => createStarterKitSessionAdapter(session),
    [session]
  );
  const [instruction, setInstruction] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  const chat = useContinuumVercelAiSdkChat<ContinuumVercelAiSdkMessage>({
    session: sessionAdapter,
    ...args.chatOptions,
  });
  const isSubmitting =
    chat.status === 'submitted' || chat.status === 'streaming';
  const status =
    streaming.activeStream?.latestStatus?.status ??
    chat.latestStatus?.status ??
    (streaming.isStreaming
      ? 'Applying streamed Continuum update...'
      : null) ??
    (chat.status === 'submitted'
      ? 'Submitting request...'
      : chat.status === 'streaming'
        ? 'Streaming response...'
        : null);
  const errorText = chat.error?.message ?? null;

  useEffect(() => {
    args.onSubmittingChange?.(isSubmitting);
  }, [args, isSubmitting]);

  useEffect(() => {
    if (chat.error) {
      args.onError?.(chat.error);
    }
  }, [args, chat.error]);

  async function submit(): Promise<void> {
    if (isSubmitting || !instruction.trim()) {
      return;
    }

    if (chat.status === 'error') {
      chat.clearError();
    }

    await chat.sendMessage({
      text: instruction,
    });
  }

  function copyPrompt(prompt: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(prompt);
      setCopiedPrompt(prompt);
    }
  }

  return {
    instruction,
    isSubmitting,
    status,
    errorText,
    copiedPrompt,
    setInstruction,
    submit,
    copyPrompt,
  };
}
